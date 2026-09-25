import { BadgeCheck, ReceiptText } from "lucide-react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatPrice } from "@/lib/format";

export default async function Orders() {
  const db = createSupabaseAdminClient();
  const { data } = await db.from("orders")
    .select("id,order_number,customer_email,customer_name,total_cents,currency,paid_at,stripe_payment_intent_id,order_items(beat_title_snapshot,license_name_snapshot),payments!inner(id,status,provider)")
    .eq("status", "paid").eq("payments.status", "succeeded").eq("payments.provider", "stripe").not("paid_at", "is", null).not("stripe_payment_intent_id", "is", null).order("paid_at", { ascending: false });
  const orders = data ?? [];
  return <><header className="admin-heading"><span className="eyebrow">VERIFIED STRIPE PAYMENTS</span><h1>Orders</h1><p>Only purchases confirmed as paid by the signed Stripe webhook are shown here. Pending, failed and demo records are excluded.</p></header>
    {orders.length ? <div className="verified-order-list">{orders.map((order) => <article key={order.id}><div className="verified-order-icon"><BadgeCheck /></div><div><strong>{order.order_number}</strong><small>{order.customer_name || "Customer"} · {order.customer_email}</small></div><div className="verified-order-items">{order.order_items.map((item) => <span key={`${order.id}-${item.beat_title_snapshot}-${item.license_name_snapshot}`}>{item.beat_title_snapshot}<small>{item.license_name_snapshot}</small></span>)}</div><div><strong>{formatPrice(order.total_cents)}</strong><small>{new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.paid_at!))}</small></div></article>)}</div> : <div className="empty-state"><ReceiptText size={30} /><h3>No verified purchases yet.</h3><p>A real order will appear only after Stripe confirms the payment.</p></div>}
  </>;
}
