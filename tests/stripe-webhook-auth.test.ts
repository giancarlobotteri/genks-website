import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function runner({configured=true,valid=false}={}) {
 const code=ts.transpileModule(readFileSync(new URL('../src/app/api/stripe/webhook/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 let verified=0,handled=0;
 const exports:Record<string,unknown>={};
 const modules:Record<string,unknown>={'@/lib/stripe':{getStripe:()=>({webhooks:{constructEvent:()=>{verified++;if(!valid)throw Error('invalid signature');return {type:'test-only'};}}})},'@/lib/stripe-events':{handleStripeEvent:async()=>{handled++;return Response.json({ok:true});}}};
 vm.runInNewContext(code,{exports,require:(name:string)=>{assert.ok(name in modules);return modules[name];},Response,process:{env:configured?{STRIPE_WEBHOOK_SECRET:'TEST-NOT-A-SECRET'}:{}}});
 return {post:exports.POST as(r:Request)=>Promise<Response>,counts:()=>({verified,handled})};
}
const request=(signed=false)=>new Request('https://example.invalid/api/stripe/webhook',{method:'POST',headers:signed?{'stripe-signature':'TEST-NOT-A-SIGNATURE'}:{},body:'{}'});
test('unsigned webhooks are rejected before contacting Stripe or changing data',async()=>{
 const r=runner();assert.equal((await r.post(request())).status,400);assert.deepEqual(r.counts(),{verified:0,handled:0});
});
test('invalid signatures never enter payment handling',async()=>{
 const r=runner();assert.equal((await r.post(request(true))).status,400);assert.deepEqual(r.counts(),{verified:1,handled:0});
});
test('missing configuration remains unavailable and verified events alone reach the handler',async()=>{
 const off=runner({configured:false});assert.equal((await off.post(request(true))).status,503);assert.equal(off.counts().handled,0);
 const on=runner({valid:true});assert.equal((await on.post(request(true))).status,200);assert.deepEqual(on.counts(),{verified:1,handled:1});
});
