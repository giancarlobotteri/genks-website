import test from "node:test";
import assert from "node:assert/strict";
import { emptyProjectSong, priceProjectSongs } from "../src/lib/project-songs.ts";
const song=(tracks=1)=>({...emptyProjectSong(),trackTitle:"Brano prova",description:"Descrizione valida per questo brano",trackCount:tracks});
test("different songs use their own tier and forged amounts are ignored",()=>{
 const songs=priceProjectSongs("mix",[{...song(8),amountCents:1},song(9),song(25)]);
 assert.deepEqual(songs?.map(s=>s.amountCents),[8999,13999,19999]);
 assert.equal(songs?.reduce((sum,s)=>sum+s.amountCents,0),42997);
 assert.deepEqual(priceProjectSongs("mix_master",[song(8),song(24)])?.map(s=>s.amountCents),[11999,17999]);
 assert.equal(priceProjectSongs("master",[song(),song()])?.reduce((sum,s)=>sum+s.amountCents,0),7998);
});
test("an invalid song rejects the whole request without dropping it",()=>{
 for(const value of [[],Array.from({length:21},()=>song()),[song(),song(49)],[song(),{...song(),description:"short"}],[song(),{...song(),desiredDeadline:"2026-02-30"}],[song(),{...song(),desiredDeadline:"invalid"}],[song(),{...song(),trackCount:"1"}]])assert.equal(priceProjectSongs("mix",value),null);
 assert.equal(priceProjectSongs("master",[song(2)]),null);
 assert.equal(priceProjectSongs("mix",[emptyProjectSong()]),null);
 assert.equal(priceProjectSongs("invalid",[song()]),null);
});
test("per-song notes, dates and references survive normalization",()=>{
 const item={...song(),trackTitle:"  Primo  ",notes:"Nota del primo brano",referenceLinks:"https://example.com/a",desiredDeadline:"2026-11-03"};
 assert.deepEqual(priceProjectSongs("mix",[item])?.[0],{...item,trackTitle:"Primo",amountCents:8999});
 assert.equal(priceProjectSongs("mix",Array.from({length:20},()=>song()))?.length,20);
});
