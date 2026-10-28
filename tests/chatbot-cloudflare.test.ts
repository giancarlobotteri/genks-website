import {reviewQuote,type ChatResult} from '../src/lib/chatbot/review.ts';
import {normalizeQuoteRequest,formatQuote,prepareQuoteArguments} from '../src/lib/chatbot/quote-request.ts';
import {hasRequestedDay} from '../src/lib/chatbot/booking-request.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {calcolaPreventivo,codificaPreventivo,PREVENTIVO_TOOL} from '../src/lib/chatbot/pricing.ts';
import {serviceAmount} from '../src/lib/service-rates.ts';
import {quotePreventivo,quoteInputSchema} from '../src/lib/chatbot/checkout.ts';
type Chat={role:'user'|'assistant';content:string};
function provider(fetcher:(url:string,init:RequestInit)=>Promise<Response>,env:Record<string,string>={}){
 const code=ts.transpileModule(fs.readFileSync(new URL('../src/lib/chatbot/providers.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports:Record<string,unknown>={};
 const modules:Record<string,unknown>={'./review':{reviewQuote},'./booking-request':{hasRequestedDay},'./quote-request':{normalizeQuoteRequest,formatQuote,prepareQuoteArguments},'./prompt':{SYSTEM_PROMPT:'GENKS only'},'./pricing':{calcolaPreventivo,codificaPreventivo,PREVENTIVO_TOOL},'./checkout':{quoteInputSchema,quotePreventivo},'../service-rates':{serviceAmount},'./booking':{BOOKING_TOOL:{name:'orari_disponibili',description:'Availability',parameters:{type:'OBJECT',properties:{data:{type:'STRING'},ore:{type:'INTEGER'}}}},availableBookingLinks:async()=>({data:'2026-11-07',ore:3,orari:[{inizio:'10:00',link:'https://www.prodbygenks.com/services/recording?date=2026-11-07&hours=3&start=10%3A00'}]})},'@/lib/security/request-limit':{allowPublicRequest:async()=>true}};
 vm.runInNewContext(code,{exports,require:(name:string)=>{assert.ok(name in modules);return modules[name];},Response,URL,AbortSignal,Date,console,process:{env:{CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_API_TOKEN:'TEST-NOT-A-TOKEN',...env}},fetch:fetcher});return exports.rispondi as (m:Chat[])=>Promise<ChatResult|null>;
}
test('Cloudflare tool calling preserves the selected model and exact server quote',async()=>{let calls=0;const run=provider(async(url,init)=>{assert.equal(url,'https://api.cloudflare.com/client/v4/accounts/'+ 'a'.repeat(32)+'/ai/v1/chat/completions');assert.equal(new Headers(init.headers).get('Authorization'),'Bearer TEST-NOT-A-TOKEN');const b=JSON.parse(String(init.body));assert.equal(b.model,'@cf/qwen/qwen3-30b-a3b-fp8');assert.deepEqual(b.tools.map((t:{function:{parameters:{type:string}}})=>t.function.parameters.type),['object','object']);if(calls++===0)return Response.json({choices:[{message:{content:null,tool_calls:[{id:'quote1',type:'function',function:{name:'calcola_preventivo',arguments:JSON.stringify({brani:[{servizio:'mix_master',quantita:6}]})}}]}}]});assert.equal(b.messages.at(-2).content,'');assert.equal(b.messages.at(-1).role,'tool');assert.equal(b.messages.at(-1).tool_call_id,'quote1');assert.equal(JSON.parse(b.messages.at(-1).content).importi_centesimi.totale,35999);return Response.json({choices:[{message:{content:'<think>private reasoning</think>EP 359,99 €'}}]});});assert.match((await run([{role:'user',content:'EP da 6 brani'}]))!.reply,/359,99/);assert.equal(calls,1);});
test('availability tool returns safe prefilled booking links',async()=>{let calls=0;const run=provider(async(_url,init)=>{const b=JSON.parse(String(init.body));if(calls++===0)return Response.json({choices:[{message:{tool_calls:[{id:'slot1',function:{name:'orari_disponibili',arguments:'{"data":"2026-11-07","ore":3}'}}]}}]});const result=JSON.parse(b.messages.at(-1).content);assert.match(result.orari[0].link,/hours=3/);return Response.json({choices:[{message:{content:'Puoi verificare le 10:00 dal calendario.'}}]});});assert.match((await run([{role:'user',content:'sabato tre ore'}]))!.reply,/3 ore/);});
test('neither provider overrides nor model overrides can activate a different or paid model',async()=>{let calls=0;const fetcher=async()=>{calls++;return Response.json({});};assert.equal(await provider(fetcher,{AI_PROVIDER:'gemini'})([{role:'user',content:'Ciao'}]),null);assert.equal(await provider(fetcher,{CF_MODEL:'different-model'})([{role:'user',content:'Ciao'}]),null);assert.equal(calls,0);});
test('Cloudflare quota errors cannot expose diagnostic bodies',async()=>{const run=provider(async()=>new Response('private secret diagnostic',{status:429}));assert.equal(await run([{role:'user',content:'Ciao'}]),null);});

test('a failed tool cannot claim a future recalculation without doing it in this response',async()=>{
 let calls=0;const run=provider(async()=>{calls++;if(calls===1)return Response.json({choices:[{message:{tool_calls:[{id:'bad',function:{name:'calcola_preventivo',arguments:'{"progetto":{}}'}}]}}]});if(calls===2)return Response.json({choices:[{message:{content:'Ho corretto il problema, provo a ricalcolarlo. Un attimo per favore.'}}]});return Response.json({choices:[{message:{tool_calls:[{id:'good',function:{name:'calcola_preventivo',arguments:'{"brani":[{"servizio":"mix_master","quantita":6}]}'}}]}}]});
 });
 const reply=await run([{role:'user',content:'EP da 6 brani con mix e master'}]);assert.equal(calls,3);assert.match(reply!.reply,/359,99/);assert.doesNotMatch(reply!.reply,/un attimo|provo a ricalcol/i);
});

test('multiple partial calculator calls must be merged before showing a review',async()=>{
 let calls=0;const run=provider(async()=>{calls++;return Response.json({choices:[{message:{tool_calls:calls===1?[{id:'one',function:{name:'calcola_preventivo',arguments:'{"brani":[{"servizio":"mix","quantita":2}]}'}},{id:'two',function:{name:'calcola_preventivo',arguments:'{"brani":[{"servizio":"master","quantita":3}]}'}}]:[{id:'merged',function:{name:'calcola_preventivo',arguments:'{"brani":[{"servizio":"mix","quantita":2},{"servizio":"master","quantita":3}]}'}}]}}]});});
 const r=await run([{role:'user',content:'Voglio due mix e tre master, senza registrazione'}]);assert.equal(calls,2);assert.equal(r!.review,true);assert.equal(r!.draft!.brani!.length,2);assert.doesNotMatch(r!.reply,/preventivo=/);
});

test('a subgroup of three mastered songs cannot override a mixed five-song request',()=>{const input={brani:[{servizio:'mix' as const,file:12},{servizio:'mix' as const,file:30},{servizio:'master' as const,quantita:3}]};const text='Ho due mix da fare: il primo ha 12 tracce, il secondo 30. Altri tre brani sono già mixati e voglio solo il master. Non voglio registrazione né beat.';const q=normalizeQuoteRequest(input,text);assert.equal(q.brani!.reduce((n,b)=>n+(b.quantita??1),0),5);assert.equal(calcolaPreventivo(q).importi_centesimi.totale,20999);});
