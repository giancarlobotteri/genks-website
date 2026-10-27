import test from 'node:test';
import assert from 'node:assert/strict';
import {homeStorefront} from '../src/lib/home-storefront.ts';
test('home offers show complete minimum totals, genuine savings and increasing prices',()=>{const c=homeStorefront().filter(x=>x.group==='bundle');assert.equal(c.length,5);assert.deepEqual(c.map(x=>x.price),[6997,6999,7999,10496,37988]);for(const x of c)assert.equal(x.saving,Math.max(0,x.separate-x.price));assert.equal(c.find(x=>x.id==='production')!.saving,15992);});
test('discounted comparisons never invent savings and retain the fixed master pack price',()=>{const c=homeStorefront([{target:'all',label:'Test',kind:'percent',amount:10,active:true}]);assert.equal(c.find(x=>x.id==='master')!.price,2699);assert.equal(c.find(x=>x.id==='masters')!.price,6999);assert.equal(c.find(x=>x.id==='masters')!.saving,1098);});
