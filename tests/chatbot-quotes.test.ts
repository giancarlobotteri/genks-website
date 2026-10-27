import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calcolaPreventivo,codificaPreventivo,verificaPreventivo,type PreventivoInput} from '../src/lib/chatbot/pricing.ts';
import {quotePreventivo} from '../src/lib/chatbot/checkout.ts';
import {cardOrderLines} from '../src/lib/service-order-v8.ts';
import {normalizeQuoteRequest,formatQuote} from '../src/lib/chatbot/quote-request.ts';
const cases:[string,PreventivoInput,number][]=[
 ['mix + master',{brani:[{servizio:'mix_master'}]},5998],
 ['EP 4',{brani:[{servizio:'mix_master',quantita:4}]},23992],
 ['EP diverse fasce',{brani:[8,8,18,30].map(file=>({servizio:'mix_master',file}))},33992],
 ['EP 6',{brani:[{servizio:'mix_master',quantita:6}]},35988],
 ['EP solo mix',{brani:[{servizio:'mix',quantita:4}]},11996],
 ['5 master',{brani:[{servizio:'master',quantita:5}]},12997],
 ['beat studio e mix',{brani:[{servizio:'mix_master'}],ore_registrazione:2,beat_su_misura:1},12495],
 ['1 ora',{ore_registrazione:1},1999],
 ['8 ore',{ore_registrazione:8},13996],
 ['consegna veloce',{brani:[{servizio:'mix_master',consegna_veloce:true}]},7997],
 ['tre artisti',{brani:[{servizio:'mix_master',artisti_correzione_voce:3}]},5998],
 ['tre brani',{brani:[{servizio:'mix_master',quantita:3}]},17994],
 ['quattro ore',{ore_registrazione:4},7996],
 ['sabato tre ore fino all’una',{ore_registrazione:3,mezzore_dopo_mezzanotte:2},6997],
];
for(const [name,input,expected] of cases)test('tabella integrazione: '+name,()=>{
 const original=calcolaPreventivo(input);assert.equal(original.importi_centesimi.totale,expected);
 const code=codificaPreventivo(input);assert.equal(verificaPreventivo(code)?.importi_centesimi.totale,expected);
 for(const method of ['card','cash'] as const){const q=quotePreventivo(code,[],method);assert.equal(q.total,expected);assert.equal(q.balance,original.importi_centesimi.saldo);assert.equal(q.cardNow+q.cashNow,original.importi_centesimi.subito);assert.equal(q.total,q.cardNow+q.cashNow+q.balance);assert.equal(q.parts.reduce((n,p)=>n+p.lines.reduce((s,l)=>s+l.amount,0),0),expected);assert.equal(cardOrderLines(q).reduce((n,l)=>n+l.amount,0),q.cardNow);}
});
test('anticipo un’ora e crediti otto ore',()=>{assert.equal(quotePreventivo(codificaPreventivo({ore_registrazione:1})).cardNow,1000);const q=quotePreventivo(codificaPreventivo({ore_registrazione:8}));assert.equal(q.parts[0].creditMinutes,300);assert.equal(q.parts[0].hours,5);});
test('codici manomessi, prezzi client e richieste senza contenuto sono rifiutati',()=>{for(const code of ['','invalid!',codificaPreventivo({}),btoa(JSON.stringify({brani:[{servizio:'mix',file:1001}]})),btoa(JSON.stringify({brani:[{servizio:'master'}],totale:1}))])assert.throws(()=>quotePreventivo(code));});
test('limiti extra e dati personali nei dettagli sono convalidati',()=>{assert.throws(()=>quotePreventivo(codificaPreventivo({brani:[{servizio:'mix',revisioni_extra:3}]})));assert.throws(()=>quotePreventivo(codificaPreventivo({brani:[{servizio:'master',artisti_correzione_voce:1}]})));assert.throws(()=>quotePreventivo(codificaPreventivo({brani:[{servizio:'mix'}]}),[{files:['javascript:alert(1)']} ]));});
test('una sessione richiede data e ora, anche i crediti richiedono un appuntamento',()=>{assert.throws(()=>quotePreventivo(codificaPreventivo({ore_registrazione:1}),[],'card',true,new Date(),true));assert.throws(()=>quotePreventivo(codificaPreventivo({ore_registrazione:8}),[],'card',true,new Date(),true));});
test('preventivi misti: importi originali invariati e tutte le voci Stripe conservate',()=>{
 for(let n=1;n<=12;n++)for(const ore of [0,1,2,4,5,8,10])for(const beat of [0,1,2]){const input:PreventivoInput={brani:[{servizio:n%2?'mix':'mix_master',quantita:n,file:n%3===0?30:8,revisioni_extra:2,artisti_correzione_voce:2,consegna_veloce:true},{servizio:'master',quantita:3}],ore_registrazione:ore,beat_su_misura:beat};const p=calcolaPreventivo(input),q=quotePreventivo(codificaPreventivo(input));assert.equal(q.total,p.importi_centesimi.totale);assert.equal(q.balance,p.importi_centesimi.saldo);assert.equal(cardOrderLines(q).reduce((n,l)=>n+l.amount,0),q.cardNow);}
});
test('explicit EP distribution cannot double-count the first group',()=>{const fixed=normalizeQuoteRequest({brani:[{servizio:'mix_master',quantita:4,file:8},{servizio:'mix_master',file:18},{servizio:'mix_master',file:30}]},'Ho un EP da 4 brani: due da 8 tracce, uno da 18 e uno da 30');assert.equal(calcolaPreventivo(fixed).importi_centesimi.totale,33992);});
test('the complete beat/recording/mix request includes all components',()=>{const fixed=normalizeQuoteRequest({brani:[{servizio:'mix_master'}]},'Voglio beat, registrazione e mix di un pezzo');assert.equal(calcolaPreventivo(fixed).importi_centesimi.totale,12495);assert.match(formatQuote(fixed,calcolaPreventivo(fixed),''),/124,95/);});
test('a model cannot add voice correction, rush or paid revisions without a customer request',()=>{const fixed=normalizeQuoteRequest({brani:[{servizio:'mix_master',artisti_correzione_voce:1,revisioni_extra:2,consegna_veloce:true}]},'Voglio beat, registrazione e mix di un pezzo');assert.equal(calcolaPreventivo(fixed).importi_centesimi.totale,12495);const asked=normalizeQuoteRequest({brani:[{servizio:'mix_master',artisti_correzione_voce:3}]},'Mix e master con correzione voce per 3 artisti');assert.equal(calcolaPreventivo(asked).importi_centesimi.totale,5998);});
