import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {notificationPaymentGuard,type NotificationReaders} from '../src/lib/notification-payment-guard.ts';
const id='00000000-0000-4000-8000-000000000001';
function readers(overrides:Partial<NotificationReaders>={}):NotificationReaders{return {
 order:async()=>({card:true}),payment:async()=>({status:'succeeded'}),
 contract:async()=>({cash:false,paid:false,terminal:false}),reservation:async()=>({cash:false,paid:false,terminal:false}),...overrides};}
for(const service of ['mix','master','mix_master','recording deposit','custom beat','EP','album','studio bundle','hours pack','chat quote','mixed cart']){
 test(service+': creating a card checkout cannot email customer or owner',async()=>{
  for(const audience of ['order','owner'])assert.equal(await notificationPaymentGuard(`v8-${audience}-${id}`,readers()),'cancel');
 });
}
test('cash-only order keeps the customer instructions and owner notification',async()=>{
 for(const audience of ['order','owner'])assert.equal(await notificationPaymentGuard(`v8-${audience}-${id}`,readers({order:async()=>({card:false})})),'send');
});
test('verified payment is the only card receipt, including owner and zero-cost verified checkout',async()=>{
 for(const prefix of ['payment-','v8-paid-owner-'])assert.equal(await notificationPaymentGuard(prefix+id,readers()),'send');
});
for(const status of ['pending','failed','cancelled'])test(status+' payment cannot produce a receipt',async()=>{
 for(const prefix of ['payment-','v8-paid-owner-'])assert.equal(await notificationPaymentGuard(prefix+id,readers({payment:async()=>({status})})),'cancel');
});
test('missing payment or database failure fails closed',async()=>{
 await assert.rejects(notificationPaymentGuard('payment-'+id,readers({payment:async()=>null})));
 await assert.rejects(notificationPaymentGuard('v8-order-'+id,readers({order:async()=>{throw Error('database unavailable');}})));
});
test('legacy contract waits until verified payment, while cash remains available',async()=>{
 assert.equal(await notificationPaymentGuard('contract-'+id,readers()),'defer');
 for(const state of [{cash:false,paid:true,terminal:false},{cash:true,paid:false,terminal:false}])assert.equal(await notificationPaymentGuard('contract-'+id,readers({contract:async()=>state})),'send');
 assert.equal(await notificationPaymentGuard('contract-'+id,readers({contract:async()=>({cash:false,paid:true,terminal:true})})),'cancel');
});
test('legacy booking/project confirmations cannot bypass the central guard',async()=>{
 for(const key of ['reservation-BKG-QA-admin','reservation-PRJ-QA-admin','request-BKG-QA-customer','request-PRJ-QA-customer'])assert.equal(await notificationPaymentGuard(key,readers()),'defer');
});
test('requests to pay a custom amount, support and refund emails are not purchase confirmations',async()=>{
 for(const key of ['quote-'+id,'support-inbox-123','refund-re_123'])assert.equal(await notificationPaymentGuard(key,readers()),'send');
});
test('retry cannot restore the superseded card creation email after settlement',async()=>{
 for(let attempt=0;attempt<3;attempt++)assert.equal(await notificationPaymentGuard('v8-order-'+id,readers()),'cancel');
});
test('guard runs before the send and checkout no longer flushes card creation emails',()=>{
 const notifications=readFileSync(new URL('../src/lib/notifications.ts',import.meta.url),'utf8');
 assert.ok(notifications.indexOf('const decision=await notificationPaymentGuard')<notifications.indexOf('await sendTransactionalEmail('));
 const route=readFileSync(new URL('../src/app/api/services/order/route.ts',import.meta.url),'utf8');
 const afterStripe=route.slice(route.indexOf('const session=await getStripe().checkout.sessions.create'));
 assert.doesNotMatch(afterStripe,/flushNotifications/);
});
