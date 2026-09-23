import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/format";

export default async function OrdersPage() {
  const user = await requireUser(); const db = await createSupabaseServerClient();
  const { data } = await db.from("orders").select("id,order_number,status,total_cents,created_at,order_items(beat_title_snapshot,license_name_snapshot)").eq("customer_id", user.id).order("created_at", { ascending: false });
  return <section className="portal-panel"><div className="panel-heading"><h2>Orders</h2></div><div className="data-list">{data?.map((order) => <article key={order.id}><div><strong>{order.order_number}</strong><small>{new Date(order.created_at).toLocaleDateString("it-IT")} · {order.status}</small></div><span>{formatPrice(order.total_cents)}</span></article>)}{!data?.length && <p className="muted">No orders yet.</p>}</div></section>;
}
