import Link from "next/link";
import { AdminPagination, pageNumber } from "@/components/admin/pagination";
import { getBusinessSales } from "@/lib/admin-sales";
import { requireAdmin } from "@/lib/auth";
import { italianLabel } from "@/lib/italian";
import { savedOrderDetails, type SavedOrderItem } from "@/lib/saved-order-details";
import { paginate } from "@/lib/pagination";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import styles from "./search.module.css";

export const dynamic = "force-dynamic";

type Purchase = { name: string; detail?: string; items?: SavedOrderItem[] };
type SearchResult = {
  id: string;
  type: string;
  reference: string;
  customer: string;
  email: string | null;
  phone?: string | null;
  purchases: Purchase[];
  total: number | null;
  paid?: number;
  currency?: string;
  parentOrder?: string;
  target: string;
};

const dayFormat = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome", dateStyle: "medium",
});
const timeFormat = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome", timeStyle: "short",
});

function firstRelated<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function studioSlot(start: string, end: string) {
  const first = new Date(start);
  const last = new Date(end);
  const firstDay = dayFormat.format(first);
  const lastDay = dayFormat.format(last);
  return firstDay === lastDay
    ? `${firstDay} · ${timeFormat.format(first)}–${timeFormat.format(last)}`
    : `${firstDay}, ${timeFormat.format(first)} → ${lastDay}, ${timeFormat.format(last)}`;
}

function projectPurchases(project: { commerce_snapshot: unknown; service: string; track_title: string; description: string | null }): Purchase[] {
  const snapshot = project.commerce_snapshot as {
    stage?: string;
  } | null;
  if (snapshot?.stage === "custom") {
    return [{ name: "Pagamento personalizzato", detail: project.description?.trim() }];
  }
  const details = savedOrderDetails(project.commerce_snapshot);
  if (details.length) return details.map(part => ({ name: part.title, detail: part.hours ? `Studio · ${part.hours}` : undefined, items: part.items }));
  const service = italianLabel(project.service);
  const title = project.track_title.trim();
  return [{ name: service || title || "Servizio", detail: title && service && title !== service ? title : undefined }];
}

