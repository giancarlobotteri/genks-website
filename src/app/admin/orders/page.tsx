import { BadgeCheck, ReceiptText } from "lucide-react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatPrice } from "@/lib/format";
import { retryOrderConfirmation } from "../actions";

export default async function Orders({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const query = await searchParams;
  const db = createSupabaseAdminClient();
  const { data } = await db.from("orders")
    .select("id,order_number,customer_email,customer_name,status,total_cents,currency,paid_at,created_at,confirmation_email_sent_at,confirmation_email_last_error,order_items(beat_title_snapshot,license_name_snapshot)")
    .order("created_at", { ascending: false }).limit(100);
  const orders = data ?? [];
  const emailReady = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
  return <><header className="admin-heading"><span className="eyebrow">ORDERS & DELIVERY</span><h1>Orders</h1><p>Payment and delivery states come from verified Stripe events. An email can be retried after fixing its configuration.</p></header>
    {!emailReady && <p className="notice error" role="alert">Email sending is unavailable: configure RESEND_API_KEY and RESEND_FROM_EMAIL on the deployed project, then redeploy.</p>}
    {query.email === "failed" && <p className="notice error" role="alert">The email could not be delivered. See the error on the order below.</p>}
    {query.email === "sent" && <p className="notice success" role="status">Order email sent or already delivered.</p>}
    {query.email === "not_allowed" && <p className="notice error" role="alert">This order is not eligible for a private test email.</p>}
    {orders.length ? <div className="verified-order-list">{orders.map((order) => <article key={order.id}>
      <div className="verified-order-icon">{order.status === "paid" ? <BadgeCheck /> : <ReceiptText />}</div>
      <div><strong>{order.order_number}</strong><small>{order.customer_name || "Customer"} · {order.customer_email}</small><small>{order.status.toUpperCase()} · {order.currency}</small></div>
      <div className="verified-order-items">{order.order_items?.map((item) => <span key={`${order.id}-${item.beat_title_snapshot}-${item.license_name_snapshot}`}>{item.beat_title_snapshot}<small>{item.license_name_snapshot}</small></span>)}</div>
      <div><strong>{formatPrice(order.total_cents)}</strong><small>{new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.paid_at ?? order.created_at))}</small>
        {order.status === "paid" && <><small>Email: {order.confirmation_email_sent_at ? "sent" : "pending / failed"}</small>
          {order.confirmation_email_last_error && <small role="alert">{order.confirmation_email_last_error}</small>}
          {!order.confirmation_email_sent_at && <form action={retryOrderConfirmation}><input type="hidden" name="id" value={order.id}/><button className="button button-secondary" type="submit">RETRY EMAIL</button></form>}</>}
      </div>
    </article>)}</div> : <div className="empty-state"><ReceiptText size={30}/><h3>No orders yet.</h3></div>}
  </>;
}
