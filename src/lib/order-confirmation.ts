import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendOrderConfirmationEmail } from "@/lib/email";

type DeliveryResult =
  | { status: "already_sent"; emailId: string | null }
  | { status: "not_ready"; emailId: null }
  | { status: "sent"; emailId: string | null };

export async function ensureOrderConfirmationEmail(
  orderId: string,
  options: { force?: boolean } = {},
): Promise<DeliveryResult> {
  const db = createSupabaseAdminClient();
  const { data: order, error } = await db
    .from("orders")
    .select("id,customer_email,customer_name,order_number,status,paid_at,total_cents,currency,confirmation_email_id,confirmation_email_sent_at,order_items(beat_title_snapshot,license_name_snapshot,unit_price_cents)")
    .eq("id", orderId)
    .single();

  if (error || !order) throw new Error(error?.message ?? "Order not found.");
  if (order.status !== "paid" || !order.paid_at) return { status: "not_ready", emailId: null };
  if (order.confirmation_email_sent_at && !options.force) {
    return { status: "already_sent", emailId: order.confirmation_email_id };
  }

  const attemptedAt = new Date().toISOString();
  await db.from("orders").update({
    confirmation_email_attempted_at: attemptedAt,
    confirmation_email_last_error: null,
  }).eq("id", order.id);

  try {
    const items = Array.isArray(order.order_items) ? order.order_items : [];
    const result = await sendOrderConfirmationEmail({
      to: order.customer_email,
      customerName: order.customer_name || "cliente",
      orderId: order.id,
      orderNumber: order.order_number,
      paidAt: new Date(order.paid_at),
      totalCents: order.total_cents,
      currency: order.currency,
      items: items.map((item) => ({
        beatTitle: item.beat_title_snapshot,
        licenseName: item.license_name_snapshot,
        unitPriceCents: item.unit_price_cents,
      })),
      idempotencyKey: options.force
        ? `order-confirmation-${order.id}-${Date.now()}`
        : `order-confirmation-${order.id}`,
    });
    const sentAt = new Date().toISOString();
    await db.from("orders").update({
      confirmation_email_id: result.emailId,
      confirmation_email_sent_at: sentAt,
      confirmation_email_last_error: null,
    }).eq("id", order.id);
    return { status: "sent", emailId: result.emailId };
  } catch (deliveryError) {
    const message = deliveryError instanceof Error ? deliveryError.message : "Unknown email delivery error";
    await db.from("orders").update({ confirmation_email_last_error: message.slice(0, 1000) }).eq("id", order.id);
    throw deliveryError;
  }
}
