import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureOrderConfirmationEmail } from "@/lib/order-confirmation";
import { flushNotifications, queueNotification } from "@/lib/notifications";
import { stripeTestMode } from "@/lib/preview-mode";
import { syncPaymentCalendar } from "@/lib/payment-calendar";

import "server-only";
const objectId = (value: string | { id: string } | null) => typeof value === "string" ? value : value?.id;

export async function syncStripeChargeFee(chargeId:string) {
  const charge=await getStripe().charges.retrieve(chargeId,{expand:["balance_transaction"]});
  const intent=objectId(charge.payment_intent);
  const balance=typeof charge.balance_transaction==="object"?charge.balance_transaction:null;
  if(!intent||!balance)return;
  const db=createSupabaseAdminClient();
  const {error}=await db.from("payments").update({fee_cents:balance.fee}).eq("provider_payment_id",intent).eq("livemode",charge.livemode).eq("currency",balance.currency.toUpperCase());
  if(error)throw new Error("Commissioni da aggiornare.");
}

export async function syncPendingStripeFees() {
  const db=createSupabaseAdminClient();
  const {data,error}=await db.from("payments").select("provider_payment_id").eq("livemode",!stripeTestMode()).is("fee_cents",null).like("provider_payment_id","pi_%").order("paid_at").limit(20);
  if(error)throw new Error("Impossibile leggere le commissioni da aggiornare.");
  let failures=0;
  for(const payment of data??[]){try{const intent=await getStripe().paymentIntents.retrieve(payment.provider_payment_id);const chargeId=objectId(intent.latest_charge);if(chargeId)await syncStripeChargeFee(chargeId)}catch{failures++}}
  return {checked:data?.length??0,failures};
}

async function recordRefunds(charge: Stripe.Charge) {
  const db = createSupabaseAdminClient();
  const intent = objectId(charge.payment_intent);
  if (!intent) return;
  for await (const refund of getStripe().refunds.list({ charge: charge.id, limit: 100 })) {
    if (refund.status !== "succeeded") continue;
    const { error } = await db.rpc("record_stripe_refund", {
      p_payment: intent, p_refund: refund.id, p_amount: refund.amount,
      p_at: new Date(refund.created * 1000).toISOString(),
    });
    if (error) throw new Error("Registrazione rimborso da ripetere.");
    await flushNotifications({prefix:`refund-${refund.id}`,throwOnFailure:true});
  }
  const known=await db.from("payments").select("id").eq("provider_payment_id",intent).single();
  if(known.error||!known.data)throw new Error("Calendario del rimborso da verificare.");
  await syncPaymentCalendar(known.data.id);
}

async function syncDispute(intent:string,blocked:boolean) {
  const result=await createSupabaseAdminClient().rpc("record_stripe_dispute",{p_payment:intent,p_blocked:blocked});
  if(result.error)throw new Error("Contestazione da registrare.");
  return result.data;
}

