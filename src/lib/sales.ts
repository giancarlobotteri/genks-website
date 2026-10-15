export type SaleOrder = { id: string; order_number: string; customer_email: string; customer_name: string | null; status: string; total_cents: number; subtotal_cents: number; discount_cents: number; currency: string; paid_at: string | null; created_at: string; refunded_at: string | null; order_items: { beat_title_snapshot: string; license_name_snapshot: string; unit_price_cents: number }[] };
const dayFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" });
export const romeDay = (date: Date | string) => dayFormat.format(new Date(date));
export function salesSummary(orders: SaleOrder[], now = new Date()) {
  const today = romeDay(now);
  const monday = new Date(`${today}T12:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const weekStart = monday.toISOString().slice(0, 10);
  const paid = orders.filter(o => o.status === "paid" && o.paid_at && o.currency.toUpperCase() === "EUR");
  const sum = (rows: SaleOrder[]) => rows.reduce((total, o) => total + o.total_cents, 0);
  const days = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(`${today}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - 29 + index);
    const day = date.toISOString().slice(0, 10);
    const rows = paid.filter(o => romeDay(o.paid_at!) === day);
    return { day, total: sum(rows), orders: rows.length };
  });
  const monthRows = paid.filter(o => romeDay(o.paid_at!).slice(0, 7) === today.slice(0, 7));
  const previousMonth = new Date(`${today.slice(0, 7)}-15T12:00:00Z`); previousMonth.setUTCMonth(previousMonth.getUTCMonth() - 1);
  const lastMonth = sum(paid.filter(o => romeDay(o.paid_at!).slice(0, 7) === previousMonth.toISOString().slice(0, 7)));
  return { paid, days, lifetime: sum(paid), today: sum(paid.filter(o => romeDay(o.paid_at!) === today)), week: sum(paid.filter(o => romeDay(o.paid_at!) >= weekStart && romeDay(o.paid_at!) <= today)), month: sum(monthRows), lastMonth, average: paid.length ? Math.round(sum(paid) / paid.length) : 0, discounts: paid.reduce((n,o) => n + o.discount_cents,0), refunds: sum(orders.filter(o => o.status === "refunded" && o.currency.toUpperCase() === "EUR")), pending: orders.filter(o => o.status === "pending").length };
}
