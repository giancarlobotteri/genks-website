import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {z} from 'zod';
import {funnelService,funnelServices,clientFunnelSteps,funnelPercent} from '../src/lib/funnel.ts';
const schema=z.object({session:z.uuid(),device:z.enum(['mobile','desktop']),service:z.enum(funnelServices),step:z.enum(clientFunnelSteps)}).strict();
function route(consented=true){let writes=0;const exports:Record<string,unknown>={};const code=ts.transpileModule(fs.readFileSync(new URL('../src/app/api/funnel/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const modules:Record<string,unknown>={'zod':{z},'@/lib/auth':{getCurrentUser:async()=>null},'@/lib/funnel-server':{funnelEnabled:()=>true,funnelContextSchema:schema.omit({step:true}),consentGiven:()=>consented,recordFunnel:async()=>{writes++;}},'@/lib/funnel':{clientFunnelSteps},'@/lib/security/request-limit':{allowPublicRequest:async()=>true},'@/lib/supabase/admin':{createSupabaseAdminClient:()=>{throw Error('must not access client database');}}};vm.runInNewContext(code,{exports,require:(name:string)=>modules[name],Response,Request,URL,process:{env:{}}});return {run:exports.POST as (r:Request)=>Promise<Response>,writes:()=>writes};}
const payload={session:'a8ea43ac-8369-4ce9-95f1-6aa04f613f4c',service:'mix',device:'mobile',step:'service_selected'};
const request=(body:unknown,origin='https://www.prodbygenks.com')=>new Request('https://www.prodbygenks.com/api/funnel',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('route classification stores only predefined service names, never queries or order details',()=>{assert.equal(funnelService('/services/project',new URLSearchParams('service=mix&email=private@example.com')),'mix');assert.equal(funnelService('/services/checkout',new URLSearchParams('preventivo=private')),'cart');assert.equal(funnelService('/account/orders'),null);assert.equal(funnelService('/services/project',new URLSearchParams('package=unexpected')),null);});
test('no consent means no event write; foreign origin is rejected',async()=>{const a=route(false);assert.equal((await a.run(request(payload))).status,204);assert.equal(a.writes(),0);assert.equal((await route().run(request(payload,'https://evil.invalid'))).status,403);});
test('browser cannot submit payment confirmations or private fields',async()=>{for(const body of [{...payload,step:'payment_completed'},{...payload,step:'payment_started'},{...payload,email:'private@example.com'},{...payload,url:'https://example.com/private'},{...payload,quote_id:'private'}]){const r=route();assert.equal((await r.run(request(body))).status,400);assert.equal(r.writes(),0);}});
test('allowed event is recorded once through the server adapter',async()=>{const r=route();assert.equal((await r.run(request(payload))).status,204);assert.equal(r.writes(),1);});
test('empty conversion denominator is zero and ratios are stable',()=>{assert.equal(funnelPercent(0,0),0);assert.equal(funnelPercent(1,3),33.3);});
test('opt-in collector never reads values, chat text, IP or full URLs',()=>{const code=fs.readFileSync(new URL('../src/components/commerce/funnel-monitor.tsx',import.meta.url),'utf8');assert.doesNotMatch(code,/\.value|FormData|referrer|textContent|innerText/);const client=fs.readFileSync(new URL('../src/lib/funnel-client.ts',import.meta.url),'utf8');assert.match(client,/if\(!hasFunnelConsent\(\)\)return null/);assert.match(client,/removeItem\(key\)/);});

test('session is created only after consent, events deduplicate and revocation clears it',async()=>{
 const code=ts.transpileModule(fs.readFileSync(new URL('../src/lib/funnel-client.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports:Record<string,unknown>={},memory=new Map<string,string>(),calls:{url:string;method:string;body:Record<string,unknown>}[]=[];
 let cookie='';const document={get cookie(){return cookie;},set cookie(value:string){cookie=value.split(';')[0];}};
 const storage={getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v),removeItem:(k:string)=>memory.delete(k)};
 vm.runInNewContext(code,{exports,require:()=>({funnelService}),document,sessionStorage:storage,crypto:{randomUUID:()=>payload.session},Date,URLSearchParams,location:{pathname:'/services/project',search:'?service=mix',href:'https://www.prodbygenks.com/services/project?service=mix',protocol:'https:'},innerWidth:390,window:{matchMedia:()=>({matches:true}),dispatchEvent:()=>{}},Event:class{},fetch:async(url:string,options:{method:string;body:string})=>{calls.push({url,method:options.method,body:JSON.parse(options.body)});return {ok:true};}});
 const context=exports.funnelContext as ()=>unknown,consent=exports.setFunnelConsent as (v:boolean)=>void,track=exports.trackFunnel as (v:string)=>void;
 assert.equal(context(),undefined);assert.equal(memory.size,0);track('service_selected');assert.equal(calls.length,0);
 consent(true);track('service_selected');track('service_selected');assert.equal(calls.length,1);assert.deepEqual(Object.keys(calls[0].body).sort(),['device','service','session','step']);
 consent(false);assert.equal(memory.size,0);assert.equal(calls.at(-1)!.method,'DELETE');track('checkout_viewed');assert.equal(calls.length,2);
});
test('financial completion is never based on a success-page view and respects test mode',()=>{
 const event=fs.readFileSync(new URL('../src/lib/stripe-events.ts',import.meta.url),'utf8');assert.ok(event.indexOf('completeFunnelPayment(quoteId,session.livemode)')>event.indexOf('if (error || !paymentId) throw'));
 const server=fs.readFileSync(new URL('../src/lib/funnel-server.ts',import.meta.url),'utf8');assert.match(server,/if\(!live\)return/);assert.match(server,/VERCEL_ENV==='production'&&!stripeTestMode/);
 const ui=fs.readFileSync(new URL('../src/components/commerce/funnel-monitor.tsx',import.meta.url),'utf8');assert.doesNotMatch(ui,/payment_completed/);
});
