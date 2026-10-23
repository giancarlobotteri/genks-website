import assert from 'node:assert/strict';
import test from 'node:test';
import {buildServiceQuote} from '../src/lib/service-quote.ts';
import {packages,separatePackagePrices,guaranteeRefund,customBeat} from '../src/lib/service-catalog.ts';
import {projectPrice} from '../src/lib/service-rates.ts';
import {firstVersionEstimate,isItalianBusinessDay} from '../src/lib/service-delivery.ts';
import {recordingSessionCents} from '../src/lib/extra-time.ts';
const song=(service='mix_master',trackCount=8)=>({service,trackTitle:'Brano test',trackCount,description:'Descrizione valida del risultato',referenceLinks:'',notes:'',desiredDeadline:''});
const now=new Date('2026-10-22T10:00:00Z');
test('all seven service prices and tier boundaries',()=>{for(const [n,m,b] of [[1,9999,12999],[8,9999,12999],[9,14999,18999],[24,14999,18999],[25,19999,23999],[48,19999,23999]]){assert.equal(projectPrice('mix',n),m);assert.equal(projectPrice('mix_master',n),b);}assert.equal(projectPrice('master',1),3999);assert.equal(projectPrice('mix',49),null);});
test('extras itemized, counts validated, amount fields from browser ignored',()=>{const q=buildServiceQuote({songs:[{...song(),vocalTracks:2,versions:true,extraRevision:true,amountCents:1}],rush:true,earlyStart:true},[],now);assert.equal(q.totalCents,12999+3000+3000+1999+1500);assert.equal(q.lines.length,5);assert.equal(q.totalCents,q.lines.reduce((s,l)=>s+l.quantity*l.unitAmount,0));assert.throws(()=>buildServiceQuote({songs:[{...song(),vocalTracks:-1}]}));assert.throws(()=>buildServiceQuote({songs:[{...song(),versions:'true'}]}));});
test('every online package, no double charge for included extras',()=>{for(const code of ['single','ep','masters'] as const){const p=packages[code];const q=buildServiceQuote({packageCode:code,songs:Array.from({length:p.songs},()=>song(p.service,p.service==='master'?1:8))});assert.equal(q.totalCents,p.price);assert.equal(q.songs.reduce((s,l)=>s+l.amountCents,0),p.price);}const q=buildServiceQuote({packageCode:'single',songs:[{...song(),versions:true,extraRevision:true}]});assert.equal(q.totalCents,14999);});
test('package upgrades per song and rejected tampered packages',()=>{assert.equal(buildServiceQuote({packageCode:'ep',songs:[song('mix_master',9),song('mix_master',25),song(),song()]}).totalCents,61999);assert.throws(()=>buildServiceQuote({packageCode:'ep',songs:[song()]}));assert.throws(()=>buildServiceQuote({packageCode:'single',songs:[song('mix',8)]}));assert.equal(buildServiceQuote({packageCode:'voice',songs:[song()]}).totalCents,18999);});

