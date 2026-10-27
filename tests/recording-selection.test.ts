import test from "node:test";
import assert from "node:assert/strict";
import {recordingStartAllowed,recordingAppointmentLabel} from "../src/lib/recording-selection.ts";
import {availableSlots} from "../src/lib/booking-slots.ts";

test("card lead time is enforced before selecting a slot and cash follows the same minimum booking lead time",()=>{
  const now=Date.parse("2026-10-23T17:00:00Z");
  assert.equal(recordingStartAllowed("2026-10-23","19:30","card",now),false);
  assert.equal(recordingStartAllowed("2026-10-23","19:30","cash",now),false);
  assert.equal(recordingStartAllowed("2026-10-23","20:00","card",now),true);
  assert.equal(recordingStartAllowed("2026-10-23","19:30","card",Date.parse("2026-10-23T16:55:00Z")),false);
  assert.equal(recordingStartAllowed("2026-10-23","19:30","card",Date.parse("2026-10-23T16:54:59Z")),true);
  assert.equal(recordingStartAllowed("2026-03-29","02:30","card",now),false);
});

test("appointment summary includes both dates when a Saturday session continues into Sunday",()=>{
  const label=recordingAppointmentLabel("2026-10-24","23:30",2);
  assert.match(label,/24 ott/);assert.match(label,/25 ott/);
  assert.match(label,/23:30/);assert.match(label,/01:30/);
});

test("calendar skips nonexistent spring times without crashing and keeps the valid autumn early hour",()=>{
  const rule=[{weekday:0,start_time:"00:00",end_time:"05:00",ends_next_day:false,slot_minutes:30,buffer_minutes:0}];
  const now=new Date("2026-01-01T00:00:00Z");
  const spring=availableSlots("2026-03-29",.5,rule,[],now);
  assert.ok(spring.includes("01:30"));assert.ok(!spring.includes("02:30"));assert.ok(spring.includes("03:00"));
  assert.ok(availableSlots("2026-10-25",.5,rule,[],now).includes("01:30"));
});
