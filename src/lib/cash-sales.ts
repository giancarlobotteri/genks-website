import type { BusinessSale, SaleKind, RefundMovement } from "./business-sales.ts";
type CashRow = { id: string; amount_cents: number; details: string; received_at: string | null; refunded_at: string | null; booking_id: string | null; bookings: { reference: string; name: string; email: string; status: string } | null; service_projects: { reference: string; name: string; email: string; status: string; service: string; track_title: string } | null };
export function cashSale(row: CashRow): { sale: BusinessSale; refund: RefundMovement | null } | null {
  if (!row.received_at) return null;
  const request = row.bookings ?? row.service_projects;
  if (!request) return null;
  const id = `cash-${row.id}`;
  return { sale: { id, reference: request.reference, customer: request.name, email: request.email,
    kind: row.booking_id ? "recording" : row.service_projects!.service as SaleKind, amount: row.amount_cents,
    refunded: row.refunded_at ? row.amount_cents : 0, fee: 0, currency: "EUR", paidAt: row.received_at, live: true,
    review: request.status === "cancelled" && !row.refunded_at ? "Servizio annullato: verificare la restituzione dei contanti." : null,
    disputed: false, providerId: `Contanti · ${row.id}`, targetUrl: row.booking_id ? "/admin/bookings" : "/admin/projects",
    items: [row.service_projects?.track_title ?? "Sessione di registrazione", row.details] },
    refund: row.refunded_at ? { payment_id: id, amount_cents: row.amount_cents, occurred_at: row.refunded_at } : null };
}
