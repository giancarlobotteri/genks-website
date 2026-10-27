import test from "node:test";
import assert from "node:assert/strict";
import { projectPrice, projectRateVersion, serviceRateVersion, recordingHourlyCents } from "../src/lib/service-rates.ts";

test("approved tier boundaries and stereo master are exact integer cents",()=>{
 for(const [tracks,mix,bundle] of [[1,2999,5998],[8,2999,5998],[9,4999,7998],[16,4999,7998],[17,6999,9998],[24,6999,9998],[25,8999,11998],[36,8999,11998],[37,11999,14998],[48,11999,14998],[49,12249,15248]]) {
  assert.equal(projectPrice("mix",tracks),mix);
  assert.equal(projectPrice("mix_master",tracks),bundle);
 }
 assert.equal(projectPrice("master",1),2999);
});
test("unsupported counts and services cannot produce a fixed checkout amount",()=>{
 for(const count of [0,-1,1.5,1001,NaN,Infinity]) assert.equal(projectPrice("mix",count),null);
 for(const count of [0,2,48]) assert.equal(projectPrice("master",count),null);
 assert.equal(projectPrice("recording",1),null);
});
test("new recording price is versioned independently from project rates",()=>{
 assert.equal(serviceRateVersion,"2026-10-27-recording-v10");
 assert.notEqual(projectRateVersion,serviceRateVersion);
 assert.equal(recordingHourlyCents,1999);
 assert.equal(Math.round(recordingHourlyCents*.5),1000);
 assert.equal(recordingHourlyCents*2,3998);
});
