import test from "node:test";
import assert from "node:assert/strict";
import { renderCalendar } from "../src/lib/ical.ts";
test("calendar emits stable private UTC sessions and transparent all-day deadlines with exclusive end dates",()=>{
  const result=renderCalendar([{id:"booking-1",title:"Studio GENKS",start:"2026-10-16T15:00:00+02:00",end:"2026-10-16T16:00:00+02:00",updated:"2026-10-15T10:00:00Z"},{id:"project-1",title:"Master",start:"2026-12-31",allDay:true,updated:"2026-10-15T10:00:00Z"}]);
  assert.match(result,/DTSTART:20261016T130000Z/); assert.match(result,/DTEND;VALUE=DATE:20270101/); assert.match(result,/TRANSP:TRANSPARENT/); assert.match(result,/CLASS:PRIVATE/); assert.match(result,/UID:booking-1@prodbygenks.com/);
});
test("calendar escapes untrusted titles and folds UTF-8 lines without splitting characters",()=>{
  const result=renderCalendar([{id:"1",title:"Titolo, prova;\n"+"è".repeat(100),start:"2026-10-20",allDay:true,updated:"2026-10-15T10:00:00Z"}]);
  assert.match(result,/Titolo\\, prova\\;\\n/);
  for(const line of result.split("\r\n")) assert.ok(Buffer.byteLength(line)<=75);
});
