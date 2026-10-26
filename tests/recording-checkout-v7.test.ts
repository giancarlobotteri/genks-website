import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRecordingQuote} from '../src/lib/recording-quote.ts';
test('recording checkout itemizes the base and midnight surcharge in exact cents',()=>{
 const q=buildRecordingQuote('2026-10-24','22:30',3);assert.equal(q.base,5997);assert.equal(q.night,2997);assert.equal(q.total,8994);assert.equal(q.lines.reduce((s,l)=>s+l.quantity*l.unitAmount,0),q.total);
 const ordinary=buildRecordingQuote('2026-10-26','19:30',1.25);assert.equal(ordinary.total,2499);assert.equal(ordinary.lines.length,1);
});
test('recording discounts affect the base, not the night supplement; invalid lengths fail closed',()=>{
 const q=buildRecordingQuote('2026-10-24','23:30',1,[{target:'recording',label:'Test',kind:'percent',amount:10,active:true}]);assert.equal(q.hourly,1799);assert.equal(q.night,999);assert.equal(q.total,2798);
 for(const value of [0,-1,.2,8.25,NaN,Infinity])assert.throws(()=>buildRecordingQuote('2026-10-24','22:30',value));
});

test('very large discounts keep the 50-cent minimum itemized without pretending it is a night supplement',()=>{
 const q=buildRecordingQuote('2026-10-26','19:30',.25,[{target:'recording',label:'Test',kind:'fixed',amount:2499,active:true}]);assert.equal(q.total,50);assert.equal(q.night,0);assert.equal(q.minimum,37);assert.equal(q.lines.reduce((s,l)=>s+l.unitAmount*l.quantity,0),50);
});
