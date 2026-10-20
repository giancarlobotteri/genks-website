import test from "node:test";
import assert from "node:assert/strict";
import { extraTimeCents } from "../src/lib/extra-time.ts";
test("night overtime adds 10 EUR per half hour on top of the ordinary rate",()=>{
 assert.equal(extraTimeCents(30,0),1000);
 assert.equal(extraTimeCents(0,30),2000);
 assert.equal(extraTimeCents(0,60),4000);
 assert.equal(extraTimeCents(30,30),3000);
 assert.equal(extraTimeCents(5,10),833);
});
