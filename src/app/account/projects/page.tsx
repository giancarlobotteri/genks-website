import {StudioPackageCredit} from "@/components/services/studio-package-credit";
import { ProjectSongs } from "@/components/services/project-songs";
import { formatPrice } from "@/lib/format";
import { operationsStart } from "@/lib/operations-start";
import { AccountListTools, AccountListPagination, accountSort, accountPage, type AccountListQuery } from "@/components/services/account-list-tools";
import { CustomerCashAgreementSummary, type CustomerCashAgreement } from "@/components/services/customer-cash-agreement";
import { italianLabel } from "@/lib/italian";
import { claimGuestPurchases } from "@/lib/claim-guest-purchases";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CustomerQuote, type CustomerServiceQuote } from "@/components/services/customer-quote";
export default async function ProjectsPage({ searchParams }: { searchParams: Promise<AccountListQuery> }) {
  const q=await searchParams; const sort=accountSort(q.sort); const states=["requested", "quoted", "awaiting_payment", "paid", "in_progress", "review", "delivered", "cancelled"]; const status=states.includes(q.status??"")?q.status!:""; const start=await operationsStart();
  const user=await claimGuestPurchases();const db=await createSupabaseServerClient();
  let query=db.from("service_projects").select("songs,price_cents,created_at,id,reference,track_title,service,status,desired_deadline,agreed_deadline,delivery_url",{count:"exact"}).eq("customer_id",user.id).is("archived_at",null).gte("created_at",start);
  if(status)query=query.eq("status",status);
  let countQuery=db.from("service_projects").select("id",{count:"exact",head:true}).eq("customer_id",user.id).is("archived_at",null).gte("created_at",start);
  if(status)countQuery=countQuery.eq("status",status); const counter=await countQuery;
  if(counter.error)throw new Error("Impossibile leggere il numero di risultati.");
  const total=counter.count??0; const page=Math.min(accountPage(q.page),Math.max(1,Math.ceil(total/5)));
  const {data,error}=await query.order(sort.startsWith("price")?"price_cents":"created_at",{ascending:sort.endsWith("asc"),nullsFirst:false}).order("id").range((page-1)*5,page*5-1);

  if(error)throw new Error("Impossibile leggere i progetti.");
  const asOf=new Date().getTime();
  const quotes:CustomerServiceQuote[]=[];
  // IDs come exclusively from the customer's RLS-protected project query above.
  if(data?.length){const result=await createSupabaseAdminClient().from("service_quotes").select("booking_id,project_id,amount_cents,currency,scope,fixed_price,revision_count,agreed_deadline,status,checkout_url,expires_at,commerce_snapshot").in("project_id",data.map(x=>x.id)).order("created_at",{ascending:false});if(result.error)throw new Error("Impossibile leggere i preventivi.");quotes.push(...result.data);}
  const cashAgreements: CustomerCashAgreement[] = [];
  if(data?.length){const result=await createSupabaseAdminClient().from("studio_cash_agreements").select("booking_id,project_id,amount_cents,details,received_at,refunded_at").in("project_id",data.map(x=>x.id));if(result.error)throw new Error("Impossibile leggere gli accordi in studio.");cashAgreements.push(...result.data);}
  return <section className="portal-panel"><div className="panel-heading"><h2>Progetti</h2></div><AccountListTools path="/account/projects" sort={sort} status={status} states={states}/><div className="data-list">{data?.map(x=><article key={x.id}><div><strong>{x.track_title}</strong><small>{x.price_cents===null?"Importo da concordare":formatPrice(x.price_cents)}</small><small>{x.reference} · {italianLabel(x.service)}</small><small>Consegna concordata: {x.agreed_deadline||"Da concordare prima dell’avvio"}</small><StudioPackageCredit id={x.id}/><ProjectSongs songs={x.songs}/><CustomerCashAgreementSummary agreement={cashAgreements.find(a=>a.project_id===x.id)}/><CustomerQuote asOf={asOf} quote={quotes.find(q=>q.project_id===x.id)} payable={x.status==="awaiting_payment"}/>{x.status==="delivered"&&x.delivery_url&&/^https:\/\//i.test(x.delivery_url)&&<a className="button button-secondary" href={x.delivery_url} target="_blank" rel="noopener noreferrer">Apri i file finali</a>}</div><span>{italianLabel(x.status)}</span></article>)}{!data?.length&&<p className="muted">Non hai ancora progetti di mix o master.</p>}</div><AccountListPagination page={page} total={total} path="/account/projects" sort={sort} status={status}/></section>;
}
