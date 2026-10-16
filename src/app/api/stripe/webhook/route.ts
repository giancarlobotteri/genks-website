import { getStripe } from "@/lib/stripe";
import { handleStripeEvent } from "@/lib/stripe-events";
export const runtime="nodejs";
export async function POST(request:Request) {
  const signature=request.headers.get("stripe-signature");
  if(!signature||!process.env.STRIPE_WEBHOOK_SECRET)return new Response("Webhook non configurato",{status:503});
  let event;
  try{event=getStripe().webhooks.constructEvent(await request.text(),signature,process.env.STRIPE_WEBHOOK_SECRET)}
  catch{return new Response("Firma non valida",{status:400})}
  return handleStripeEvent(event);
}
