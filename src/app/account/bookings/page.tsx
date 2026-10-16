import { italianLabel } from "@/lib/italian";
import { claimGuestPurchases } from "@/lib/claim-guest-purchases";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export default async function BookingsPage() {
  const user=await claimGuestPurchases();const db=await createSupabaseServerClient();
  const {data,error}=await db.from("bookings").select("id,reference,starts_at,ends_at,status").eq("customer_id",user.id).order("starts_at",{ascending:false});
  if(error)throw new Error("Impossibile leggere le prenotazioni.");
  return <section className="portal-panel"><div className="panel-heading"><h2>Prenotazioni</h2></div><div className="data-list">{data?.map(x=><article key={x.id}><div><strong>{x.reference}</strong><small>{new Date(x.starts_at).toLocaleString("it-IT",{timeZone:"Europe/Rome"})} → {new Date(x.ends_at).toLocaleString("it-IT",{timeZone:"Europe/Rome"})}</small><small>Orari italiani · Europe/Rome</small></div><span>{italianLabel(x.status)}</span></article>)}{!data?.length&&<p className="muted">Non hai ancora richieste di prenotazione.</p>}</div></section>;
}
