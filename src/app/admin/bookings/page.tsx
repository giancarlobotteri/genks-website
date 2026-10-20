import { CashServiceForm } from "@/components/admin/cash-service-form";
import { studioCashOnly } from "@/lib/studio-payment-mode";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { AdminPagination, pageNumber } from "@/components/admin/pagination";
import { OperationNotice } from "@/components/admin/operation-notice";
import { ServiceQuoteForm } from "@/components/admin/service-quote-form";
import { PaymentStatus } from "@/components/admin/payment-status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendBookingAlertPreview } from "../reminder-actions";
import { canChangeServiceStatus } from "@/lib/service-workflow";
import { requestBookingPayment, updateBookingStatus, createBlackout, deleteBlackout } from "../actions";
const states=[["pending","Da valutare"],["approved_awaiting_payment","In attesa di pagamento"],["confirmed","Confermata"],["completed","Completata"],["cancelled","Annullata"],["rejected","Rifiutata"],["no_show","Mancata presentazione"]];
export default async function AdminBookings({searchParams}:{searchParams:Promise<{page?:string;status?:string;notice?:string}>}) {
  await requireAdmin();
  const q=await searchParams;const db=createSupabaseAdminClient();
  const expired=await db.rpc("expire_booking_holds");if(expired.error)throw new Error("Impossibile aggiornare le riserve temporanee.");
  const status=states.some(([value])=>value===q.status)?q.status!:"";
  const countQuery=db.from("bookings").select("id",{count:"exact",head:true});if(status)countQuery.eq("status",status);
  const {count,error:countError}=await countQuery;if(countError)throw new Error("Impossibile caricare le prenotazioni.");
  const page=Math.min(pageNumber(q.page),Math.max(1,Math.ceil((count??0)/5)));
  const query=db.from("bookings").select("id,reference,name,artist_name,email,phone,starts_at,ends_at,status,notes,reference_url,hold_expires_at,service_quotes(*),payments(amount_cents,refunded_cents,status,livemode,review_reason)").order("created_at",{ascending:false}).order("id");if(status)query.eq("status",status);
  const [bookings,blackouts]=await Promise.all([query.range((page-1)*5,page*5-1),db.from("blackout_dates").select("id,starts_at,ends_at,reason").gt("ends_at",new Date().toISOString()).order("starts_at").limit(50)]);
  if(bookings.error||blackouts.error)throw new Error("Impossibile leggere il calendario.");
  return <><header className="admin-heading"><span className="eyebrow">GENKS STUDIO</span><h1>Prenotazioni</h1><p>{studioCashOnly ? "Le nuove prenotazioni sono confermate automaticamente a 20 €/ora. Ricevi l’avviso su Gmail: non serve approvarle. Registra i contanti solo dopo averli ricevuti." : "Il pagamento conferma automaticamente la sessione."} Gli orari seguono il fuso italiano.</p></header>
    <OperationNotice code={q.notice}/>
    <form action={sendBookingAlertPreview}><button className="button button-secondary">Invia avviso Gmail di prova</button></form>
    <details className="admin-form-card"><summary>Blocca un periodo in cui lo studio non è disponibile</summary><p>I blocchi inseriti qui impediscono nuove prenotazioni. Gli impegni aggiunti soltanto a Google Calendar non vengono letti dall’abbonamento all’agenda.</p>
      <form action={createBlackout} className="premium-form form-grid"><label>Inizio<input name="start" type="datetime-local" required/></label><label>Fine<input name="end" type="datetime-local" required/></label><label className="full">Motivo interno<input name="reason" maxLength={200}/></label><button className="button button-primary">Blocca periodo</button></form>
      {blackouts.data?.map(b=><div className="sales-ranking" key={b.id}><span>{new Date(b.starts_at).toLocaleString("it-IT",{timeZone:"Europe/Rome"})} → {new Date(b.ends_at).toLocaleString("it-IT",{timeZone:"Europe/Rome"})}<small>{b.reason}</small></span><form action={deleteBlackout}><input name="id" type="hidden" value={b.id}/><button className="button button-secondary">Rimuovi blocco</button></form></div>)}
    </details>
    <nav className="admin-filter-tabs" aria-label="Filtra prenotazioni"><Link href="/admin/bookings">Tutte</Link>{states.map(([value,label])=><Link key={value} href={`/admin/bookings?status=${value}`} aria-current={status===value?"page":undefined}>{label}</Link>)}</nav>
    <div className="admin-cards">{bookings.data?.map(x=><article key={x.id}><div><span className="eyebrow">{x.reference}</span><h2>{x.artist_name||x.name}</h2><p>{new Date(x.starts_at).toLocaleString("it-IT",{timeZone:"Europe/Rome"})} → {new Date(x.ends_at).toLocaleString("it-IT",{timeZone:"Europe/Rome"})}</p><small>{x.name} · {x.email} · {x.phone}</small><span className="admin-status">{states.find(([value])=>value===x.status)?.[1]}</span>
      {x.hold_expires_at&&["pending","approved_awaiting_payment"].includes(x.status)&&<p>Riserva fino al {new Date(x.hold_expires_at).toLocaleString("it-IT",{timeZone:"Europe/Rome"})}</p>}
      <p>{x.notes||"Nessuna nota aggiunta."}</p>{x.reference_url&&/^https?:\/\//i.test(x.reference_url)&&<a href={x.reference_url} target="_blank" rel="noopener noreferrer">Apri il riferimento</a>}
      <PaymentStatus payments={x.payments??[]}/></div><div className="admin-card-actions"><form action={updateBookingStatus}><input name="id" type="hidden" value={x.id}/><label>Stato della sessione<select name="status" defaultValue={x.status}>{states.filter(([value])=>canChangeServiceStatus("booking",x.status,value)).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button className="button button-secondary">Aggiorna stato</button></form>
      <CashServiceForm id={x.id} type="booking" status={x.status}/>
      {["pending","approved_awaiting_payment"].includes(x.status)&&<ServiceQuoteForm id={x.id} type="booking" quotes={x.service_quotes??[]} action={requestBookingPayment}/>}</div></article>)}</div>
    {!bookings.data?.length&&<div className="empty-state"><h3>Nessuna prenotazione per questa selezione.</h3></div>}
    <AdminPagination page={page} total={count??0} path="/admin/bookings" params={{status}}/>
  </>;
}
