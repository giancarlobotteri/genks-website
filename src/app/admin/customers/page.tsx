import { Mail, ReceiptText, ShoppingBag, Users } from "lucide-react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatPrice } from "@/lib/format";

type PaidOrder = {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_email: string;
  customer_name: string | null;
  total_cents: number;
  paid_at: string | null;
  created_at: string;
  order_items: Array<{ beat_title_snapshot: string; license_name_snapshot: string }>;
};

type Profile = { id: string; display_name: string | null; artist_name: string | null; phone: string | null; segment: string; marketing_consent: boolean };

export default async function Customers() {
  const db = createSupabaseAdminClient();
  const [{ data: orderRows }, { data: profileRows }] = await Promise.all([
    db.from("orders").select("id,order_number,customer_id,customer_email,customer_name,total_cents,paid_at,created_at,order_items(beat_title_snapshot,license_name_snapshot)").eq("status", "paid").order("paid_at", { ascending: false }),
    db.from("profiles").select("id,display_name,artist_name,phone,segment,marketing_consent"),
  ]);
  const profiles = new Map(((profileRows as Profile[] | null) ?? []).map((profile) => [profile.id, profile]));
  const purchasers = new Map<string, { email: string; name: string; phone: string | null; segment: string; marketing: boolean; total: number; orders: PaidOrder[] }>();

  for (const order of ((orderRows as PaidOrder[] | null) ?? [])) {
    const key = order.customer_email.toLocaleLowerCase();
    const profile = order.customer_id ? profiles.get(order.customer_id) : undefined;
    const current = purchasers.get(key) ?? {
      email: order.customer_email,
      name: profile?.artist_name || profile?.display_name || order.customer_name || "Customer",
      phone: profile?.phone ?? null,
      segment: profile?.segment ?? "GUEST_CUSTOMER",
      marketing: profile?.marketing_consent ?? false,
      total: 0,
      orders: [],
    };
    current.total += order.total_cents;
    current.orders.push(order);
    purchasers.set(key, current);
  }

  const customers = [...purchasers.values()].sort((a, b) => b.total - a.total);
  const revenue = customers.reduce((sum, customer) => sum + customer.total, 0);
  const orderCount = customers.reduce((sum, customer) => sum + customer.orders.length, 0);

  return <>
    <header className="admin-heading"><span className="eyebrow">PAID CUSTOMERS</span><h1>Customers</h1><p>People who completed at least one purchase, including guest checkout customers.</p></header>
    <div className="customer-metrics">
      <article><Users /><span>Purchasers</span><strong>{customers.length}</strong></article>
      <article><ReceiptText /><span>Paid orders</span><strong>{orderCount}</strong></article>
      <article><ShoppingBag /><span>Customer revenue</span><strong>{formatPrice(revenue)}</strong></article>
    </div>
    {customers.length ? <div className="purchaser-list">{customers.map((customer) => {
      const latest = customer.orders[0];
      return <details className="purchaser-card" key={customer.email}>
        <summary>
          <span className="purchaser-avatar">{customer.name.slice(0, 1).toUpperCase()}</span>
          <span><strong>{customer.name}</strong><small><Mail size={13} />{customer.email}</small></span>
          <span><small>ORDERS</small><strong>{customer.orders.length}</strong></span>
          <span><small>TOTAL SPENT</small><strong>{formatPrice(customer.total)}</strong></span>
          <span><small>LAST PURCHASE</small><strong>{new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(latest.paid_at ?? latest.created_at))}</strong></span>
        </summary>
        <div className="purchaser-details">
          <div className="purchaser-profile"><span>{customer.segment.replaceAll("_", " ")}</span><span>{customer.marketing ? "Marketing opt-in" : "Transactional only"}</span>{customer.phone ? <span>{customer.phone}</span> : null}</div>
          <div className="purchaser-orders">{customer.orders.map((order) => <article key={order.id}>
            <div><strong>{order.order_number}</strong><small>{new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.paid_at ?? order.created_at))}</small></div>
            <div>{order.order_items.map((item) => <span key={`${order.id}-${item.beat_title_snapshot}-${item.license_name_snapshot}`}><strong>{item.beat_title_snapshot}</strong><small>{item.license_name_snapshot}</small></span>)}</div>
            <strong>{formatPrice(order.total_cents)}</strong>
          </article>)}</div>
        </div>
      </details>;
    })}</div> : <div className="empty-state"><Users size={30} /><h3>No paid customers yet.</h3><p>Completed Stripe purchases will appear here automatically.</p></div>}
  </>;
}
