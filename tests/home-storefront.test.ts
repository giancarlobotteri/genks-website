import test from 'node:test';
import assert from 'node:assert/strict';
import {homeStorefront} from '../src/lib/home-storefront.ts';
import {packages} from '../src/lib/service-catalog.ts';
test('home package cards show real totals and savings, in increasing price order',()=>{
 const cards=homeStorefront().filter(c=>c.group==='bundle');
 assert.equal(cards.length,6);
 for(const card of cards.filter(c=>c.id!=="production")){const p=packages[card.id as keyof typeof packages];assert.equal(card.price,p.price);assert.equal(card.separate,p.separate);assert.equal(card.saving,p.separate-p.price);assert.equal(card.href,'/services/project?package='+card.id);}
 assert.deepEqual(cards.map(c=>c.price),cards.map(c=>c.price).sort((a,b)=>a-b));
});
test('home uses the live discount rules without inventing package savings',()=>{
 const cards=homeStorefront([{target:'all',label:'Prova 10%',kind:'percent',amount:10,active:true}]);
 const master=cards.find(c=>c.id==='master')!;
 assert.equal(master.price,2699);assert.equal(master.saving,300);
 const pack=cards.find(c=>c.id==='masters')!;
 assert.equal(pack.price,7999);assert.equal(pack.saving,98);
});
