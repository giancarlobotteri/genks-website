import test from 'node:test';
import assert from 'node:assert/strict';
import {recommendServices,type AdvisorInput} from '../src/lib/service-advisor.ts';
import {parseAssistantPrefill,projectAssistantUrl,assistantSongs,assistantDuration} from '../src/lib/assistant-prefill.ts';
import {buildServiceQuote} from '../src/lib/service-quote.ts';
const input=(overrides:Partial<AdvisorInput>={}):AdvisorInput=>({service:'mix_master',tracks:[8],studioHours:0,beat:false,versions:false,extraRevision:false,vocalTracks:0,mode:'remote',...overrides});
test('advisor chooses individual services, included extras and every audio bundle',()=>{
 assert.equal(recommendServices(input()).totalCents,12999);
 const single=recommendServices(input({versions:true,extraRevision:true}));
 assert.equal(single.totalCents,14999);assert.equal(single.parts[0].packageCode,'single');assert.equal(single.savingCents,1499);
 const ep=recommendServices(input({tracks:[8,8,8,8]}));assert.equal(ep.totalCents,44999);assert.equal(ep.parts[0].packageCode,'ep');
 assert.equal(recommendServices(input({tracks:[9,25,8,8]})).totalCents,61999);
 for(const [count,price] of [[1,3999],[2,7998],[3,9999],[6,19998]])assert.equal(recommendServices(input({service:'master',tracks:Array(count).fill(1)})).totalCents,price);
});
test('advisor includes studio, beat and hours packs only when cheaper',()=>{
 const voice=recommendServices(input({studioHours:3}));assert.equal(voice.totalCents,18999);assert.equal(voice.parts[0].packageCode,'voice');
 const turnkey=recommendServices(input({studioHours:3,beat:true}));assert.equal(turnkey.totalCents,39999);assert.equal(turnkey.parts[0].packageCode,'turnkey');
 for(const [hours,price] of [[1,2499],[5,10999],[6,13498]])assert.equal(recommendServices(input({service:'recording',tracks:[],studioHours:hours})).totalCents,price);
 assert.equal(recommendServices(input({service:'custom',tracks:[]})).totalCents,24999);
});
test('active discounts can make individual services cheaper than bundles',()=>{
 const plan=recommendServices(input({tracks:[8,8,8,8]}),[{target:'all',label:'Promo',kind:'percent',amount:50,active:true}]);
 assert.equal(plan.totalCents,26000);assert.equal(plan.parts.length,1);assert.equal(plan.parts[0].packageCode,undefined);
 assert.deepEqual(plan.parts[0].tracks,[8,8,8,8]);
});
test('every proposed project URL produces a valid form and identical service quote',()=>{
 for(const request of [input(),input({versions:true,extraRevision:true}),input({tracks:[9,25,8,8],vocalTracks:2}),input({studioHours:3,beat:true}),input({service:'master',tracks:[1,1,1]})]){
  const plan=recommendServices(request);
  assert.equal(plan.totalCents,plan.parts.reduce((n,p)=>n+p.priceCents,0));
  for(const part of plan.parts.filter(p=>p.kind==='project'&&p.packageCode!=='hours')){
   const url=new URL(part.href,'https://www.prodbygenks.com'),prefill=parseAssistantPrefill(url.searchParams.get('a'),url.searchParams.get('package')??'');
   assert.ok(prefill);assert.deepEqual(prefill.tracks,part.tracks);assert.equal(prefill.vocalTracks,request.vocalTracks);
   const songs=assistantSongs(prefill);assert.equal(songs.length,part.tracks?.length);assert.equal(songs[0].trackTitle,'');
   assert.equal(buildServiceQuote({songs:songs.map(s=>({...s,trackTitle:'Test',description:'Descrizione test valida'})),packageCode:part.packageCode??''}).totalCents,part.priceCents);
  }
 }
});
test('unsafe or incompatible prefill is rejected, prices and personal details ignored',()=>{
 const p={service:'mix_master' as const,tracks:[9],versions:true,extraRevision:false,vocalTracks:2,mode:'remote' as const};
 const url=new URL(projectAssistantUrl(p),'https://www.prodbygenks.com');assert.deepEqual(parseAssistantPrefill(url.searchParams.get('a')),p);
 assert.deepEqual(parseAssistantPrefill(JSON.stringify({...p,price:1,email:'private@example.com',consent:true})),p);
 assert.equal(parseAssistantPrefill(JSON.stringify(p),'ep'),null);
 assert.equal(parseAssistantPrefill(JSON.stringify({...p,tracks:[49]})),null);
 assert.equal(parseAssistantPrefill(JSON.stringify({...p,service:'master'})),null);
 assert.equal(parseAssistantPrefill('{'),null);
 assert.equal(assistantDuration('1.25'),1.25);assert.equal(assistantDuration('-1'),1);assert.equal(assistantDuration('99'),1);
});
test('invalid inputs never yield a misleading zero-price offer',()=>{
 assert.equal(recommendServices(input({tracks:[49]})).needsQuote,true);
 assert.throws(()=>recommendServices(input({tracks:[]})));
 assert.throws(()=>recommendServices(input({service:'recording',tracks:[],studioHours:0})));
 assert.throws(()=>recommendServices(input({studioHours:.3})));
 assert.throws(()=>recommendServices(input({vocalTracks:9})));
});
