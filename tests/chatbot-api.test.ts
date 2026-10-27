import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {z} from 'zod';
function route({enabled=true,allowed=true,answer=async()=> 'Risposta GENKS'}:{enabled?:boolean;allowed?:boolean;answer?:()=>Promise<string|null>}={}){
 const code=ts.transpileModule(fs.readFileSync(new URL('../src/app/api/chat/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports:Record<string,unknown>={};
 const modules:Record<string,unknown>={'zod':{z},'@/lib/chatbot/answers':{knownAnswer:()=>null},'@/lib/chatbot/providers':{rispondi:answer},'@/lib/security/request-limit':{allowPublicRequest:async()=>allowed}};
 vm.runInNewContext(code,{exports,require:(name:string)=>{assert.ok(name in modules);return modules[name];},Response,Request,URL,console,process:{env:enabled?{CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_API_TOKEN:'TEST-NOT-A-TOKEN'}:{}}});
 return exports.POST as (r:Request)=>Promise<Response>;
}
const request=(messages:unknown,origin='https://www.prodbygenks.com')=>new Request('https://www.prodbygenks.com/api/chat',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({messages})});
test('chat provider stays off without credentials; no token is returned',async()=>{let called=false;const r=await route({enabled:false,answer:async()=>{called=true;return 'test';}})(request([{role:'user',content:'EP da sei brani'}]));assert.equal(called,false);assert.equal((await r.json()).active,false);});
test('foreign origins and quota fail closed without provider requests',async()=>{assert.equal((await route()(request([{role:'user',content:'Ciao'}],'https://evil.invalid'))).status,403);assert.equal((await route({allowed:false})(request([{role:'user',content:'Ciao'}]))).status,429);});
test('personal contacts and file URLs never reach the provider',async()=>{let calls=0;const run=route({answer:async()=>{calls++;return 'test';}});for(const content of ['scrivi a me@example.com','il telefono +39 345 1234567','file https://example.com/audio'])assert.match((await (await run(request([{role:'user',content}]))).json()).reply,/Non inserire/);assert.equal(calls,0);});
test('a provider quota error returns the safe fallback',async()=>{const run=route({answer:async()=>null});const body=await (await run(request([{role:'user',content:'Ciao'}]))).text();assert.ok(!body.includes('TEST-NOT-A-TOKEN'));assert.match(body,/scegliere un servizio/);});
