import { CustomerCashAgreementSummary, type CustomerCashAgreement } from "@/components/services/customer-cash-agreement";
import { italianLabel } from "@/lib/italian";
import { claimGuestPurchases } from "@/lib/claim-guest-purchases";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CustomerQuote, type CustomerServiceQuote } from "@/components/services/customer-quote";
export default async function ProjectsPage() {
  const user=await claimGuestPurchases();const db=await createSupabaseServerClient();
  const {data,error}=await db.from("service_projects").select("id,reference,track_title,service,status,desired_deadline,agreed_deadline,delivery_url").eq("customer_id",user.id).order("created_at",{ascending:false});
  if(error)throw new Error("Impossibile leggere i progetti.");
  const asOf=new Date().getTime();
  const quotes:CustomerServiceQuote[]=[];
  // IDs come exclusively from the customer's RLS-protected project query above.
  if(data?.length){const result=await createSupabaseAdminClient().from("service_quotes").select("booking_id,project_id,amount_cents,currency,scope,fixed_price,revision_count,agreed_deadline,status,checkout_url,expires_at").in("project_id",data.map(x=>x.id)).order("created_at",{ascending:false});if(result.error)throw new Error("Impossibile leggere i preventivi.");quotes.push(...result.data);}
  const cashAgreements: CustomerCashAgreement[] = [];
  if(data?.length){const result=await createSupabaseAdminClient().from("studio_cash_agreements").select("booking_id,project_id,amount_cents,details,received_at,refunded_at").in("project_id",data.map(x=>x.id));if(result.error)throw new Error("Impossibile leggere gli accordi in studio.");cashAgreements.push(...result.data);}
  return <section className="portal-panel"><div className="panel-heading"><h2>Progetti</h2></div><div className="data-list">{data?.map(x=><article key={x.id}><div><strong>{x.track_title}</strong><small>{x.reference} · {italianLabel(x.service)}</small><small>Consegna concordata: {x.agreed_deadline||"Da concordare prima dell’avvio"}</small><CustomerCashAgreementSummary agreement={cashAgreements.find(a=>a.project_id===x.id)}/><CustomerQuote asOf={asOf} quote={quotes.find(q=>q.project_id===x.id)} payable={x.status==="awaiting_payment"}/>{x.status==="delivered"&&x.delivery_url&&/^https:\/\//i.test(x.delivery_url)&&<a className="button button-secondary" href={x.delivery_url} target="_blank" rel="noopener noreferrer">Apri i file finali</a>}</div><span>{italianLabel(x.status)}</span></article>)}{!data?.length&&<p className="muted">Non hai ancora progetti di mix o master.</p>}</div></section>;
}
