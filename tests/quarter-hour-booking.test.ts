import test from "node:test";
import assert from "node:assert/strict";
import { availableSlots } from "../src/lib/booking-slots.ts";
import { remoteProjectCardAllowed, projectPaymentMethod } from "../src/lib/remote-project-policy.ts";
const rule = [{weekday:6,start_time:"10:00",end_time:"00:00",ends_next_day:true,flexible_close:false,slot_minutes:30,buffer_minutes:15}];
const now = new Date("2026-10-01T00:00:00Z");

test("a booking must fit its whole duration before an occupied interval, including buffer",()=>{
 const busy=[{starts_at:"2026-10-24T13:00:00+02:00",ends_at:"2026-10-24T14:00:00+02:00",blocked_until:"2026-10-24T14:15:00+02:00"}];
 assert.ok(availableSlots("2026-10-24",2,rule,busy,now).includes("10:00"));
 assert.ok(!availableSlots("2026-10-24",3,rule,busy,now).includes("10:00"));
 assert.ok(!availableSlots("2026-10-24",1,rule,busy,now).includes("14:00"));
 assert.ok(availableSlots("2026-10-24",1,rule,busy,now).includes("14:30"));
});
test("quarter-hour lengths keep midnight, thirty-minute starts and fifteen-minute buffer", () => {
  assert.ok(availableSlots("2026-10-24",0.5,rule,[],now).includes("23:30"));
  assert.ok(!availableSlots("2026-10-24",0.75,rule,[],now).includes("23:30"));
  assert.ok(!availableSlots("2026-10-24",0.25,rule,[],now).includes("10:15"));
  const busy=[{starts_at:"2026-10-24T11:30:00+02:00",ends_at:"2026-10-24T12:00:00+02:00",blocked_until:"2026-10-24T12:15:00+02:00"}];
  assert.ok(availableSlots("2026-10-24",1.25,rule,busy,now).includes("10:00"));
  assert.ok(!availableSlots("2026-10-24",1.5,rule,busy,now).includes("10:00"));
  assert.ok(!availableSlots("2026-10-24",0.25,rule,busy,now).includes("12:00"));
});
test("card policy allows studio and remote mix/master and fails closed outside that scope", () => {
  for (const service of ["mix","master","mix_master"]) {
    assert.ok(remoteProjectCardAllowed({enabled:true,type:"project",mode:"remote",service}));
    assert.ok(!remoteProjectCardAllowed({enabled:false,type:"project",mode:"remote",service}));
    assert.ok(remoteProjectCardAllowed({enabled:true,type:"project",mode:"studio",service}));
    assert.ok(!remoteProjectCardAllowed({enabled:false,type:"project",mode:"studio",service}));
    assert.ok(!remoteProjectCardAllowed({enabled:true,type:"project",mode:"invalid",service}));
  }
  for (const type of ["booking","beat","exclusive"]) assert.ok(!remoteProjectCardAllowed({enabled:true,type,mode:"remote",service:"mix"}));
  assert.ok(!remoteProjectCardAllowed({enabled:true,type:"project",mode:"remote",service:"custom"}));
});

test("payment method is independent of studio work and invalid combinations fail closed", () => {
  assert.equal(projectPaymentMethod("studio", "card"), "card");
  assert.equal(projectPaymentMethod("studio", "cash"), "cash");
  assert.equal(projectPaymentMethod("remote", "card"), "card");
  assert.equal(projectPaymentMethod("remote", "cash"), null);
  assert.equal(projectPaymentMethod("studio", "forged"), null);
  assert.equal(projectPaymentMethod("invalid", "card"), null);
  assert.equal(projectPaymentMethod("studio"), "cash");
  assert.equal(projectPaymentMethod("remote"), "card");
});

test("back-to-back sessions and Friday night extensions",()=>{const friday=[{...rule[0],weekday:5,start_time:"19:30",buffer_minutes:0,flexible_close:true}];const busy=[{starts_at:"2026-10-23T19:30:00+02:00",ends_at:"2026-10-23T22:30:00+02:00",blocked_until:"2026-10-23T22:30:00+02:00"}];assert.ok(!availableSlots("2026-10-23",1,friday,busy,now).includes("22:00"));assert.ok(availableSlots("2026-10-23",1,friday,busy,now).includes("22:30"));assert.ok(availableSlots("2026-10-23",3,friday,busy,now).includes("23:30"));assert.ok(!availableSlots("2026-10-23",3,[{...friday[0],flexible_close:false}],[],now).includes("23:30"));});
