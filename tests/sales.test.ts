import test from "node:test";
import assert from "node:assert/strict";
import { salesSummary, type SaleOrder } from "../src/lib/sales.ts";
function order(paid_at:string, total_cents=2999, status="paid"): SaleOrder { return { id:paid_at, order_number:"GENKS", customer_email:"test@example.com", customer_name:null, status, total_cents, subtotal_cents:total_cents, discount_cents:0, currency:"EUR", paid_at, created_at:paid_at, refunded_at:null, order_items:[] }; }
test("sales use Rome midnight and calendar week, and exclude pending and refunded orders",()=>{
  const rows=[order("2026-10-14T22:30:00Z"),order("2026-10-12T10:00:00Z",4999),order("2026-10-11T10:00:00Z",9999),order("2026-10-15T09:00:00Z",9999,"pending"),order("2026-10-15T09:10:00Z",49999,"refunded")];
  const s=salesSummary(rows,new Date("2026-10-15T12:00:00Z"));
  assert.equal(s.today,2999); assert.equal(s.week,7998); assert.equal(s.month,17997); assert.equal(s.lifetime,17997); assert.equal(s.pending,1); assert.equal(s.refunds,49999); assert.equal(s.days.at(-1)?.orders,1);
});
test("sales roll across December and January and keep foreign currency out of EUR totals",()=>{
  const usd={...order("2027-01-01T11:00:00Z",4000),currency:"USD"};
  const s=salesSummary([order("2026-12-31T12:00:00Z",1000),order("2026-12-31T23:30:00Z",2000),usd],new Date("2027-01-01T12:00:00Z"));
  assert.equal(s.today,2000); assert.equal(s.month,2000); assert.equal(s.lastMonth,1000); assert.equal(s.week,3000);
});
