import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendOrderConfirmationEmail, sendTransactionalEmail } from "@/lib/email";
import { createBookingCalendarEvent, createProjectDeadlineEvent } from "@/lib/google-calendar";

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
      const { data: order } = await db.from("orders").select("id,customer_id,customer_email,customer_name,order_number,created_at,currency,order_items(id,beat_id,license_type_id,beat_title_snapshot,license_name_snapshot,unit_price_cents)").eq("id", orderId).single();
      if (order) {
        const { data: transitioned } = await db.from("orders").update({ status: "paid", paid_at: new Date().toISOString(), stripe_payment_intent_id: String(session.payment_intent ?? "") }).eq("id", order.id).neq("status", "paid").select("id").maybeSingle();
        await db.from("payments").upsert({ order_id: order.id, provider_payment_id: String(session.payment_intent ?? session.id), amount_cents: session.amount_total ?? 0, currency: session.currency?.toUpperCase() ?? "EUR", status: "succeeded", raw_event_id: event.id }, { onConflict: "provider_payment_id" });
        const items = Array.isArray(order.order_items) ? order.order_items : [];
        if (items.length) await db.from("entitlements").upsert(items.map((item) => ({ customer_id: order.customer_id, customer_email: order.customer_email, order_item_id: item.id, beat_id: item.beat_id, license_type_id: item.license_type_id })), { onConflict: "order_item_id" });
        if (transitioned) await sendOrderConfirmationEmail({
          to: order.customer_email,
          customerName: order.customer_name,
          orderId: order.id,
          orderNumber: order.order_number,
          paidAt: new Date(),
          totalCents: session.amount_total ?? 0,
          currency: session.currency?.toUpperCase() ?? order.currency ?? "EUR",
          items: items.map((item) => ({ beatTitle: item.beat_title_snapshot, licenseName: item.license_name_snapshot, unitPriceCents: item.unit_price_cents })),
        });
      }
    }
    const bookingId=session.metadata?.booking_id;const projectId=session.metadata?.project_id;
    if(session.payment_status==="paid"&&(bookingId||projectId)){
      const providerPaymentId=String(session.payment_intent??session.id);
      const {error:paymentError}=await db.from("payments").upsert({booking_id:bookingId??null,project_id:projectId??null,provider_payment_id:providerPaymentId,amount_cents:session.amount_total??0,currency:session.currency?.toUpperCase()??"EUR",status:"succeeded",raw_event_id:event.id},{onConflict:"provider_payment_id"});
      if(!paymentError&&bookingId){
        const{data}=await db.from("bookings").update({status:"confirmed",updated_at:new Date().toISOString()}).eq("id",bookingId).neq("status","confirmed").select("id,email,reference,starts_at,ends_at,google_calendar_event_id").maybeSingle();
        const{data:booking}=data?{data}:await db.from("bookings").select("id,email,reference,starts_at,ends_at,google_calendar_event_id").eq("id",bookingId).single();
        if(booking&&!booking.google_calendar_event_id){const eventId=await createBookingCalendarEvent({id:booking.id,reference:booking.reference,startsAt:booking.starts_at,endsAt:booking.ends_at});if(eventId)await db.from("bookings").update({google_calendar_event_id:eventId}).eq("id",booking.id);}
        if(data)await sendTransactionalEmail({to:data.email,subject:`GENKS booking ${data.reference} confirmed`,heading:"Your session is confirmed.",body:"Payment received. Your recording session is now confirmed in the GENKS calendar."});
      }
      if(!paymentError&&projectId){
        const{data}=await db.from("service_projects").update({status:"paid",updated_at:new Date().toISOString()}).eq("id",projectId).neq("status","paid").select("id,email,reference,service,desired_deadline,google_calendar_event_id").maybeSingle();
        const{data:project}=data?{data}:await db.from("service_projects").select("id,email,reference,service,desired_deadline,google_calendar_event_id").eq("id",projectId).single();
        if(project?.desired_deadline&&!project.google_calendar_event_id){const eventId=await createProjectDeadlineEvent({id:project.id,reference:project.reference,service:project.service,deadline:project.desired_deadline});if(eventId)await db.from("service_projects").update({google_calendar_event_id:eventId}).eq("id",project.id);}
        if(data)await sendTransactionalEmail({to:data.email,subject:`GENKS project ${data.reference} paid`,heading:"Your project is moving forward.",body:"Payment received. GENKS can now start working on your project."});
      }
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
