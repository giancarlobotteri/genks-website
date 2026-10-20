import test from "node:test";
import assert from "node:assert/strict";
import { cashSale } from "../src/lib/cash-sales.ts";
import { businessSummary } from "../src/lib/business-sales.ts";
const row = { id: "agreement", amount_cents: 10000, details: "Sessione concordata con il cliente", received_at: null as string | null, refunded_at: null as string | null, booking_id: "booking", bookings: { reference: "BKG-TEST", name: "Cliente", email: "test@example.invalid", status: "confirmed" }, service_projects: null };
test("a confirmed cash appointment is not revenue until money is explicitly recorded", () => {
  assert.equal(cashSale(row), null);
  const result = cashSale({...row,received_at:"2026-10-20T17:00:00Z"})!;
  assert.equal(result.sale.live,true);assert.equal(result.sale.fee,0);assert.equal(result.sale.amount,10000);
  assert.match(result.sale.providerId,/Contanti/);assert.equal(result.refund,null);
});
test("cash refunds affect their own date and a cancelled unrefunded receipt needs review", () => {
  const result = cashSale({...row,received_at:"2026-10-19T17:00:00Z",refunded_at:"2026-10-20T17:00:00Z"})!;
  const summary=businessSummary([result.sale],[result.refund!],[],new Date("2026-10-20T18:00:00Z"));
  assert.equal(summary.today.gross,0);assert.equal(summary.today.refunded,10000);assert.equal(summary.lifetime.net,0);
  assert.ok(cashSale({...row,received_at:"2026-10-19T17:00:00Z",bookings:{...row.bookings,status:"cancelled"}})!.sale.review);
});
