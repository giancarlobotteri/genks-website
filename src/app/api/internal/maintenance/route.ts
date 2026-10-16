import { timingSafeEqual } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { flushNotifications } from "@/lib/notifications";
import { ensureOrderConfirmationEmail } from "@/lib/order-confirmation";
import { handleStripeEvent, syncPendingStripeFees } from "@/lib/stripe-events";
import { getStripe } from "@/lib/stripe";

export const runtime="nodejs";
export const maxDuration=120;
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  const expected=process.env.CRON_SECRET;
  const provided=request.headers.get("authorization")?.replace(/^Bearer /,"")??"";
  if(!expected||Buffer.byteLength(expected)!==Buffer.byteLength(provided)||!timingSafeEqual(Buffer.from(expected),Buffer.from(provided)))return new Response("Non autorizzato",{status:401});
  const db=createSupabaseAdminClient();
  const {data:events,error:eventError}=await db.from("stripe_event_log").select("id").not("last_error","is",null).order("created_at").limit(10);
  if(eventError)return Response.json({error:"Eventi da verificare"},{status:503});
  let eventFailures=0;
  for(const event of events??[]){try{const result=await handleStripeEvent(await getStripe().events.retrieve(event.id));if(!result.ok)eventFailures++}catch{eventFailures++}}
  const expired=await db.rpc("expire_booking_holds");
  if(expired.error)return Response.json({error:"Scadenze da ripetere"},{status:503});
  const {data:orders,error}=await db.from("orders").select("id").eq("status","paid").is("confirmation_email_sent_at",null).order("created_at").limit(20);
  if(error)return Response.json({error:"Ordini da verificare"},{status:503});
  let orderFailures=0;
  for(const order of orders??[]){try{await ensureOrderConfirmationEmail(order.id)}catch{orderFailures++}await new Promise(resolve=>setTimeout(resolve,550));}
  const notifications=await flushNotifications({limit:80});
  const fees=await syncPendingStripeFees();
  const result={expiredHolds:expired.data,ordersChecked:orders?.length??0,orderFailures,eventFailures,feesChecked:fees.checked,feeFailures:fees.failures,...notifications};
  const saved=await db.from("site_settings").upsert({key:"maintenance",value:{...result,last_run:new Date().toISOString()},updated_at:new Date().toISOString()});
  return Response.json(result,{status:saved.error||orderFailures||eventFailures||notifications.failures||fees.failures?503:200});
}
