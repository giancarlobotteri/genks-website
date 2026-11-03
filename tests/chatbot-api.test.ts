import {knownAnswer} from '../src/lib/chatbot/answers.ts';
import {splitChatRequests,combineChatReplies} from '../src/lib/chatbot/multiple-requests.ts';
import {containsPrivateChatData,safeModelHistory,minimalModelDraft} from '../src/lib/chatbot/privacy.ts';
import {audioIntake,reviewQuote,confirmedQuote,isQuoteConfirmation,reviseQuote} from '../src/lib/chatbot/review.ts';
import {simpleAudioRequest} from '../src/lib/chatbot/audio-request.ts';
import {quoteInputSchema} from '../src/lib/chatbot/checkout.ts';
import {calcolaPreventivo} from '../src/lib/chatbot/pricing.ts';
import {formatQuote} from '../src/lib/chatbot/quote-request.ts';
import {projectIntake} from '../src/lib/chatbot/project-intake.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {z} from 'zod';
function route({enabled=true,allowed=true,realAnswers=false,answer=async()=> ({reply:'Risposta GENKS'})}:{enabled?:boolean;allowed?:boolean;realAnswers?:boolean;answer?:(messages:unknown)=>Promise<{reply:string}|null>}={}){
 const code=ts.transpileModule(fs.readFileSync(new URL('../src/app/api/chat/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports:Record<string,unknown>={};
 const modules:Record<string,unknown>={'zod':{z},'@/lib/chatbot/multiple-requests':{splitChatRequests,combineChatReplies},'@/lib/chatbot/privacy':{containsPrivateChatData,safeModelHistory,minimalModelDraft},'@/lib/chatbot/review':{audioIntake,reviewQuote,confirmedQuote,isQuoteConfirmation,reviseQuote},'@/lib/chatbot/audio-request':{simpleAudioRequest},'@/lib/chatbot/checkout':{quoteInputSchema},'@/lib/chatbot/project-intake':{projectIntake},'@/lib/chatbot/booking-request':{recordingHoursOnly:()=>null},'@/lib/chatbot/pricing':{calcolaPreventivo},'@/lib/chatbot/quote-request':{formatQuote},'@/lib/chatbot/booking':{answerBookingRequest:async()=>null},'@/lib/chatbot/answers':{knownAnswer:realAnswers?knownAnswer:()=>null},'@/lib/chatbot/providers':{rispondi:answer},'@/lib/security/request-limit':{allowPublicRequest:async()=>allowed}};
 vm.runInNewContext(code,{exports,require:(name:string)=>{assert.ok(name in modules);return modules[name];},Response,Request,URL,console,process:{env:enabled?{CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_API_TOKEN:'TEST-NOT-A-TOKEN'}:{}}});
 return exports.POST as (r:Request)=>Promise<Response>;
}
const request=(messages:unknown,origin='https://www.prodbygenks.com',draft?:unknown)=>new Request('https://www.prodbygenks.com/api/chat',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({messages,draft})});
test('chat provider stays off without credentials; no token is returned',async()=>{let called=false;const r=await route({enabled:false,answer:async()=>{called=true;return {reply:'test'};}})(request([{role:'user',content:'Ciao, mi aiuti?'}]));assert.equal(called,false);assert.equal((await r.json()).active,false);});
test('foreign origins and quota fail closed without provider requests',async()=>{assert.equal((await route()(request([{role:'user',content:'Ciao'}],'https://evil.invalid'))).status,403);assert.equal((await route({allowed:false})(request([{role:'user',content:'Ciao'}]))).status,429);});
test('personal contacts and file URLs never reach the provider',async()=>{let calls=0;const run=route({answer:async()=>{calls++;return {reply:'test'};}});for(const content of ['scrivi a me@example.com','il telefono +39 345 1234567','file https://example.com/audio'])assert.match((await (await run(request([{role:'user',content}]))).json()).reply,/Non inserire/);assert.equal(calls,0);});
test('a provider quota error returns the safe fallback',async()=>{const run=route({answer:async()=>null});const body=await (await run(request([{role:'user',content:'Ciao'}]))).text();assert.ok(!body.includes('TEST-NOT-A-TOKEN'));assert.match(body,/scegliere un servizio/);});

test('previous private text is omitted without permanently blocking the conversation',async()=>{let received='';const run=route({answer:async messages=>{received=JSON.stringify(messages);return {reply:'Risposta GENKS'};}});const r=await run(request([{role:'user',content:'me@example.com'},{role:'assistant',content:'Non inserire dati personali.'},{role:'user',content:'Quanto costa?'}]));assert.equal(r.status,200);assert.ok(!received.includes('me@example.com'));assert.match(received,/omesso/);});

test('verified project quotes work without invoking an unavailable AI provider',async()=>{let called=false;const run=route({enabled:false,answer:async()=>{called=true;return {reply:'test'};}});const r=await run(request([{role:'user',content:'EP da 6 brani con 2 ore extra'}]));const body=await r.json();assert.equal(r.status,200);assert.equal(called,false);assert.equal(body.active,true);assert.match(body.reply,/539,99/);assert.match(body.reply,/nuova prenotazione separata/);});

test('custom offer always has a confirmation checkpoint and identical server checkout price',async()=>{
 const run=route({enabled:false});const messages=[{role:'user',content:'EP da 4 brani: due da 8, uno da 18 e uno da 30 tracce'}];
 let body=await (await run(request(messages))).json();assert.equal(body.review,true);assert.match(body.reply,/459,99/);assert.doesNotMatch(body.reply,/preventivo=/);assert.ok(body.draft);
 messages.push({role:'assistant',content:body.reply},{role:'user',content:'brano 2 con 50 tracce'});
 body=await (await run(request(messages,undefined,body.draft))).json();assert.equal(body.review,true);assert.deepEqual(body.draft.progetto.brani.map((b:{tracce:number})=>b.tracce),[8,50,18,30]);assert.doesNotMatch(body.reply,/preventivo=/);
 messages.push({role:'assistant',content:body.reply},{role:'user',content:'Confermo il riepilogo'});
 const confirmed=await (await run(request(messages,undefined,body.draft))).json();assert.equal(confirmed.review,false);assert.match(confirmed.reply,/preventivo=/);assert.match(confirmed.reply,new RegExp(calcolaPreventivo(body.draft).totale.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
test('a standalone edit preserves the other quantities and requires renewed confirmation',async()=>{
 const run=route({enabled:false}),initial={brani:[{servizio:'mix_master',file:12,quantita:3}],ore_registrazione:2};
 const body=await (await run(request([{role:'user',content:'aggiungi consegna veloce'}],undefined,initial))).json();assert.equal(body.review,true);assert.equal(body.draft.brani[0].quantita,3);assert.equal(body.draft.brani[0].file,12);assert.equal(body.draft.ore_registrazione,2);assert.equal(body.draft.brani[0].consegna_veloce,true);assert.doesNotMatch(body.reply,/Acquista/);
});
test('a bare yes without a draft never creates an offer, and injected price fields are rejected',async()=>{
 const run=route({enabled:false});const body=await (await run(request([{role:'user',content:'si'}]))).json();assert.doesNotMatch(body.reply,/preventivo=/);assert.equal((await run(request([{role:'user',content:'confermo'}],undefined,{beat_su_misura:1,price:1}))).status,400);
});

test('audio quote clarifies actual track count instead of guessing and accepts a short reply',async()=>{const run=route({enabled:false});const m=[{role:'user',content:'Vorrei mix e master di 3 brani'}];const a=await(await run(request(m))).json();assert.match(a.reply,/Quante tracce audio separate/);assert.equal(a.draft,undefined);m.push({role:'assistant',content:a.reply},{role:'user',content:'12'});const b=await(await run(request(m))).json();assert.equal(b.review,true);assert.equal(b.draft.brani[0].quantita,3);assert.equal(b.draft.brani[0].file,12);});

test('one message answers both a production quote and an independent question',async()=>{
 let calls=0;const run=route({answer:async()=>{calls++;return {reply:'Puoi lavorare a distanza.'};}});
 const body=await(await run(request([{role:'user',content:'Vorrei 2 tracce con beat GENKS, mix e master e 2 ore di rec per brano. E come lavoro a distanza?'}]))).json();
 assert.equal(body.review,true);assert.equal(body.draft.progetto.brani.length,2);assert.match(body.reply,/179,99/);assert.match(body.reply,/distanza/);assert.equal(calls,1);assert.doesNotMatch(body.reply,/Quante tracce audio separate/);
});
test('separate quotes cannot be accidentally confirmed together',async()=>{
 const body=await(await route({enabled:false})(request([{role:'user',content:'Vorrei EP da 2 brani? Vorrei beat su misura?'}]))).json();
 assert.equal(body.draft,undefined);assert.match(body.reply,/più offerte distinte/);
});

test('EP and album explicitly require GENKS beats and do not ask for files across follow-ups',async()=>{
 const run=route({enabled:false,realAnswers:true});
 for(const format of ['EP','album']){
  const messages:{role:'user'|'assistant';content:string}[]=[{role:'user',content:`Vorrei un ${format}`}];
  let body=await(await run(request(messages))).json();
  assert.match(body.reply,/solo beat prodotti da GENKS/);
  assert.match(body.reply,/Quanti brani/);
  messages.push({role:'assistant',content:body.reply},{role:'user',content:'4'});
  body=await(await run(request(messages))).json();
  assert.equal(body.review,true);assert.equal(body.draft.progetto.brani.length,4);
  assert.match(body.reply,/Solo beat prodotti da GENKS/);
  assert.doesNotMatch(body.reply,/Quante tracce|inserisci.*SwissTransfer|invia.*link/i);
  const draft=body.draft;
  for(const followup of ['Devo inviare il link SwissTransfer?','Non so quante tracce audio separate avranno i beat','Posso usare beat di altri producer?']){
   const answer=await(await run(request([...messages,{role:'assistant',content:body.reply},{role:'user',content:followup}],undefined,draft))).json();
   assert.match(answer.reply,/solo beat prodotti da GENKS/);
   assert.match(answer.reply,/non devi indicare il numero di tracce audio separate né inviare un link SwissTransfer/);
   assert.doesNotMatch(answer.reply,/Quante tracce audio separate ha/);
  }
  const confirmed=await(await run(request([{role:'user',content:'confermo'}],undefined,draft))).json();
  assert.match(confirmed.reply,/solo beat prodotti da GENKS/);
  assert.match(confirmed.reply,/preventivo=/);
 }
});

test('project context prevents standalone audio questions for already included mix and master',async()=>{
 const run=route({enabled:false,realAnswers:true});
 const messages=[{role:'user' as const,content:'Vorrei EP da 4 brani'},{role:'assistant' as const,content:'Beat GENKS inclusi.'},{role:'user' as const,content:'Vorrei mix e master'}];
 const body=await(await run(request(messages))).json();
 assert.equal(body.review,true);assert.equal(body.draft.progetto.brani.length,4);
 assert.doesNotMatch(body.reply,/Quante tracce audio separate ha/);
});
