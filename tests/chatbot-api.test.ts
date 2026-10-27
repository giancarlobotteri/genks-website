import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {z} from 'zod';
import {calcolaPreventivo,PREVENTIVO_TOOL} from '../src/lib/chatbot/pricing.ts';
import {quoteInputSchema} from '../src/lib/chatbot/checkout.ts';
function route({enabled=true,allowed=true,fetcher=async()=>Response.json({})}:{enabled?:boolean;allowed?:boolean;fetcher?:(url:string,init:RequestInit)=>Promise<Response>}={}){
 const code=ts.transpileModule(fs.readFileSync(new URL('../src/app/api/chat/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports:Record<string,unknown>={};
 const modules:Record<string,unknown>={'zod':{z},'@/lib/chatbot/prompt':{SYSTEM_PROMPT:'GENKS only'},'@/lib/chatbot/pricing':{calcolaPreventivo,PREVENTIVO_TOOL},'@/lib/chatbot/checkout':{quoteInputSchema},'@/lib/chatbot/booking':{BOOKING_TOOL:{name:'orari_disponibili'},availableBookingLinks:async()=>({orari:[{inizio:'19:30',link:'https://www.prodbygenks.com/services/recording?date=2026-12-11&hours=3&start=19%3A30'}]})},'@/lib/security/request-limit':{allowPublicRequest:async()=>allowed}};
 vm.runInNewContext(code,{exports,require:(name:string)=>{assert.ok(name in modules);return modules[name];},Response,Request,URL,AbortSignal,Date,console,process:{env:{GEMINI_API_KEY:'TEST-NOT-A-KEY',GENKS_GEMINI_ENABLED:enabled?'true':'false'}},fetch:fetcher});
 return exports.POST as (r:Request)=>Promise<Response>;
}
const request=(messages:unknown,origin='https://www.prodbygenks.com')=>new Request('https://www.prodbygenks.com/api/chat',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({messages})});
test('chat provider stays off until explicit activation; no key is returned',async()=>{let called=false;const r=await route({enabled:false,fetcher:async()=>{called=true;return Response.json({});}})(request([{role:'user',content:'EP da sei brani'}]));assert.equal(called,false);assert.equal((await r.json()).active,false);});
test('foreign origins and quota fail closed without provider requests',async()=>{assert.equal((await route()(request([{role:'user',content:'Ciao'}],'https://evil.invalid'))).status,403);assert.equal((await route({allowed:false})(request([{role:'user',content:'Ciao'}]))).status,429);});
test('personal contacts and file URLs never reach Google',async()=>{let calls=0;const run=route({fetcher:async()=>{calls++;return Response.json({});}});for(const content of ['scrivi a me@example.com','il telefono +39 345 1234567','file https://example.com/audio'])assert.match((await (await run(request([{role:'user',content}]))).json()).reply,/Non inserire/);assert.equal(calls,0);});
test('tool loop uses requested model, preserves signatures and calculator prices',async()=>{let count=0;const run=route({fetcher:async(url,init)=>{assert.match(url,/gemini-3\.5-flash-lite:generateContent$/);assert.equal(new Headers(init.headers).get('x-goog-api-key'),'TEST-NOT-A-KEY');const data=JSON.parse(String(init.body));if(count++===0)return Response.json({candidates:[{content:{parts:[{functionCall:{name:'calcola_preventivo',args:{brani:[{servizio:'mix_master',quantita:6}]}},thoughtSignature:'test-signature'}]}}]});assert.equal(data.contents[1].parts[0].thoughtSignature,'test-signature');assert.equal(data.contents[2].parts[0].functionResponse.response.result.importi_centesimi.totale,41999);return Response.json({candidates:[{content:{parts:[{text:'EP da 6 brani: 419,99 €'}]}}]});}});assert.match((await (await run(request([{role:'user',content:'quanto costa un EP da 6 brani?'}]))).json()).reply,/419,99/);assert.equal(count,2);});
test('provider errors have a safe fallback and do not leak response bodies',async()=>{const run=route({fetcher:async()=>new Response('private provider diagnostic',{status:429})});const body=await (await run(request([{role:'user',content:'Ciao'}]))).text();assert.ok(!body.includes('private provider'));assert.ok(!body.includes('TEST-NOT-A-KEY'));});
