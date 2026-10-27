import test from 'node:test';
import assert from 'node:assert/strict';
import {availableSlots} from '../src/lib/booking-slots.ts';

test('Thursday reopens at the end of a booking and one hour must finish by midnight',()=>{
 const rules=[{weekday:4,start_time:'19:30',end_time:'00:00',ends_next_day:true,flexible_close:false,slot_minutes:30,buffer_minutes:0}];
 const now=new Date('2026-10-27T12:00:00Z');
 const busy=[{starts_at:'2026-10-29T20:00:00Z',ends_at:'2026-10-29T22:00:00Z'}];
 const occupied=availableSlots('2026-10-29',1,rules,busy,now);
 assert(!occupied.includes('20:30'));
 assert(!occupied.includes('22:30'));
 assert(occupied.includes('23:00'));
 assert(!occupied.includes('23:30'));
 const removed=availableSlots('2026-10-29',1,rules,[],now);
 assert.deepEqual(removed,['19:30','20:00','20:30','21:00','21:30','22:00','22:30','23:00']);
});
