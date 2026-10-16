import test from "node:test";
import assert from "node:assert/strict";
import { offerReadiness } from "../src/lib/commerce/sale-readiness.ts";
import { availableSlots } from "../src/lib/booking-slots.ts";
import { fromRomeWallTime } from "../src/lib/rome-time.ts";
import { businessSummary, filterBusinessSales, salesCsv, type BusinessSale } from "../src/lib/business-sales.ts";
import { canChangeServiceStatus } from "../src/lib/service-workflow.ts";

const rules=[{weekday:1,start_time:"19:30:00",end_time:"01:00:00",ends_next_day:true,slot_minutes:30,buffer_minutes:15}];
const now=new Date("2026-10-01T10:00:00Z");
test("studio offers an overnight session and stops at closing time",()=>{
  const times=availableSlots("2026-10-19",1,rules,[],now);
  assert.ok(times.includes("19:30"));assert.ok(times.includes("23:30"));assert.ok(!times.includes("00:00"));assert.ok(!times.includes("18:30"));
  const next=availableSlots("2026-10-20",1,rules,[],now);
  assert.deepEqual(next,["00:00"]);
  assert.ok(!availableSlots("2026-10-19",2,rules,[],now).includes("23:30"));
});
test("studio respects the stored buffer on both sides of an existing session",()=>{
  const iso=(time:string)=>fromRomeWallTime("2026-10-19",time).toISOString();
  const times=availableSlots("2026-10-19",1,rules,[{starts_at:iso("21:00"),ends_at:iso("22:00"),blocked_until:iso("22:15")}],now);
  assert.ok(times.includes("19:30"));assert.ok(!times.includes("20:00"));assert.ok(!times.includes("22:00"));assert.ok(times.includes("22:30"));
});
test("studio includes closures that cross midnight",()=>{
  const times=availableSlots("2026-10-20",1,rules,[{starts_at:fromRomeWallTime("2026-10-19","23:00").toISOString(),ends_at:fromRomeWallTime("2026-10-20","01:00").toISOString()}],now);
  assert.deepEqual(times,[]);
});
test("flexible weekend sessions may continue past midnight but require a valid start time",()=>{
  const weekend=[{weekday:6,start_time:"10:00:00",end_time:"00:00:00",ends_next_day:true,flexible_close:true,slot_minutes:30,buffer_minutes:15}];
  const times=availableSlots("2026-10-17",8,weekend,[],now);
  assert.ok(times.includes("23:30"));assert.ok(times.includes("10:00"));assert.ok(!times.includes("09:30"));
});
test("products cannot be sold with missing files or a draft contract",()=>{
  assert.equal(offerReadiness({contract:"",includedAssets:["mp3"],availableKinds:[],hasPreview:false}).ready,false);
  assert.equal(offerReadiness({contract:"BOZZA DA COMPLETARE",includedAssets:["mp3"],availableKinds:["mp3"],hasPreview:true}).ready,false);
  assert.equal(offerReadiness({contract:"Contratto completo",includedAssets:["mp3","wav","stems"],availableKinds:["mp3","wav"],hasPreview:true}).ready,false);
  assert.equal(offerReadiness({contract:"Contratto completo",includedAssets:["mp3","wav"],availableKinds:["mp3","wav"],hasPreview:true}).ready,true);
});
test("unconfigured or unsupported delivery formats cannot open checkout",()=>{
  for(const formats of [[],["visual"],["mp3","arbitrary"]])assert.equal(offerReadiness({contract:"Test",includedAssets:formats,availableKinds:["mp3"],hasPreview:true}).ready,false);
});
const sale=(id:string,paidAt:string,amount=10000):BusinessSale=>({id,reference:id,customer:"Cliente",email:"cliente@example.invalid",kind:"beat",amount,refunded:0,fee:200,currency:"EUR",paidAt,live:true,review:null,disputed:false,providerId:`pi_${id}`,targetUrl:"/admin/orders",items:[]});
test("sales retain historical revenue and date partial refunds to their own day",()=>{
  const payment={...sale("one","2026-09-29T10:00:00Z"),refunded:3000};
  const stats=businessSummary([payment],[{payment_id:"one",amount_cents:3000,occurred_at:"2026-10-15T22:30:00Z"}],[],new Date("2026-10-16T12:00:00Z"));
  assert.equal(stats.lifetime.gross,10000);assert.equal(stats.lifetime.net,7000);assert.equal(stats.today.gross,0);assert.equal(stats.today.refunded,3000);assert.equal(stats.today.net,-3000);assert.equal(stats.month.net,-3000);assert.equal(stats.previousMonth.gross,10000);
});
test("business sales include services and separate known costs from actual profit",()=>{
  const rows=[sale("beat","2026-10-16T10:00:00Z"),{...sale("studio","2026-10-16T11:00:00Z",20000),kind:"recording" as const,fee:null}];
  const stats=businessSummary(rows,[],[{id:"cost",description:"Software",amount_cents:2500,incurred_on:"2026-10-16",category:"software"}],new Date("2026-10-16T12:00:00Z"));
  assert.equal(stats.today.gross,30000);assert.equal(stats.today.balance,27300);assert.equal(stats.today.missingFees,1);assert.equal(stats.categories.find(c=>c.kind==="recording")?.total,20000);
});
test("refunds from another environment or currency cannot contaminate selected totals",()=>{
  const usd={...sale("usd","2026-10-16T10:00:00Z"),currency:"USD"};
  const stats=businessSummary([sale("eur","2026-10-16T10:00:00Z"),usd],[{payment_id:"usd",amount_cents:5000,occurred_at:"2026-10-16T12:00:00Z"},{payment_id:"test_not_selected",amount_cents:5000,occurred_at:"2026-10-16T12:00:00Z"}],[],new Date("2026-10-16T12:00:00Z"));
  assert.equal(stats.today.gross,10000);assert.equal(stats.today.refunded,0);
});
test("sales filters agree for the list and CSV and flag partial refunds",()=>{
  const rows=[sale("paid","2026-10-16T10:00:00Z"),{...sale("partial","2026-10-16T11:00:00Z"),refunded:500}];
  assert.deepEqual(filterBusinessSales(rows,{status:"partial"}).map(s=>s.id),["partial"]);
  assert.deepEqual(filterBusinessSales(rows,{status:"paid"}).map(s=>s.id),["paid"]);
  const csv=salesCsv([{...rows[0],customer:' =HYPERLINK("bad")',reference:'@SUM(1)'}]);
  assert.ok(csv.includes("' =HYPERLINK"));assert.ok(csv.includes("'@SUM(1)"));
});
test("manual updates cannot fake payment or skip review before project delivery",()=>{
  assert.equal(canChangeServiceStatus("booking","pending","confirmed"),false);
  assert.equal(canChangeServiceStatus("project","awaiting_payment","paid"),false);
  assert.equal(canChangeServiceStatus("project","paid","delivered"),false);
  assert.equal(canChangeServiceStatus("project","review","delivered"),true);
  assert.equal(canChangeServiceStatus("project","delivered","paid"),false);
  assert.equal(canChangeServiceStatus("booking","confirmed","completed"),true);
});

test("repeat-customer reporting normalizes email and does not count a missing email as a client",()=>{
  const rows=[{...sale("a","2026-10-16T10:00:00Z"),email:" Artist@Example.invalid "},{...sale("b","2026-10-16T11:00:00Z"),email:"artist@example.invalid"},{...sale("empty","2026-10-16T12:00:00Z"),email:""}];
  const stats=businessSummary(rows,[],[],now);
  assert.equal(stats.customers,1);assert.equal(stats.repeatCustomers,1);
});
