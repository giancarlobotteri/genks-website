import "server-only";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

export const requiredStripeEvents: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired",
  "charge.refunded", "refund.created", "refund.updated", "charge.dispute.created", "charge.dispute.closed",
];
export async function stripeReadiness() {
  if(!process.env.STRIPE_SECRET_KEY||!process.env.STRIPE_WEBHOOK_SECRET)return {ready:false,message:"Credenziali o firma del webhook mancanti."};
  try {
    const stripe=getStripe();const expected=`${process.env.NEXT_PUBLIC_SITE_URL}/api/stripe/webhook`;
    const endpoints=await stripe.webhookEndpoints.list({limit:100});
    const endpoint=endpoints.data.find(e=>e.url===expected&&e.status==="enabled");
    if(!endpoint)return {ready:false,message:"Endpoint delle conferme non trovato per questo sito."};
    const missing=requiredStripeEvents.filter(event=>!endpoint.enabled_events.includes("*")&&!endpoint.enabled_events.includes(event));
    return missing.length?{ready:false,message:`Eventi mancanti: ${missing.join(", ")}`}:{ready:true,message:"Endpoint attivo e tutti gli eventi necessari configurati."};
  } catch { return {ready:false,message:"Verifica non riuscita. Controlla l’accesso Stripe e riprova."}; }
}
export async function configureStripeEvents() {
  const stripe=getStripe();const expected=`${process.env.NEXT_PUBLIC_SITE_URL}/api/stripe/webhook`;
  const endpoints=await stripe.webhookEndpoints.list({limit:100});
  const endpoint=endpoints.data.find(e=>e.url===expected&&e.status==="enabled");
  if(!endpoint)throw new Error("Endpoint non trovato: deve essere creato nel corretto ambiente Stripe.");
  if(endpoint.enabled_events.includes("*"))return;
  const events=[...new Set([...endpoint.enabled_events,...requiredStripeEvents])];
  await stripe.webhookEndpoints.update(endpoint.id,{enabled_events:events as Stripe.WebhookEndpointUpdateParams.EnabledEvent[]});
}
