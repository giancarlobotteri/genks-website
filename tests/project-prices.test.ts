import test from "node:test";
import assert from "node:assert/strict";
import { projectPrice, projectRateVersion, serviceRateVersion, recordingHourlyCents } from "../src/lib/service-rates.ts";

test("approved tier boundaries and stereo master are exact integer cents",()=>{
 for(const [tracks,mix,bundle] of [[1,8999,11999],[8,8999,11999],[9,13999,17999],[24,13999,17999],[25,19999,23999],[48,19999,23999]]) {
  assert.equal(projectPrice("mix",tracks),mix);
  assert.equal(projectPrice("mix_master",tracks),bundle);
 }
 assert.equal(projectPrice("master",1),3999);
});
test("unsupported counts and services cannot produce a fixed checkout amount",()=>{
 for(const count of [0,-1,1.5,49,200,NaN,Infinity]) assert.equal(projectPrice("mix",count),null);
 for(const count of [0,2,48]) assert.equal(projectPrice("master",count),null);
 assert.equal(projectPrice("recording",1),null);
});
test("new recording price is versioned independently from project rates",()=>{
 assert.equal(serviceRateVersion,"2026-10-22-recording-v4");
 assert.notEqual(projectRateVersion,serviceRateVersion);
 assert.equal(recordingHourlyCents,1999);
 assert.equal(Math.round(recordingHourlyCents*.5),1000);
 assert.equal(recordingHourlyCents*2,3998);
});