function money(cents: number, currency = "eur") {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

function ResultCard({ result }: { result: SearchResult }) {
  const { paid, total, currency } = result;
  const amount = paid ?? total;
  return (
    <article className={styles.card}>
      <header className={styles.cardHeader}>
        <div>
          <span className={styles.type}>{result.type}</span>
          <h2>{result.reference}</h2>
        </div>
        <Link className="text-link" href={result.target}>Apri gestione →</Link>
      </header>
      <div className={styles.summary}>
        <section className={styles.panel}>
          <h3>Acquistato / prenotato</h3>
          <ul className={styles.purchases}>
            {result.purchases.map((item, index) => (
              <li key={index}>
                <strong>{item.name}</strong>
                {item.detail && <span>{item.detail}</span>}
                {!!item.items?.length && <ul className={styles.lineItems}>{item.items.map((line, index) => (
                  <li key={index}><span>{line.name}</span>{line.amount && <strong>{line.amount}</strong>}</li>
                ))}</ul>}
              </li>
            ))}
          </ul>
        </section>
        <section className={styles.panel}>
          <h3>{result.parentOrder ? "Quota studio inclusa" : paid !== undefined ? "Pagato" : "Totale ordine"}</h3>
          <p className={styles.amount}>
            {amount === null ? "Da concordare" : money(amount, currency)}
          </p>
          {result.parentOrder && <p className={styles.muted}>Inclusa nell’ordine <Link href={`/admin/payments?code=${encodeURIComponent(result.parentOrder)}`}>{result.parentOrder}</Link></p>}
          {!result.parentOrder && paid !== undefined && total !== null && paid !== total && (
            <p className={styles.muted}>Totale ordine {money(total, currency)}</p>
          )}
        </section>
        <section className={styles.panel}>
          <h3>Contatti</h3>
          <address className={styles.contact}>
            <strong>{result.customer}</strong>
            {result.email && <a href={`mailto:${result.email}`}>{result.email}</a>}
            {result.phone && <a href={`tel:${result.phone.replace(/[^+\d]/g, "")}`}>{result.phone}</a>}
            {!result.email && !result.phone && <span className={styles.muted}>Contatti non disponibili</span>}
          </address>
        </section>
      </div>
    </article>
  );
}

export default async function AdminSearch({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const safe = q.replace(/[^a-zA-Z0-9@._ -]/g, "");
  const rows: SearchResult[] = [];

  if (safe.length >= 3) {
    const db = createSupabaseAdminClient();
    const [bookings, projects, orders, live, test] = await Promise.all([
      db.from("bookings").select("id,reference,name,email,starts_at,ends_at,price_cents,phone,service_order_parts_v8(service_projects(reference)),service_credit_bookings_v8(service_order_parts_v8(service_projects(reference)))").is("archived_at", null).ilike("reference", `%${safe}%`).limit(25),
      db.from("service_projects").select("id,reference,name,email,phone,price_cents,track_title,service,description,commerce_snapshot").ilike("reference", `%${safe}%`).limit(25),
      db.from("orders").select("id,order_number,customer_name,customer_email,total_cents,currency,order_items(beat_title_snapshot,license_name_snapshot)").ilike("order_number", `%${safe}%`).limit(25),
      getBusinessSales(true, true),
      getBusinessSales(false, true),
    ]);
    if (bookings.error || projects.error || orders.error) throw new Error("Ricerca temporaneamente non disponibile.");

    const paidByReference = new Map<string, number>();
    for (const sale of live.sales) {
      paidByReference.set(sale.reference, (paidByReference.get(sale.reference) ?? 0) + sale.amount - sale.refunded);
    }
    for (const b of bookings.data ?? []) {
      const directPart = firstRelated(b.service_order_parts_v8);
      const creditPart = firstRelated(firstRelated(b.service_credit_bookings_v8)?.service_order_parts_v8);
      const parentOrder = firstRelated(directPart?.service_projects)?.reference
        ?? firstRelated(creditPart?.service_projects)?.reference;
      rows.push({
        id: b.id, type: "Prenotazione studio", reference: b.reference,
        customer: b.name, email: b.email, phone: b.phone,
        purchases: [{ name: "Registrazione in studio", detail: studioSlot(b.starts_at, b.ends_at) }],
        total: b.price_cents, paid: parentOrder ? undefined : paidByReference.get(b.reference), parentOrder, target: "/admin/bookings",
      });
    }
    for (const p of projects.data ?? []) {
      rows.push({
        id: p.id, type: "Ordine servizi", reference: p.reference,
        customer: p.name, email: p.email, phone: p.phone,
        purchases: projectPurchases(p), total: p.price_cents, paid: paidByReference.get(p.reference),
        target: p.commerce_snapshot?.version === "2026-10-26-commerce-v8"
          ? `/admin/payments?code=${encodeURIComponent(p.reference)}` : "/admin/projects",
      });
    }
    for (const o of orders.data ?? []) {
      const purchases = o.order_items?.map(item => ({
        name: item.beat_title_snapshot,
        detail: italianLabel(item.license_name_snapshot),
      }));
      rows.push({
        id: o.id, type: "Ordine beat", reference: o.order_number, customer: o.customer_name ?? "Cliente",
        email: o.customer_email, purchases: purchases?.length ? purchases : [{ name: "Dettaglio acquisto non disponibile" }],
        total: o.total_cents, paid: paidByReference.get(o.order_number), currency: o.currency, target: "/admin/orders",
      });
    }
    const needle = safe.toLowerCase();
    const ordersByReference = new Map(rows.map(row => [row.reference, row]));
    for (const sale of [...live.sales, ...test.sales]) {
      const matchedPayment = [sale.id, sale.providerId].some(value => value.toLowerCase().includes(needle));
      const order = ordersByReference.get(sale.reference);
      if (!matchedPayment && (order || !sale.reference.toLowerCase().includes(needle))) continue;
      rows.push({
        id: sale.id, type: sale.live ? "Pagamento" : "Pagamento di prova", reference: sale.reference,
        customer: sale.customer, email: sale.email, phone: order?.phone,
        purchases: order?.purchases ?? (sale.items.length
          ? sale.items.map(name => ({ name })) : [{ name: "Dettaglio acquisto non disponibile" }]),
        total: null, paid: sale.amount - sale.refunded, currency: sale.currency, target: sale.targetUrl,
      });
    }
  }

  const list = paginate(rows, pageNumber(params.page));
  return (
    <div className={styles.page}>
      <header className={styles.header}><h1>Cerca ordine o prenotazione</h1></header>
      <form className={styles.search} action="/admin/search">
        <label>Codice ordine, prenotazione o pagamento
          <input name="q" defaultValue={q} minLength={3} maxLength={100} required placeholder="BKG-… / PRJ-… / pi_…" />
        </label>
        <button className="button button-primary">Cerca</button>
      </form>
      <div className={styles.results}>
        {list.items.map(result => <ResultCard key={`${result.type}-${result.id}`} result={result} />)}
      </div>
      {q && safe.length < 3 && <p className="empty-state">Inserisci almeno tre caratteri del codice.</p>}
      {safe.length >= 3 && !rows.length && <p className="empty-state">Nessun risultato. Controlla il codice e riprova.</p>}
      <AdminPagination path="/admin/search" page={list.page} total={list.total} params={{ q }} />
    </div>
  );
}
