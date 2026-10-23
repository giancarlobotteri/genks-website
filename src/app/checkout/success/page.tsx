import { getStripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ReservationSuccess } from "@/components/services/reservation-success";
import { PaymentPending } from "@/components/services/payment-pending";
import Link from "next/link";

export default async function SuccessPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q=await searchParams;
  if(typeof q.service_session==="string"){
    const result=await confirmedService(q.service_session);
    return result?<ReservationSuccess reference={result.reference} project={result.project} paid/>:<PaymentPending/>;
  }
  if (typeof q.remote_session === "string") {
    // A success URL alone is never proof of payment. Read the Stripe session and
    // the quote settled by the signed webhook before displaying confirmation.
    if (!/^cs_(test_|live_)?[A-Za-z0-9_]{10,250}$/.test(q.remote_session)) return <PaymentPending />;
    const reference = await remotePaymentReference(q.remote_session);
    return reference ? <ReservationSuccess reference={reference} project paid /> : <PaymentPending />;
  }
  const service=Boolean(q.booking||q.project);
  const destination=q.booking?"/account/bookings":q.project?"/account/projects":"/account/library";
  return <div className="portal-shell narrow-shell"><span className="eyebrow">VERIFICA DEL PAGAMENTO</span><h1>{service?"Il prossimo passo è confermato via email.":"Il tuo prossimo suono ti aspetta."}</h1><p className="muted">La conferma definitiva arriva dopo la verifica di Stripe. {service?"La tua richiesta si aggiornerà nell’area cliente.":"I file si sbloccano nella raccolta dopo il pagamento confermato."} Accedi usando la stessa email inserita al pagamento. Se l’aggiornamento tarda, controlla l’email prima di ripetere l’acquisto.</p><Link className="button button-primary" href={destination}>{service?"APRI LE TUE RICHIESTE":"APRI LA RACCOLTA"}</Link></div>;
}

async function remotePaymentReference(sessionId: string): Promise<string | null> {
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.metadata?.payment_type !== "remote_project" || session.payment_status !== "paid") return null;
    const db = createSupabaseAdminClient();
    const { data: quote } = await db.from("service_quotes").select("status,project_id,service_projects(reference)")
      .eq("id", session.metadata.quote_id).eq("stripe_session_id", session.id).eq("fixed_price", true).single();
    const project = Array.isArray(quote?.service_projects) ? quote.service_projects[0] : quote?.service_projects;
    if (!quote || quote.status !== "paid" || !project?.reference) return null;
    const { data: payment } = await db.from("payments").select("status,refunded_cents,disputed,review_reason")
      .eq("quote_id", session.metadata.quote_id).eq("livemode", session.livemode).maybeSingle();
    if (!payment || payment.status !== "succeeded" || payment.refunded_cents > 0 || payment.disputed || payment.review_reason) return null;
    return project.reference;
  } catch { return null; }
}

async function confirmedService(id:string):Promise<{reference:string;project:boolean}|null>{
 if(!/^cs_(test_|live_)?[A-Za-z0-9_]{10,250}$/.test(id))return null;
 try{const session=await getStripe().checkout.sessions.retrieve(id);if(session.payment_status!=="paid"||!session.metadata?.quote_id)return null;
 const db=createSupabaseAdminClient();const q=await db.from("service_quotes").select("id,status,booking_id,project_id").eq("id",session.metadata.quote_id).eq("stripe_session_id",session.id).single();if(q.error||q.data.status!=="paid")return null;
 const paid=await db.from("payments").select("status,review_reason,disputed,refunded_cents").eq("quote_id",q.data.id).eq("livemode",session.livemode).single();if(paid.error||paid.data.status!=="succeeded"||paid.data.review_reason||paid.data.disputed||paid.data.refunded_cents>0)return null;
 const project=Boolean(q.data.project_id);const target=await db.from(project?"service_projects":"bookings").select("reference").eq("id",q.data.project_id??q.data.booking_id).single();return target.error?null:{reference:target.data.reference,project};
 }catch{return null;}
}
