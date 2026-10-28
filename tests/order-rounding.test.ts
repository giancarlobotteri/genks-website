import test from 'node:test';
import assert from 'node:assert/strict';
import {totalEnding99,roundOrderQuote,roundingLineName} from '../src/lib/order-rounding.ts';
import {quoteOrder,cardOrderLines,orderSummary,type OrderSelection} from '../src/lib/service-order-v8.ts';
import {quotePreventivo} from '../src/lib/chatbot/checkout.ts';
import {calcolaPreventivo,codificaPreventivo} from '../src/lib/chatbot/pricing.ts';
import {normalizeQuoteRequest} from '../src/lib/chatbot/quote-request.ts';
const base:OrderSelection={kind:'mix_master',songs:[{trackTitle:'QA',trackCount:8,artists:0,revisions:0,rush:false,fileUrl:''}],hours:0,extraHours:0,date:'',time:'',payment:'card',notes:'',rights:'own'};
const beatVoice:OrderSelection={...base,kind:'package',packageCode:'beat_voice',songs:[{...base.songs[0],trackCount:1}],hours:2,date:'2026-12-04',time:'19:30',rights:'split50'};
test('ending ,99: fractional amounts rise, integer euros fall one cent, zero stays zero',()=>{
 for(const [raw,expected] of [[11996,11999],[12000,11999],[11999,11999],[50,99],[100,99],[0,0]])assert.equal(totalEnding99(raw),expected);
 for(const n of [-1,1.2,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>totalEnding99(n));
});
test('one transparent rounding adjustment per aggregate order, immutable and idempotent',()=>{
 const raw=quoteOrder([base,base],true,new Date(),[],{roundTotal:false}),snapshot=JSON.stringify(raw),q=roundOrderQuote(raw);
 assert.equal(raw.total,11996);assert.equal(q.total,11999);assert.equal(JSON.stringify(raw),snapshot);assert.equal(roundOrderQuote(q),q);
 assert.equal(q.parts.flatMap(p=>p.lines).filter(l=>l.name===roundingLineName).length,1);
 assert.equal(cardOrderLines(q).reduce((n,l)=>n+l.amount,0),11999);assert.match(orderSummary(q),/119,99/);
});
test('integer order discount reconciles to positive Stripe items for card and cash',()=>{
 for(const payment of ['card','cash'] as const){
  const raw=quoteOrder([{...base,payment}],true,new Date(),[],{roundTotal:false});const p=raw.parts[0];
  p.lines=[{name:'Servizio concordato',amount:12000,payNow:12000}];p.total=p.dueNow=p.deposit=12000;p.cardNow=payment==='card'?12000:0;p.cashNow=payment==='cash'?12000:0;
  const q=roundOrderQuote({...raw,total:12000,cardNow:p.cardNow,cashNow:p.cashNow});
  assert.equal(q.total,11999);assert.equal(q.cardNow+q.cashNow+q.balance,11999);assert.equal(q.parts[0].lines.at(-1)!.amount,-1);
  assert.equal(cardOrderLines(q).reduce((n,l)=>n+l.amount,0),q.cardNow);assert.ok(cardOrderLines(q).every(l=>l.amount>0));
 }
});
test('studio advances stay fixed; only remaining balance absorbs rounding',()=>{
 for(const [hours,total,deposit] of [[1,1999,1000],[2,3999,2000],[3,5999,2000]])for(const payment of ['card','cash'] as const){
  const q=quoteOrder([{...base,kind:'recording',songs:[],hours,date:'2026-12-04',time:'19:30',payment}]);
  assert.equal(q.total,total);assert.equal(q.cardNow+q.cashNow,deposit);assert.equal(q.balance,total-deposit);
 }
});
test('Beat & Voce includes two hours and beat revision, full payment, genuine saving',()=>{
 for(const payment of ['card','cash'] as const){const q=quoteOrder([{...beatVoice,payment}]);const p=q.parts[0];
  assert.equal(q.total,6499);assert.equal(q.saving,998);assert.equal(p.listTotal,7497);assert.equal(q.balance,0);assert.equal(q.cardNow+q.cashNow,6499);
  assert.equal(p.studioAmount,3466);assert.equal(p.customAmount,3033);assert.equal(p.bookingDeposit,3466);assert.equal(p.guarantees.length,0);
  assert.equal(p.lines.reduce((n,l)=>n+l.amount,0),6499);assert.equal(cardOrderLines(q).reduce((n,l)=>n+l.amount,0),q.cardNow);
 }
 assert.throws(()=>quoteOrder([{...beatVoice,hours:1}]));assert.throws(()=>quoteOrder([{...beatVoice,rights:'own'}]));
 assert.throws(()=>quoteOrder([{...beatVoice,date:'',time:''}],true,new Date(),[],{requireFiles:true}));
 assert.equal(quoteOrder([{...beatVoice,hours:3}]).total,8499);
 assert.equal(quoteOrder([{...beatVoice,time:'23:00'}]).total,7499);
});
test('bot and purchase link calculate identical Beat & Voce offers and rounded totals',()=>{
 for(const input of [{beat_su_misura:1,ore_registrazione:2},{beat_su_misura:1,ore_registrazione:3},{beat_su_misura:2,ore_registrazione:4},{brani:[{servizio:'mix_master' as const,quantita:2}]}]){
  const calculated=calcolaPreventivo(input),q=quotePreventivo(codificaPreventivo(input));
  assert.equal(q.total,calculated.importi_centesimi.totale);assert.equal(q.total%100,99);
  assert.equal(q.total,q.cardNow+q.cashNow+q.balance);assert.equal(q.parts.flatMap(p=>p.lines).reduce((n,l)=>n+l.amount,0),q.total);
 }
 assert.equal(quotePreventivo(codificaPreventivo({beat_su_misura:1,ore_registrazione:2})).total,6499);
});
test('explicitly excluded mix/master never becomes an automatic complete package',()=>{
 const suggested={brani:[{servizio:'mix_master' as const}],beat_su_misura:1,ore_registrazione:2};
 const request=normalizeQuoteRequest(suggested,'Vorrei un beat GENKS su misura e due ore di registrazione, senza mix e senza master. Quanto spendo?');
 assert.deepEqual(request.brani,[]);assert.equal(calcolaPreventivo(request).importi_centesimi.totale,6499);
 assert.equal(normalizeQuoteRequest(suggested,'Voglio beat, registrazione e mix, senza master').brani?.[0].servizio,'mix');
 assert.equal(normalizeQuoteRequest(suggested,'Voglio beat, registrazione e master, senza mix').brani?.[0].servizio,'master');
});
