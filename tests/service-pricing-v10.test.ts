import test from 'node:test';
import assert from 'node:assert/strict';
import {mixPriceV10,audioPriceV10,recordingPriceV10,fixedPackageV10,studioPackageV10,projectPackageV10,previousAudioPriceV10} from '../src/lib/service-pricing-v10.ts';
test('all five mix boundaries and every additional track use integer cents',()=>{
  for(const [n,price] of [[1,2999],[8,2999],[9,4999],[16,4999],[17,6999],[24,6999],[25,8999],[36,8999],[37,11999],[48,11999],[49,12249],[60,14999]])assert.equal(mixPriceV10(n),price);
  for(const n of [0,-1,1.5,NaN,Infinity])assert.throws(()=>mixPriceV10(n));
  assert.throws(()=>mixPriceV10(Number.MAX_SAFE_INTEGER));
});
test('master is fixed and added once to mix in every band',()=>{
  for(const n of [1,8,16,24,36,48,60]){
    assert.equal(audioPriceV10('master',n),2999);
    assert.equal(audioPriceV10('mix_master',n),mixPriceV10(n)+2999);
  }
});
test('night rate is 29.99 total per hour, not an additional 29.99',()=>{
  assert.equal(recordingPriceV10(60,0),1999);
  assert.equal(recordingPriceV10(0,60),2999);
  assert.equal(recordingPriceV10(60,60),4998);
  assert.equal(recordingPriceV10(0,30),1500);
});
test('fixed package savings are genuine euro differences',()=>{
  assert.deepEqual(fixedPackageV10('masters'),{total:6999,separate:8997,saving:1998});
  assert.deepEqual(fixedPackageV10('hours'),{total:7999,separate:9995,saving:1996});
});
test('starting package fees and selected studio time are charged once; no false saving',()=>{
  assert.equal(studioPackageV10('voice',8,60).total,9996);
  assert.equal(studioPackageV10('turnkey',8,60).total,12996);
  assert.equal(studioPackageV10('turnkey',8,60).saving,0);
});
test('EP is GENKS only with two included recording hours for each song',()=>{
  const q=projectPackageV10('ep',Array.from({length:6},()=>({source:'genks',tracks:8})));
  assert.equal(q.total,56982);assert.equal(q.includedMinutes,720);assert.equal(q.saving,23988);
  assert.throws(()=>projectPackageV10('ep',[{source:'external',tracks:8},{source:'genks',tracks:8}]));
});
test('album uses GENKS productions and includes every audio service',()=>{
  const q=projectPackageV10('album',[{source:'genks',tracks:8},{source:'genks',tracks:18}]);
  assert.equal(q.rows[0].total,9497);assert.equal(q.rows[1].total,13497);
  assert.equal(q.includedMinutes,240);
  assert.throws(()=>projectPackageV10('album',[{source:'external',tracks:8},{source:'genks',tracks:8}]));
});
test('before/after references actual previous prices; unchanged master has no fake reduction',()=>{
  assert.equal(previousAudioPriceV10('mix',8),5999);
  assert.equal(previousAudioPriceV10('mix_master',24),10499);
  assert.equal(previousAudioPriceV10('master',1),audioPriceV10('master',1));
  assert.equal(previousAudioPriceV10('mix',49),null);
});
