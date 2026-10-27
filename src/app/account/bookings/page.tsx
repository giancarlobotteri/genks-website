import { formatPrice } from "@/lib/format";
import { operationsStart } from "@/lib/operations-start";
import { AccountListTools, AccountListPagination, accountSort, accountPage, type AccountListQuery } from "@/components/services/account-list-tools";
import { CustomerCashAgreementSummary, type CustomerCashAgreement } from "@/components/services/customer-cash-agreement";
import { bookingCalendarUrl } from "@/lib/booking-calendar";
import { italianLabel } from "@/lib/italian";
import { claimGuestPurchases } from "@/lib/claim-guest-purchases";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CustomerQuote, type CustomerServiceQuote } from "@/components/services/customer-quote";
export default async function BookingsPage({ searchParams }: { searchParams: Promise<AccountListQuery> }) {
  const q=await searchParams; const sort=accountSort(q.sort); const states=["confirmed", "completed", "pending", "approved_awaiting_payment", "cancelled", "rejected", "no_show"]; const status=states.includes(q.status??"")?q.status!:""; const start=await operationsStart();
  const user=await claimGuestPurchases();const db=await createSupabaseServerClient();
  let query=db.from("bookings").select("price_cents,id,reference,starts_at,ends_at,status",{count:"exact"}).eq("customer_id",user.id).is("archived_at",null).gte("created_at",start);
  if(status)query=query.eq("status",status);
  let countQuery=db.from("bookings").select("id",{count:"exact",head:true}).eq("customer_id",user.id).is("archived_at",null).gte("created_at",start);
  if(status)countQuery=countQuery.eq("status",status); const counter=await countQuery;
  if(counter.error)throw new Error("Impossibile leggere il numero di risultati.");
  const total=counter.count??0; const page=Math.min(accountPage(q.page),Math.max(1,Math.ceil(total/5)));
  const {data,error}=await query.order(sort.startsWith("price")?"price_cents":"starts_at",{ascending:sort.endsWith("asc"),nullsFirst:false}).order("id").range((page-1)*5,page*5-1);

  if(error)throw new Error("Impossibile leggere le prenotazioni.");
  const asOf=new Date().getTime();
  const quotes:CustomerServiceQuote[]=[];
  // IDs come exclusively from the customer's RLS-protected booking query above.
  if(data?.length){const result=await createSupabaseAdminClient().from("service_quotes").select("booking_id,project_id,amount_cents,currency,scope,revision_count,agreed_deadline,status,checkout_url,expires_at").in("booking_id",data.map(x=>x.id)).order("created_at",{ascending:false});if(result.error)throw new Error("Impossibile leggere i preventivi.");quotes.push(...result.data);}
  const cashAgreements: CustomerCashAgreement[] = [];
  if(data?.length){const result=await createSupabaseAdminClient().from("studio_cash_agreements").select("booking_id,project_id,amount_cents,extra_minutes,extra_night_minutes,details,received_at,refunded_at").in("booking_id",data.map(x=>x.id));if(result.error)throw new Error("Impossibile leggere gli accordi in studio.");cashAgreements.push(...result.data);}
  return <section className="portal-panel"><div className="panel-heading"><h2>Prenotazioni</h2></div><AccountListTools path="/account/bookings" sort={sort} status={status} states={states}/><div className="data-list">{data?.map(x=><article key={x.id}><div><strong>{x.reference}</strong><small>{x.price_cents===null?"Importo da concordare":formatPrice(x.price_cents)}</small><small>{new Date(x.starts_at).toLocaleString("it-IT",{timeZone:"Europe/Rome"})} → {new Date(x.ends_at).toLocaleString("it-IT",{timeZone:"Europe/Rome"})}</small><small>Orari italiani · Europe/Rome</small>{x.status==="confirmed"&&<div className="admin-inline-actions"><a className="button button-secondary" href={bookingCalendarUrl(x)} target="_blank" rel="noopener noreferrer">Aggiungi a Google Calendar</a><a className="text-link" href={`/api/bookings/${x.id}/calendar`}>Apple Calendar / Outlook (.ics)</a></div>}<CustomerCashAgreementSummary agreement={cashAgreements.find(a=>a.booking_id===x.id)}/><CustomerQuote asOf={asOf} quote={quotes.find(q=>q.booking_id===x.id)} payable={x.status==="approved_awaiting_payment"}/></div><span>{italianLabel(x.status)}</span></article>)}{!data?.length&&<p className="muted">Non hai ancora richieste di prenotazione.</p>}</div><AccountListPagination page={page} total={total} path="/account/bookings" sort={sort} status={status}/></section>;
}

