import test from "node:test";
import assert from "node:assert/strict";
import { availableSlots } from "../src/lib/booking-slots.ts";
const rules = Array.from({length:7}, (_, weekday)=>({weekday,start_time:weekday===0||weekday===6?"10:00:00":"19:30:00",end_time:"00:00:00",ends_next_day:true,flexible_close:false,slot_minutes:30,buffer_minutes:15}));
const now = new Date("2026-10-01T00:00:00Z");
test("every weekday including Friday closes at midnight and offers no next-day carryover",()=>{
  for(const day of ["2026-10-19","2026-10-20","2026-10-21","2026-10-22","2026-10-23"]){
    const one=availableSlots(day,1,rules,[],now);
    assert.equal(one[0],"19:30");assert.equal(one.at(-1),"23:00");assert.ok(!one.includes("00:00"));
    assert.equal(availableSlots(day,2,rules,[],now).at(-1),"22:00");
    assert.deepEqual(availableSlots(day,6,rules,[],now),[]);
  }
});
test("Saturday and Sunday start at 10 and require the entire session to end by midnight",()=>{
  for(const day of ["2026-10-24","2026-10-25"]){
    assert.equal(availableSlots(day,1,rules,[],now)[0],"10:00");
    assert.equal(availableSlots(day,1,rules,[],now).at(-1),"23:00");
    assert.equal(availableSlots(day,8,rules,[],now).at(-1),"16:00");
  }
});