test('every mix bundle changes tier at 9 and 25 tracks per song and returns to base when tracks are removed',()=>{
 for(const code of ['single','ep','voice','turnkey'] as const){
  const p=packages[code];
  const quote=(tracks:number)=>buildServiceQuote({packageCode:code,songs:Array.from({length:p.songs},(_,i)=>song('mix_master',i===0?tracks:8))});
  for(const [tracks,extra] of [[1,0],[8,0],[9,6000],[24,6000],[25,11000],[48,11000],[8,0]]){
   const q=quote(tracks);
   assert.equal(q.totalCents,p.price+extra,code+' '+tracks);
   assert.equal(q.lines.filter(l=>l.code==='tier').reduce((n,l)=>n+l.quantity*l.unitAmount,0),extra);
   assert.equal(q.songs.reduce((n,s)=>n+s.amountCents,0),q.totalCents);
  }
  assert.throws(()=>quote(49));
 }
 const ep=buildServiceQuote({packageCode:'ep',songs:[song('mix_master',9),song('mix_master',25),song('mix_master',48),song('mix_master',8)]});
 assert.equal(ep.totalCents,72999);
 assert.deepEqual(ep.lines.filter(l=>l.code==='tier').map(l=>l.songIndex),[0,1,2]);
});
test('real separate prices and precise guarantee calculation',()=>{const separate=separatePackagePrices();for(const code of Object.keys(packages) as (keyof typeof packages)[])assert.equal(separate[code],packages[code].separate);assert.equal(guaranteeRefund(12999,44999,51996),5625);assert.equal(customBeat.deposit+customBeat.balance,customBeat.total);});
test('package discounts do not stack with individual discounts',()=>{const discounts=[{target:'all',label:'Test',kind:'percent' as const,amount:10,active:true}];assert.equal(buildServiceQuote({packageCode:'single',songs:[song()]},discounts).totalCents,14999);assert.equal(buildServiceQuote({songs:[song()]},discounts).totalCents,11699);});
test('48 hours, seven business days, holidays and withdrawal delay',()=>{assert.equal(firstVersionEstimate(now,true,true),'2026-10-24T10:00:00.000Z');assert.equal(firstVersionEstimate(now,false,true).slice(0,10),'2026-11-02');assert.equal(firstVersionEstimate(now,true,false),'2026-11-07T10:00:00.000Z');assert.equal(isItalianBusinessDay(new Date('2027-03-29T12:00:00Z')),false);});
test('recording base and unchanged night surcharge',()=>{assert.equal(recordingSessionCents('2026-10-23','23:30',2,2499),4998+2997);assert.equal(recordingSessionCents('2026-10-22','19:30',1,2499),2499);});

import {readFileSync} from 'node:fs';
test('contract copy matches the configured bundle tier and guarantee replaces the old exclusion',()=>{const legal=readFileSync(new URL('../src/data/legal.ts',import.meta.url),'utf8');assert.ok(legal.includes('129,99 EUR, 189,99 EUR e 239,99 EUR'));assert.ok(!legal.includes('GENKS non offre una garanzia commerciale'));assert.ok(legal.includes('56,25 EUR'));});

test('studio packages purchasable with exact included hours and no artificial songs',()=>{
 for(const code of ['voice','turnkey'] as const){const q=buildServiceQuote({packageCode:code,songs:[song()]});assert.equal(q.totalCents,packages[code].price);assert.equal(q.studioMinutes,180);assert.equal(q.hasProduction,true);assert.equal(buildServiceQuote({packageCode:code,songs:[song('mix_master',24)]}).totalCents,packages[code].price+6000);}
 const hours=buildServiceQuote({packageCode:'hours',songs:[]});assert.equal(hours.totalCents,10999);assert.equal(hours.studioMinutes,300);assert.equal(hours.validityDays,90);assert.equal(hours.songs.length,0);assert.equal(hours.hasProduction,false);assert.throws(()=>buildServiceQuote({packageCode:'hours',songs:[],rush:true}));assert.throws(()=>buildServiceQuote({packageCode:'hours',songs:[song()]}));
});
test('each extra changes totals and removals return to the original price',()=>{
 const base=song('mix',8);const q=(extras:{vocalTracks?:number;versions?:boolean;extraRevision?:boolean},rush=false)=>buildServiceQuote({songs:[{...base,...extras}],rush}).totalCents;
 assert.equal(q({}),9999);assert.equal(q({vocalTracks:1}),11499);assert.equal(q({vocalTracks:2}),12999);assert.equal(q({vocalTracks:2,versions:true}),14998);assert.equal(q({vocalTracks:2,versions:true,extraRevision:true}),16498);assert.equal(q({vocalTracks:2,versions:true,extraRevision:true},true),19498);assert.equal(q({}),9999);
});
test('transfer links remain in the private per-song snapshot and unsafe links are rejected',()=>{
 const link='https://www.swisstransfer.com/d/example';const q=buildServiceQuote({songs:[{...song(),fileUrl:link}]});assert.equal(q.songs[0].fileUrl,link);for(const bad of ['javascript:alert(1)','https://','https://user:password@example.com/file'])assert.throws(()=>buildServiceQuote({songs:[{...song(),fileUrl:bad}]}));
});
