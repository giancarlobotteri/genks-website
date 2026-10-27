import test from "node:test";
import assert from "node:assert/strict";
import { emptyProjectSong, priceProjectSongs } from "../src/lib/project-songs.ts";
const song=(tracks=1)=>({...emptyProjectSong(),trackTitle:"Brano prova",description:"Descrizione valida per questo brano",trackCount:tracks});
test("different songs use their own tier and forged amounts are ignored",()=>{
 const songs=priceProjectSongs("mix",[{...song(8),amountCents:1},song(9),song(25)]);
 assert.deepEqual(songs?.map(s=>s.amountCents),[2999,4999,8999]);
 assert.equal(songs?.reduce((sum,s)=>sum+s.amountCents,0),16997);
 assert.deepEqual(priceProjectSongs("mix_master",[song(8),song(24)])?.map(s=>s.amountCents),[5998,9998]);
 assert.equal(priceProjectSongs("master",[song(),song()])?.reduce((sum,s)=>sum+s.amountCents,0),5998);
});
test("an invalid song rejects the whole request without dropping it",()=>{
 for(const value of [[],Array.from({length:21},()=>song()),[song(),song(1001)],[song(),{...song(),description:"short"}],[song(),{...song(),desiredDeadline:"2026-02-30"}],[song(),{...song(),desiredDeadline:"invalid"}],[song(),{...song(),trackCount:"1"}]])assert.equal(priceProjectSongs("mix",value),null);
 assert.equal(priceProjectSongs("master",[song(2)]),null);
 assert.equal(priceProjectSongs("mix",[emptyProjectSong()]),null);
 assert.equal(priceProjectSongs("invalid",[song()]),null);
});
test("per-song notes, dates and references survive normalization",()=>{
 const item={...song(),trackTitle:"  Primo  ",notes:"Nota del primo brano",referenceLinks:"https://example.com/a",desiredDeadline:"2026-11-03"};
 assert.deepEqual(priceProjectSongs("mix",[item])?.[0],{...item,service:"mix",trackTitle:"Primo",amountCents:2999});
 assert.equal(priceProjectSongs("mix",Array.from({length:20},()=>song()))?.length,20);
});
test("each song chooses its own service and its own applicable discount",()=>{
 const songs=[{...song(8),service:"mix"},{...song(),service:"master"},{...song(24),service:"mix_master"}];
 const result=priceProjectSongs("",songs,[{target:"master",label:"Master",kind:"percent",amount:20,active:true}]);
 assert.deepEqual(result?.map(s=>s.amountCents),[2999,2399,9998]);
 assert.equal(result?.reduce((sum,s)=>sum+s.amountCents,0),15396);
 assert.equal(priceProjectSongs("",[{...song(),service:""}]),null);
 assert.equal(priceProjectSongs("mix",[{...song(),service:"invalid"}]),null);
});
