import test from "node:test";
import assert from "node:assert/strict";
import { extraTimeCents, recordingSessionCents } from "../src/lib/extra-time.ts";
test("night overtime adds 9.99 EUR per half hour on top of the ordinary rate",()=>{
 assert.equal(extraTimeCents(30,0),1250);
 assert.equal(extraTimeCents(0,30),2249);
 assert.equal(extraTimeCents(0,60),4497);
 assert.equal(extraTimeCents(30,30),3498);
 assert.equal(extraTimeCents(5,10),958);
});

test("night booking adds the surcharge to the base and uses the selected start",()=>{assert.equal(recordingSessionCents("2026-10-23","23:30",1,1999),2998);assert.equal(recordingSessionCents("2026-10-23","22:00",2,1999),3998);assert.equal(recordingSessionCents("2026-10-23","23:30",2,1999),6995);});
