import test from "node:test";
import assert from "node:assert/strict";
import { canBuyLicense, canBuyBeat } from "../src/lib/catalog-availability.ts";
import { unitEconomics } from "../src/lib/unit-economics.ts";
import { mockBeats } from "../src/data/mock/beats.ts";
import { mockLicenses } from "../src/data/mock/licenses.ts";

const beat={...mockBeats[0],isDemo:false,previewUrl:"https://example.invalid/preview.mp3",readyLicenseIds:["mp3" as const],licenseIds:["mp3" as const]};
const license={...mockLicenses[0],isDemo:false,contractText:"Condizioni definitive"};
test("catalogue cannot advertise purchase when delivery preflight is incomplete",()=>{
  assert.equal(canBuyLicense(beat,license),true);
  for(const unavailable of [{...beat,readyLicenseIds:[]},{...beat,readyLicenseIds:undefined},{...beat,previewUrl:""},{...beat,isDemo:true}])assert.equal(canBuyBeat(unavailable,[license]),false);
  assert.equal(canBuyLicense(beat,{...license,contractText:"BOZZA DA COMPLETARE"}),false);
  assert.equal(canBuyLicense(beat,{...license,isExclusive:true}),false);
});
test("a ready WAV offer cannot make an unready MP3 offer purchasable",()=>{
  assert.equal(canBuyLicense({...beat,readyLicenseIds:["wav"]},license),false);
});
const input={price:10000,discountPercent:10,feePercent:2,feeFixed:25,variableCosts:1000,hours:2,hourlyValue:2000,monthlyCosts:100000};
test("margin includes discounts, payment costs, direct costs and working hours",()=>{
  const result=unitEconomics(input)!;
  assert.equal(result.charged,9000);assert.equal(result.fees,205);assert.equal(result.work,4000);assert.equal(result.contribution,3795);assert.equal(result.breakEven,27);
});
test("zero or negative contribution does not invent a break-even sales target",()=>{
  assert.equal(unitEconomics({...input,price:1000})!.breakEven,null);
  assert.equal(unitEconomics({...input,discountPercent:100})!.breakEven,null);
  assert.equal(unitEconomics({...input,monthlyCosts:0})!.breakEven,0);
});
test("margin planner rejects invalid percentages and non-finite inputs",()=>{
  assert.equal(unitEconomics({...input,discountPercent:101}),null);
  assert.equal(unitEconomics({...input,feePercent:-1}),null);
  assert.equal(unitEconomics({...input,hours:NaN}),null);
});
