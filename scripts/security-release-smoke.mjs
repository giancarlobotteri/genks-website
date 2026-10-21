import assert from 'node:assert/strict';
const origin='https://www.prodbygenks.com';
for(const path of ['/admin/search?q=PRJ-TEST-LIVE-211026','/admin/payment-check'])for(const rsc of [false,true]){
 const r=await fetch(origin+path,{redirect:'manual',headers:rsc?{RSC:'1'}:{},signal:AbortSignal.timeout(20000)});
 assert.equal(r.status,307);assert.equal(new URL(r.headers.get('location'),origin).pathname,'/admin-access');assert.match(r.headers.get('cache-control')??'',/no-store/);assert.ok((await r.text()).length<300);
}
const preview=await fetch(origin+'/api/admin/email-preview',{redirect:'manual'});assert.equal(preview.status,401);await preview.body?.cancel();
const html=await (await fetch(origin)).text();
const scripts=[...new Set([...html.matchAll(/<script[^>]+src="([^"?]+\.js)(?:\?[^" ]*)?"/g)].map(m=>new URL(m[1],origin).href).filter(url=>new URL(url).origin===origin))];
assert.ok(scripts.length>0);
let texts=[];
for(let offset=0;offset<scripts.length;offset+=6)texts.push(...await Promise.all(scripts.slice(offset,offset+6).map(async url=>{const r=await fetch(url);assert.equal(r.status,200);return r.text();})));
const bundles=texts.join('\n');
assert.doesNotMatch(bundles,/(?:sk_live|sk_test|whsec|sb_secret)_[A-Za-z0-9]{12,}/,'Server credentials must not be in frontend bundles');
const publicKey=bundles.match(/sb_publishable_[A-Za-z0-9_-]{20,}/)?.[0];
if(publicKey){
 const net=await fetch('https://xoayoldgiwhfnunantsh.supabase.co/rest/v1/rpc/http_get',{method:'POST',headers:{apikey:publicKey,'Content-Type':'application/json','Content-Profile':'net','Accept-Profile':'net'},body:'{}'});
 assert.ok([400,401,403,404,406].includes(net.status));const body=await net.text();assert.match(body,/schema|exposed|PGRST106|Invalid schema/i,'Network schema must not be exposed');
 console.log('PASS: net schema not exposed through the public Data API.');
}
console.log(`PASS: admin HTML/RSC and email preview protected; ${scripts.length} frontend scripts scanned without server credential matches.`);