async function fulfil(session: Stripe.Checkout.Session, event: Stripe.Event) {
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return;
  const orderId = session.metadata?.order_id;
  const quoteId = session.metadata?.quote_id;
  if (!orderId && !quoteId) {
    if (session.metadata?.booking_id || session.metadata?.project_id)
      throw new Error("Link precedente alla nuova gestione: verifica manuale necessaria.");
    return;
  }
  const intentId = objectId(session.payment_intent);
  if (session.amount_total === null || !session.currency) throw new Error("Dati del pagamento incompleti.");
  const db = createSupabaseAdminClient();
  const { data: paymentId, error } = await db.rpc("fulfil_stripe_checkout", {
    p_session: session.id, p_payment: intentId ?? session.id, p_amount: session.amount_total,
    p_currency: session.currency, p_live: session.livemode, p_event: event.id,
    p_paid_at: new Date(event.created * 1000).toISOString(), p_order: orderId ?? null, p_quote: quoteId ?? null,
  });
  if (error || !paymentId) throw new Error("Pagamento non abbinato o registrazione incompleta. Verifica ordine e preventivo.");

  if (intentId) {
    const intent = await getStripe().paymentIntents.retrieve(intentId, { expand: ["latest_charge.balance_transaction"] });
    const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
    if (charge) {
      if (charge.amount_refunded) await recordRefunds(charge);
      if(charge.disputed){
        const disputes=await getStripe().disputes.list({charge:charge.id,limit:100});
        await syncDispute(intentId,disputes.data.some(d=>d.status!=="won"&&d.status!=="warning_closed"));
      }
      const balance = typeof charge.balance_transaction === "object" ? charge.balance_transaction : null;
      if (balance && balance.currency.toLowerCase() === session.currency.toLowerCase()) {
        const saved = await db.from("payments").update({ fee_cents: balance.fee }).eq("id", paymentId);
        if (saved.error) throw new Error("Commissioni da registrare.");
      }
    }
  }
  if(!intentId&&session.amount_total===0){const saved=await db.from("payments").update({fee_cents:0}).eq("id",paymentId);if(saved.error)throw new Error("Pagamento gratuito da aggiornare.");}
  await syncPaymentCalendar(paymentId);
  const { data: payment, error: readError } = await db.from("payments").select("review_reason,refunded_cents,amount_cents,disputed").eq("id", paymentId).single();
  if (readError || !payment) throw new Error("Impossibile verificare lo stato finale del pagamento.");
  if (payment.review_reason && process.env.GENKS_ADMIN_EMAIL) {
    await queueNotification(`payment-review-${paymentId}`, {
      to: process.env.GENKS_ADMIN_EMAIL, subject: "GENKS · pagamento da verificare", heading: "Pagamento da verificare.",
      body: payment.review_reason, actionUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/analytics`, actionLabel: "Apri Vendite",
    });
    await flushNotifications({ prefix: `payment-review-${paymentId}`, throwOnFailure: true });
  }
  if (orderId && (payment.amount_cents===0 || payment.refunded_cents < payment.amount_cents) && !payment.disputed)
    await ensureOrderConfirmationEmail(orderId);
  if (quoteId) {
    if (payment.refunded_cents >= payment.amount_cents || payment.disputed) {
      const result = await db.from("notification_outbox").update({ cancelled_at: new Date().toISOString(), last_error: "Superata dal rimborso o dalla contestazione." }).eq("dedupe_key", `payment-${paymentId}`).is("sent_at", null);
      if (result.error) throw new Error("Notifica da aggiornare.");
    } else await flushNotifications({ prefix: `payment-${paymentId}`, throwOnFailure: true });
  }
}

// Only signature-verified events or events retrieved by the authenticated server.
export async function handleStripeEvent(event: Stripe.Event) {
  if (event.livemode === stripeTestMode()) return new Response("Ambiente non corrispondente", { status: 400 });
  const db = createSupabaseAdminClient();
  const registered = await db.from("stripe_event_log").upsert({ id: event.id, event_type: event.type, livemode: event.livemode }, { onConflict: "id", ignoreDuplicates: true });
  if (registered.error) return new Response("Registrazione evento non disponibile", { status: 503 });
  try {
    if(event.type==="charge.updated")await syncStripeChargeFee(event.data.object.id);
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") await fulfil(event.data.object, event);
    if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object;
      if (session.metadata?.order_id) {
        const result = await db.from("orders").update({ status: event.type === "checkout.session.expired" ? "cancelled" : "failed" })
          .eq("id", session.metadata.order_id).eq("stripe_checkout_session_id", session.id).eq("status", "pending");
        if (result.error) throw new Error("Stato ordine da aggiornare.");
      }
      if (session.metadata?.quote_id) {
        const result = await db.from("service_quotes").update({ status: "expired" }).eq("id", session.metadata.quote_id).eq("stripe_session_id", session.id).in("status", ["creating", "open"]);
        if (result.error) throw new Error("Preventivo da aggiornare.");
      }
    }
    if (event.type === "charge.refunded" || event.type === "refund.updated" || event.type === "refund.created") {
      const chargeId = event.type === "charge.refunded" ? event.data.object.id : objectId(event.data.object.charge);
      if (chargeId) {
        const charge = await getStripe().charges.retrieve(chargeId);
        const intent = objectId(charge.payment_intent);
        if (intent) {
          const existing = await db.from("payments").select("id").eq("provider_payment_id", intent).maybeSingle();
          if (existing.error) throw new Error("Lettura pagamento non disponibile.");
          if (!existing.data) {
            const sessions = await getStripe().checkout.sessions.list({ payment_intent: intent, limit: 1 });
            if (sessions.data[0]) await fulfil(sessions.data[0], event);
          }
          const known = await db.from("payments").select("id").eq("provider_payment_id", intent).maybeSingle();
          if (known.error) throw new Error("Lettura pagamento non disponibile.");
          if (known.data) await recordRefunds(charge);
        }
      }
    }
    if (event.type === "charge.dispute.created" || event.type === "charge.dispute.closed") {
      const dispute = await getStripe().disputes.retrieve(event.data.object.id);
      const intent = objectId(dispute.payment_intent);
      if (intent) {
        const blocked = dispute.status !== "won"&&dispute.status!=="warning_closed";
        let paymentId=await syncDispute(intent,blocked);
        if(!paymentId){const sessions=await getStripe().checkout.sessions.list({payment_intent:intent,limit:1});if(sessions.data[0])await fulfil(sessions.data[0],event);paymentId=await syncDispute(intent,blocked);}
        if(paymentId&&blocked&&process.env.GENKS_ADMIN_EMAIL){
          await queueNotification(`dispute-${dispute.id}`,{to:process.env.GENKS_ADMIN_EMAIL,subject:"GENKS · contestazione di pagamento",heading:"Contestazione Stripe da gestire.",body:"Apri la dashboard Stripe per verificare la contestazione, la scadenza e le prove richieste. Gli accessi al beat sono stati sospesi in attesa dell’esito."});
          await flushNotifications({prefix:`dispute-${dispute.id}`,throwOnFailure:true});
        }
      }
    }
    const saved = await db.from("stripe_event_log").update({ processed_at: new Date().toISOString(), last_error: null }).eq("id", event.id);
    if (saved.error) throw new Error("Evento da confermare.");
    return Response.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Elaborazione da ripetere.";
    await db.from("stripe_event_log").update({ last_error: message.slice(0, 500) }).eq("id", event.id);
    console.error("Stripe event requires retry", event.id, event.type);
    return Response.json({ error: "Elaborazione non completata. Stripe deve ritentare l’evento." }, { status: 500 });
  }
}
