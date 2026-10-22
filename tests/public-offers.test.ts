import test from "node:test";
import assert from "node:assert/strict";
import {discountPrice,publicDiscounts,type PublicDiscount} from "../src/lib/public-discounts.ts";
import {rankInterests} from "../src/lib/interest-ranking.ts";
const rule=(target:string,amount=20):PublicDiscount=>({target,amount,kind:"percent",active:true,label:"Test"});
test("discount precedence is specific before group before global, without stacking",()=>{
 assert.equal(discountPrice(8999,["mix","projects","services"],[rule("all",10),rule("mix",20)]),7199);
 assert.equal(discountPrice(8999,["mix","projects","services"],[rule("all",10),rule("projects",15)]),7649);
 assert.equal(discountPrice(2999,["beat:a","license:basic","beats"],[rule("license:basic",30),rule("beat:a",10)]),2699);
 assert.equal(discountPrice(3999,["master"],[{...rule("all"),kind:"fixed",amount:1000}]),2999);
 assert.equal(discountPrice(100,["master"],[rule("all",99)]),50);
 assert.equal(discountPrice(3999,["master"],[{...rule("all"),active:false}]),3999);
 assert.deepEqual(publicDiscounts({rules:[{...rule("all"),amount:100},rule("mix")]}),[rule("mix")]);
});
test("local suggestions rank matching genres and stay within the published catalogue",()=>{
 const beats=[{id:"a",slug:"a",title:"A",genre:"Trap",mood:"Dark",bpm:140,cover:"a"},{id:"b",slug:"b",title:"B",genre:"Pop",mood:"Bright",bpm:90,cover:"b"},{id:"c",slug:"c",title:"C",genre:"Trap",mood:"Dark",bpm:145,cover:"c"}];
 assert.deepEqual(rankInterests(beats,["a","missing"]).map(x=>x.id),["a","c","b"]);
 assert.deepEqual(rankInterests(beats,[]).map(x=>x.id),["a","b","c"]);
});
