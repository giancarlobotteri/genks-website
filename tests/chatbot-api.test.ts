import {calcolaPreventivo} from '../src/lib/chatbot/pricing.ts';
import {formatQuote} from '../src/lib/chatbot/quote-request.ts';
import {projectIntake} from '../src/lib/chatbot/project-intake.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {z} from 'zod';
function route({enabled=true,allowed=true,answer=async()=> 'Risposta GENKS'}:{enabled?:boolean;allowed?:boolean;answer?:(messages:unknown)=>Promise<string|null>}={}){
 const code=ts.transpileModule(fs.readFileSync(new URL('../src/app/api/chat/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports:Record<string,unknown>={};
 const modules:Record<string,unknown>={'zod':{z},'@/lib/chatbot/project-intake':{projectIntake},'@/lib/chatbot/booking-request':{recordingHoursOnly:()=>null},'@/lib/chatbot/pricing':{calcolaPreventivo},'@/lib/chatbot/quote-request':{formatQuote},'@/lib/chatbot/booking':{answerBookingRequest:async()=>null},'@/lib/chatbot/answers':{knownAnswer:()=>null},'@/lib/chatbot/providers':{rispondi:answer},'@/lib/security/request-limit':{allowPublicRequest:async()=>allowed}};
 vm.runInNewContext(code,{exports,require:(name:string)=>{assert.ok(name in modules);return modules[name];},Response,Request,URL,console,process:{env:enabled?{CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_API_TOKEN:'TEST-NOT-A-TOKEN'}:{}}});
 return exports.POST as (r:Request)=>Promise<Response>;
}
const request=(messages:unknown,origin='https://www.prodbygenks.com')=>new Request('https://www.prodbygenks.com/api/chat',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({messages})});
test('chat provider stays off without credentials; no token is returned',async()=>{let called=false;const r=await route({enabled:false,answer:async()=>{called=true;return 'test';}})(request([{role:'user',content:'Ciao, mi aiuti?'}]));assert.equal(called,false);assert.equal((await r.json()).active,false);});
test('foreign origins and quota fail closed without provider requests',async()=>{assert.equal((await route()(request([{role:'user',content:'Ciao'}],'https://evil.invalid'))).status,403);assert.equal((await route({allowed:false})(request([{role:'user',content:'Ciao'}]))).status,429);});
test('personal contacts and file URLs never reach the provider',async()=>{let calls=0;const run=route({answer:async()=>{calls++;return 'test';}});for(const content of ['scrivi a me@example.com','il telefono +39 345 1234567','file https://example.com/audio'])assert.match((await (await run(request([{role:'user',content}]))).json()).reply,/Non inserire/);assert.equal(calls,0);});
test('a provider quota error returns the safe fallback',async()=>{const run=route({answer:async()=>null});const body=await (await run(request([{role:'user',content:'Ciao'}]))).text();assert.ok(!body.includes('TEST-NOT-A-TOKEN'));assert.match(body,/scegliere un servizio/);});

test('previous private text is omitted without permanently blocking the conversation',async()=>{let received='';const run=route({answer:async messages=>{received=JSON.stringify(messages);return 'Risposta GENKS';}});const r=await run(request([{role:'user',content:'me@example.com'},{role:'assistant',content:'Non inserire dati personali.'},{role:'user',content:'Quanto costa?'}]));assert.equal(r.status,200);assert.ok(!received.includes('me@example.com'));assert.match(received,/omesso/);});

test('verified project quotes work without invoking an unavailable AI provider',async()=>{let called=false;const run=route({enabled:false,answer:async()=>{called=true;return 'test';}});const r=await run(request([{role:'user',content:'EP da 6 brani con 2 ore extra'}]));const body=await r.json();assert.equal(r.status,200);assert.equal(called,false);assert.equal(body.active,true);assert.match(body.reply,/569,82/);assert.match(body.reply,/nuova prenotazione studio/);});
