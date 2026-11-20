import { getStripe } from "@/lib/stripe";
import { handleStripeEvent } from "@/lib/stripe-events";
import { cinematicSandboxConfigured } from "@/lib/cinematic-sandbox";
export const runtime="nodejs";
export async function POST(request:Request) {
  const signature=request.headers.get("stripe-signature");
  if(!signature)return new Response("Firma mancante",{status:400});
  if(!process.env.STRIPE_WEBHOOK_SECRET)return new Response("Webhook non configurato",{status:503});
  let event;
  try{event=getStripe().webhooks.constructEvent(await request.text(),signature,process.env.STRIPE_WEBHOOK_SECRET)}
  catch{return new Response("Firma non valida",{status:400})}
  if (process.env.VERCEL_ENV === 'preview' &&
      process.env.GENKS_CINEMATIC_SANDBOX === 'true' &&
      (event.livemode || !cinematicSandboxConfigured())) {
    return new Response("Sandbox non configurata",{status:503});
  }
  return handleStripeEvent(event);
}
