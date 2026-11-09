import test from 'node:test';
import assert from 'node:assert/strict';
import {serviceOrderNotice} from '../src/lib/service-order-notice.ts';
import {calendarConnectionStatus} from '../src/lib/calendar-connection-status.ts';
test('pending card does not ask for a second payment or an unrelated cash deposit',()=>{
 const text=serviceOrderNotice({paid:false,review:false,awaitingCard:true});
 assert.match(text,/Non ripetere il pagamento/);assert.doesNotMatch(text,/passa in studio|50%|20 €/);
});
test('cash instructions distinguish fixed recording deposits from full package payment',()=>{
 const text=serviceOrderNotice({paid:false,review:false,awaitingCard:false});
 assert.match(text,/20 € di acconto/);assert.match(text,/si pagano per intero/);assert.match(text,/a fine lavoro/);assert.match(text,/metà del tempo/);assert.doesNotMatch(text,/50%/);
});
test('only verified payments show confirmation, while review remains conditional',()=>{
 assert.match(serviceOrderNotice({paid:true,review:false,awaitingCard:true}),/sono confermat/);
 assert.match(serviceOrderNotice({paid:true,review:true,awaitingCard:true}),/prima di confermare/);
});
test('freebusy-only calendar is shown as connected even without write permission',()=>{
 const s=calendarConnectionStatus({busy:true,direct:false,subscription:true});
 assert.equal(s.label,'Libero/occupato collegato');assert.match(s.description,/bloccano gli orari/);assert.match(s.description,/sottoscrizione/);assert.doesNotMatch(s.description,/non bloccano/);
});
test('subscription alone never claims to block external busy events',()=>{
 const s=calendarConnectionStatus({busy:false,direct:false,subscription:true});assert.match(s.description,/non bloccano/);
 assert.equal(calendarConnectionStatus({busy:false,direct:false,subscription:false}).label,'Agenda da collegare');
 assert.match(calendarConnectionStatus({busy:true,direct:true,subscription:false}).description,/direttamente/);
});
