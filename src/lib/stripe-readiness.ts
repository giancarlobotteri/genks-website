import "server-only";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

export const requiredStripeEvents: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired",
  "charge.refunded", "refund.created", "refund.updated", "charge.dispute.created", "charge.dispute.closed", "charge.updated",
];
const endpointUrl=()=>`${(process.env.NEXT_PUBLIC_SITE_URL??"").replace(/\/$/,"")}/api/stripe/webhook`;
function matchesEndpoint(url:string) {
  if(url===endpointUrl())return true;
  if(process.env.VERCEL_ENV!=="preview"||process.env.GENKS_SERVICE_CHECKOUT_TESTS!=="true")return false;
  try {const u=new URL(url);u.search="";return u.toString()===endpointUrl();}catch{return false;}
}
function findEndpoint(endpoints:Stripe.WebhookEndpoint[]) {
  return endpoints.find(e=>matchesEndpoint(e.url))??endpoints.find(e=>{
    try{const url=new URL(e.url);return ["www.prodbygenks.com","prodbygenks.com","genks-website.vercel.app"].includes(url.hostname)&&url.pathname.replace(/\/$/,"")==="/api/stripe/webhook"}catch{return false}
  });
}
export async function stripeReadiness() {
  if(!process.env.STRIPE_SECRET_KEY||!process.env.STRIPE_WEBHOOK_SECRET)return {ready:false,message:"Credenziali o firma del webhook mancanti."};
  try {
    const stripe=getStripe();
    const [endpoints,account]=await Promise.all([stripe.webhookEndpoints.list({limit:100}),stripe.accounts.retrieve().catch(()=>null)]);
    const endpoint=findEndpoint(endpoints.data);
    if(!endpoint)return {ready:false,accountId:account?.id,message:"Endpoint delle conferme non trovato per questo sito."};
    if(!matchesEndpoint(endpoint.url)||endpoint.status!=="enabled")return {ready:false,accountId:account?.id,message:"Il collegamento Stripe usa un indirizzo precedente o è disattivato. Aggiornalo con il pulsante qui sotto."};
    const missing=requiredStripeEvents.filter(event=>!endpoint.enabled_events.includes("*")&&!endpoint.enabled_events.includes(event));
    return missing.length?{ready:false,accountId:account?.id,message:`Eventi mancanti: ${missing.join(", ")}`}:{ready:true,accountId:account?.id,message:"Endpoint attivo e tutti gli eventi necessari configurati. La ricezione firmata va confermata con un pagamento di prova."};
  } catch { return {ready:false,message:"Verifica non riuscita. Controlla l’accesso Stripe e riprova."}; }
}
export async function configureStripeEvents() {
  const stripe=getStripe();const expected=endpointUrl();
  const endpoints=await stripe.webhookEndpoints.list({limit:100});
  const endpoint=findEndpoint(endpoints.data);
  if(!endpoint)throw new Error("Endpoint non trovato: deve essere creato nel corretto ambiente Stripe.");
  if(endpoint.enabled_events.includes("*")){await stripe.webhookEndpoints.update(endpoint.id,{url:expected,disabled:false});return;}
  const events=[...new Set([...endpoint.enabled_events,...requiredStripeEvents])];
  await stripe.webhookEndpoints.update(endpoint.id,{url:expected,disabled:false,enabled_events:events as Stripe.WebhookEndpointUpdateParams.EnabledEvent[]});
}