import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET)
    return new Response("Webhook not configured", { status: 503 });
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(), signature, process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  const db = createSupabaseAdminClient();
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object;
    const orderId = session.metadata?.order_id;
    if (orderId && session.payment_status === "paid") {
      const { data: order } = await db.from("orders").select("id,customer_id,customer_email,order_number,order_items(id,beat_id,license_type_id)").eq("id", orderId).single();
      if (order) {
        const { data: transitioned } = await db.from("orders").update({ status: "paid", paid_at: new Date().toISOString(), stripe_payment_intent_id: String(session.payment_intent ?? "") }).eq("id", order.id).neq("status", "paid").select("id").maybeSingle();
        await db.from("payments").upsert({ order_id: order.id, provider_payment_id: String(session.payment_intent ?? session.id), amount_cents: session.amount_total ?? 0, currency: session.currency?.toUpperCase() ?? "EUR", status: "succeeded", raw_event_id: event.id }, { onConflict: "provider_payment_id" });
        const items = Array.isArray(order.order_items) ? order.order_items : [];
        if (items.length) await db.from("entitlements").upsert(items.map((item) => ({ customer_id: order.customer_id, customer_email: order.customer_email, order_item_id: item.id, beat_id: item.beat_id, license_type_id: item.license_type_id })), { onConflict: "order_item_id" });
        if (transitioned) await sendTransactionalEmail({ to: order.customer_email, subject: `GENKS order ${order.order_number} confirmed`, heading: "Your sound is ready.", body: "Payment confirmed. Sign in with the same email to access your licensed files in the GENKS Library.", actionUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/account/library`, actionLabel: "Open Library" });
      }
    }
    const bookingId=session.metadata?.booking_id;const projectId=session.metadata?.project_id;
    if(session.payment_status==="paid"&&(bookingId||projectId)){
      const providerPaymentId=String(session.payment_intent??session.id);
      const {error:paymentError}=await db.from("payments").upsert({booking_id:bookingId??null,project_id:projectId??null,provider_payment_id:providerPaymentId,amount_cents:session.amount_total??0,currency:session.currency?.toUpperCase()??"EUR",status:"succeeded",raw_event_id:event.id},{onConflict:"provider_payment_id"});
      if(!paymentError&&bookingId){const{data}=await db.from("bookings").update({status:"confirmed",updated_at:new Date().toISOString()}).eq("id",bookingId).neq("status","confirmed").select("email,reference").maybeSingle();if(data)await sendTransactionalEmail({to:data.email,subject:`GENKS booking ${data.reference} confirmed`,heading:"Your session is confirmed.",body:"Payment received. Your recording session is now confirmed in the GENKS calendar."});}
      if(!paymentError&&projectId){const{data}=await db.from("service_projects").update({status:"paid",updated_at:new Date().toISOString()}).eq("id",projectId).neq("status","paid").select("email,reference").maybeSingle();if(data)await sendTransactionalEmail({to:data.email,subject:`GENKS project ${data.reference} paid`,heading:"Your project is moving forward.",body:"Payment received. GENKS can now start working on your project."});}
    }
  }
  if (event.type === "checkout.session.async_payment_failed") {
    const orderId = event.data.object.metadata?.order_id;
    if (orderId) await db.from("orders").update({ status: "failed" }).eq("id", orderId);
  }
  if (event.type === "charge.refunded") {
    const paymentIntent = String(event.data.object.payment_intent ?? "");
    await db.from("orders").update({ status: "refunded", refunded_at: new Date().toISOString() }).eq("stripe_payment_intent_id", paymentIntent);
  }
  return Response.json({ received: true });
}
