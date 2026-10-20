import { requireAdmin } from "@/lib/auth";
import { AdminPagination, pageNumber } from "@/components/admin/pagination";
import { italianLabel } from "@/lib/italian";
import { BadgeCheck, ReceiptText } from "lucide-react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatPrice } from "@/lib/format";
import { retryOrderConfirmation } from "../actions";

export default async function Orders({ searchParams }: { searchParams: Promise<{ email?: string; page?: string }> }) {
  await requireAdmin();
  const query = await searchParams;
  const db = createSupabaseAdminClient();
  const {count} = await db.from("orders").select("id", {count:"exact",head:true});
  const page = Math.min(pageNumber(query.page), Math.max(1,Math.ceil((count ?? 0)/5)));
  const { data, error } = await db.from("orders")
    .select("id,order_number,customer_email,customer_name,status,total_cents,currency,paid_at,created_at,confirmation_email_sent_at,confirmation_email_last_error,order_items(beat_title_snapshot,license_name_snapshot)")
    .order("created_at", { ascending: false }).order("id").range((page-1)*5,page*5-1);
  if(error) throw new Error("Impossibile caricare gli ordini.");
  const orders = data ?? [];
  const emailReady = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
  return <><header className="admin-heading"><span className="eyebrow">ORDINI E CONSEGNE</span><h1>Ordini</h1><p>Gli stati di pagamento e consegna derivano dalle conferme verificate di Stripe. Puoi ritentare l’invio di un’email dopo aver corretto la configurazione.</p></header>
    {!emailReady && <p className="notice error" role="alert">L’invio delle email non è disponibile: configura RESEND_API_KEY e RESEND_FROM_EMAIL sul progetto e ripubblicalo.</p>}
    {query.email === "failed" && <p className="notice error" role="alert">L’invio dell’email non è riuscito. Controlla l’errore riportato sull’ordine.</p>}
    {query.email === "sent" && <p className="notice success" role="status">Email dell’ordine inviata o già registrata come inviata.</p>}
    {query.email === "not_allowed" && <p className="notice error" role="alert">Questo ordine non può ricevere un’email di prova privata.</p>}
    {orders.length ? <div className="verified-order-list">{orders.map((order) => <article key={order.id}>
      <div className="verified-order-icon">{order.status === "paid" ? <BadgeCheck /> : <ReceiptText />}</div>
      <div><strong>{order.order_number}</strong><small>{order.customer_name || "Cliente"} · {order.customer_email}</small><small>{italianLabel(order.status).toUpperCase()} · {order.currency}</small></div>
      <div className="verified-order-items">{order.order_items?.map((item) => <span key={`${order.id}-${item.beat_title_snapshot}-${italianLabel(item.license_name_snapshot)}`}>{item.beat_title_snapshot}<small>{italianLabel(item.license_name_snapshot)}</small></span>)}</div>
      <div><strong>{formatPrice(order.total_cents)}</strong><small>{new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.paid_at ?? order.created_at))}</small>
        {order.status === "paid" && <><small>Email: {order.confirmation_email_sent_at ? "inviata" : "in attesa / errore"}</small>
          {order.confirmation_email_last_error && <small role="alert">{order.confirmation_email_last_error}</small>}
          {!order.confirmation_email_sent_at && <form action={retryOrderConfirmation}><input type="hidden" name="id" value={order.id}/><button className="button button-secondary" type="submit">RIPROVA INVIO EMAIL</button></form>}</>}
      </div>
    </article>)}</div> : <div className="empty-state"><ReceiptText size={30}/><h3>Non hai ancora ordini.</h3></div>}
    <AdminPagination page={page} total={count ?? 0} path="/admin/orders" />
  </>;
}
