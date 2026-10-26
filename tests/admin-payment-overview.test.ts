import test from 'node:test';
import assert from 'node:assert/strict';
import {paymentOverview,type ReceiptMovement} from '../src/lib/admin-payment-overview.ts';
const movement=(amount:number,other:Partial<ReceiptMovement>={}):ReceiptMovement=>({amount_cents:amount,refunded_cents:0,status:'succeeded',review_reason:null,disputed:false,...other});
test('advance and balance appear separately without counting unpaid requests as receipts',()=>{assert.deepEqual(paymentOverview(3998,[movement(1999)]),{received:1999,refunded:0,net:1999,outstanding:1999,review:false});assert.equal(paymentOverview(3998,[movement(1999),movement(1999)]).outstanding,0);assert.equal(paymentOverview(3998,[movement(3998,{status:'failed'})]).received,0);});
test('custom payment is pending until an actual receipt exists',()=>{assert.equal(paymentOverview(1234,[]).outstanding,1234);assert.equal(paymentOverview(1234,[movement(1234)]).outstanding,0);});
test('refunds and disputes require review rather than an automatic new charge',()=>{const r=paymentOverview(1234,[movement(1234,{refunded_cents:500})]);assert.equal(r.net,734);assert.equal(r.outstanding,0);assert.equal(r.review,true);assert.equal(paymentOverview(1234,[movement(1234,{disputed:true})]).review,true);});
