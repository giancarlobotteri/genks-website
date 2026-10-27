import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculateProduction,type ProductionInput,type ProductionSong} from '../src/lib/production-calculator.ts';
import {productionSelection} from '../src/lib/production-order.ts';
import {quoteOrder,cardOrderLines,orderSummary} from '../src/lib/service-order-v8.ts';
import {calcolaPreventivo,codificaPreventivo} from '../src/lib/chatbot/pricing.ts';
import {calcolaPreventivo as annotated} from '../src/lib/chatbot/pricing-breakdown.ts';
import {quotePreventivo,validateQuoteCode} from '../src/lib/chatbot/checkout.ts';
import {normalizeQuoteRequest} from '../src/lib/chatbot/quote-request.ts';
import {knownAnswer} from '../src/lib/chatbot/answers.ts';
const song=(v:Partial<ProductionSong>={}):ProductionSong=>({servizio:'mix_master',produzione:'genks',tracce:8,artisti:1,revisioni_extra:0,consegna_veloce:false,...v});
const project=(n=4):ProductionInput=>({brani:Array.from({length:n},()=>song()),registrazione:true,ore_extra:0});
const quote=(p:ProductionInput)=>calculateProduction(p,brani=>calcolaPreventivo({brani}));
test('EP pricing changes independently for each production, audio choice and studio hour',()=>{
 const p=project();assert.equal(quote(p).total,63993);
 p.brani[1].produzione='external';assert.equal(quote(p).total,55994);
 p.brani[2].produzione='external';assert.equal(quote(p).total,47995);
 p.ore_extra=2;assert.equal(quote(p).total,50993);
 p.registrazione=false;p.ore_extra=0;assert.equal(quote(p).total,43997);
 p.brani.forEach(s=>s.servizio='none');assert.equal(quote(p).total,15998);
 assert.throws(()=>quote({...p,brani:p.brani.map(s=>({...s,produzione:'external'}))}));
});
test('mixed track tiers preserve package upgrade amounts and guarantees',()=>{
 const p=project();p.registrazione=false;p.brani=p.brani.map((s,i)=>({...s,produzione:'external',tracce:[8,8,18,30][i]}));
 const q=quote(p);assert.equal(q.total,37499);assert.equal(q.shares.reduce((a,b)=>a+b,0),37499);
 assert.equal(q.shares[2]-q.shares[1],2500);assert.ok(Math.abs(q.shares[3]-q.shares[1]-7000)<=1);
});
test('canonical chatbot, annotations, checkout and Stripe conserve cents for EP and album variations',()=>{
 for(const n of [2,4,6,12,20])for(const beats of [0,1,n])for(const hours of [false,true]){
  const p=project(n);p.registrazione=hours;p.ore_extra=hours?2:0;
  p.brani=p.brani.map((s,i)=>({...s,produzione:i<beats?'genks':'external',servizio:i%3===0?'master':i%3===1?'mix':'mix_master',tracce:[8,18,30][i%3],artisti:5,revisioni_extra:i%3,consegna_veloce:i%2===0}));
  const input={progetto:p};const canonical=calcolaPreventivo(input);assert.deepEqual(annotated(input).importi_centesimi,canonical.importi_centesimi);
  const q=quoteOrder([productionSelection(p)],true);assert.equal(q.total,canonical.importi_centesimi.totale);assert.equal(q.balance,canonical.importi_centesimi.saldo);assert.equal(q.total,q.cardNow+q.balance);
  assert.equal(q.parts[0].lines.reduce((a,b)=>a+b.amount,0),q.total);assert.equal(cardOrderLines(q).reduce((a,b)=>a+b.amount,0),q.cardNow);
  assert.equal(quotePreventivo(codificaPreventivo(input)).total,q.total);
  const cash=productionSelection(p);cash.payment='cash';const c=quoteOrder([cash],true);assert.equal(c.cardNow,0);assert.equal(c.total,c.cashNow+c.balance);
 }
});
test('external mix files require a SwissTransfer link and thirty-day confirmation; GENKS production does not',()=>{
 const p=project(2);p.registrazione=false;const selected=productionSelection(p);
 assert.doesNotThrow(()=>quoteOrder([selected],true,new Date(),[],{requireFiles:true}));
 p.brani[0].produzione='external';assert.throws(()=>quoteOrder([selected],true,new Date(),[],{requireFiles:true}));
 selected.songs[0].fileUrl='https://www.swisstransfer.com/d/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
 assert.throws(()=>quoteOrder([selected],true,new Date(),[],{requireFiles:true}));
 selected.songs[0].filesThirtyDays=true;assert.doesNotThrow(()=>quoteOrder([selected],true,new Date(),[],{requireFiles:true}));
 selected.songs[0].fileUrl='https://swisstransfer.com.evil.test/d/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';assert.throws(()=>quoteOrder([selected],true,new Date(),[],{requireFiles:true}));
});
test('unsupported track counts, duplicated services and prices supplied by a browser cannot change amounts',()=>{
 const p=project();p.brani[0].tracce=49;assert.throws(()=>quote(p));
 const code=btoa(JSON.stringify({progetto:project(),total:1}));assert.throws(()=>validateQuoteCode(code));
 assert.throws(()=>validateQuoteCode(codificaPreventivo({progetto:project(),beat_su_misura:1})));
 const s={...productionSelection(project()),total:1,customAmount:0};assert.equal(quoteOrder([s]).total,63993);
});
test('bot cannot invent project count, recording or paid extras; biography and owner contacts use social links',()=>{
 assert.throws(()=>normalizeQuoteRequest({brani:[{servizio:'mix_master',quantita:2}],beat_su_misura:1,ore_registrazione:2},'EP di 2 brani, un beat GENKS, niente registrazione'));
 const noStudio=project(2);noStudio.brani[1].produzione='external';
 const fixed=normalizeQuoteRequest({progetto:noStudio},'EP di 2 brani, un beat GENKS, niente registrazione');assert.equal(fixed.progetto!.registrazione,false);assert.equal(calcolaPreventivo(fixed).importi_centesimi.totale,23997);
 assert.throws(()=>normalizeQuoteRequest({progetto:project(6)},'EP di 4 brani con beat e registrazione'));
 assert.throws(()=>normalizeQuoteRequest({progetto:project(4)},'EP di 4 brani con beat'));
 const p=project();p.registrazione=false;p.brani.forEach(s=>{s.revisioni_extra=2;s.consegna_veloce=true;});
 const normalized=normalizeQuoteRequest({progetto:p},'EP di 4 brani con beat');assert.equal(normalized.progetto!.brani[0].revisioni_extra,0);assert.equal(normalized.progetto!.brani[0].consegna_veloce,false);
 const answer=knownAnswer('Chi è GENKS?')!;assert.match(answer,/^per qualsiasi informazione su Genks visita i suoi profili social/);assert.match(answer,/instagram/);assert.match(answer,/tiktok/);assert.doesNotMatch(knownAnswer('Fammi uno sconto')!,/wa.me|WhatsApp/);
});
test('order snapshot explains each chosen production and recording must have a date at final checkout',()=>{
 const selected=productionSelection(project());assert.throws(()=>quoteOrder([selected],true,new Date(),[],{requireFiles:true}));
 const summary=orderSummary(quoteOrder([selected],true));assert.match(summary,/Brano 1: Produzione GENKS 79,99/);
});
test('studio previews do not invent a nighttime surcharge before the customer chooses a time',()=>{
 const selection={kind:'package' as const,packageCode:'hours',songs:[],hours:5,extraHours:0,date:'',time:'',payment:'card' as const,notes:'',rights:'own' as const};
 const p=quoteOrder([selection],true).parts[0];assert.equal(p.total,8999);assert.equal(p.dueNow,4500);
 assert.throws(()=>quoteOrder([selection],true,new Date(),[],{requireFiles:true}));
 const night=quoteOrder([{...selection,date:'2026-11-07',time:'22:00',hours:3}],true).parts[0];assert.equal(night.total,10997);
});
