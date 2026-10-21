import test from "node:test";
import assert from "node:assert/strict";
import { salesPeriod, validBusinessDate } from "../src/lib/sales-period.ts";
import { businessSummary, filterBusinessSales, type BusinessSale } from "../src/lib/business-sales.ts";
import { renderGenksStudioEmail } from "../src/lib/email-design.ts";

test("historical weeks span years and leap-month boundaries correctly",()=>{
  assert.deepEqual(salesPeriod({period:"week",anchor:"2026-01-01"}),{type:"week",anchor:"2026-01-01",from:"2025-12-29",to:"2026-01-04"});
  assert.equal(salesPeriod({period:"month",anchor:"2028-02-15"}).to,"2028-02-29");
  assert.equal(validBusinessDate("2026-02-30"),false);
  assert.equal(salesPeriod({period:"year",anchor:"2025-08-10"}).from,"2025-01-01");
  assert.deepEqual(salesPeriod({period:"range",anchor:"2026-10-21",from:"2026-10-25",to:"2026-10-01"}),{type:"range",anchor:"2026-10-21",from:"2026-10-25",to:"2026-10-25"});
});
test("reports account for Rome midnight and refunds in their actual later period",()=>{
  const sale:BusinessSale={id:"p",reference:"PRJ-A",customer:"Artist",email:"artist@example.invalid",kind:"mix",amount:10000,refunded:2000,fee:175,currency:"EUR",paidAt:"2026-01-31T23:30:00Z",live:true,review:null,disputed:false,providerId:"pi_A",targetUrl:"/admin/projects",items:[]};
  const stats=businessSummary([sale],[{payment_id:"p",amount_cents:2000,occurred_at:"2026-03-01T12:00:00Z"}],[],new Date("2026-03-02T12:00:00Z"));
  assert.equal(stats.period("2026-02-01","2026-02-28").gross,10000);
  assert.equal(stats.period("2026-03-01","2026-03-31").balance,-2000);
  assert.equal(filterBusinessSales([sale],{from:"2026-01-01",to:"2026-01-31"}).length,0);
});
test("structured email fields escape customer markup and preserve Gmail white text",()=>{
  const html=renderGenksStudioEmail({subject:"GENKS BKG-TEST123",heading:"Hai una nuova prenotazione",body:'Nome: <img src=x onerror=alert(1)>\nEmail cliente: artist@example.invalid\nTotale: 20,00 €\nAppuntamento: 23/10/2026 19:30'});
  assert.ok(!html.includes('<img src=x'));
  assert.match(html,/&lt;img/);
  assert.ok((html.match(/padding:17px 20px/g)??[]).length>=3);
  for(const colour of html.matchAll(/(?:^|[;"\s])color:(#[a-f0-9]+)/gi))assert.equal(colour[1].toLowerCase(),"#ffffff");
  assert.match(html,/gmail-blend-difference/);
});

