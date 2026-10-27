import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseBookingRequest,recordingHoursOnly,hasRequestedDay} from '../src/lib/chatbot/booking-request.ts';
import {knownAnswer} from '../src/lib/chatbot/answers.ts';
const now=new Date('2026-10-27T10:00:00Z');
test('booking questions resolve the Italian weekday, start and requested whole duration',()=>{assert.deepEqual(parseBookingRequest('Voglio prenotare sabato per 3 ore',now),{data:'2026-10-31',ore:3});assert.deepEqual(parseBookingRequest('Sabato alle 15 è libero?',now),{data:'2026-10-31',ore:1,ora:'15:00'});assert.deepEqual(parseBookingRequest('Sabato 3 ore fino all’una di notte',now),{data:'2026-10-31',ore:3,ora:'22:00'});});
test('a release day alone is not mistaken for a studio appointment',()=>{assert.equal(parseBookingRequest('Vorrei il master pronto sabato',now),null);});
test('commercial policy replies retain the 50/50 split and guaranteed server example',()=>{assert.match(knownAnswer('Il beat è tutto mio?')!,/50\/50/);const q=knownAnswer('Se il mix non mi piace?')!;assert.match(q,/30%/);assert.match(q,/17,99/);assert.match(q,/14 giorni/);assert.equal(knownAnswer('Ho un progetto da 60 tracce'),null);});

test('a duration-only quote never invents today as the appointment date',()=>{assert.equal(recordingHoursOnly('Voglio registrare 4 ore'),4);assert.equal(recordingHoursOnly('Mi servono 8 ore di studio'),8);assert.equal(hasRequestedDay('Voglio registrare 4 ore'),false);assert.equal(recordingHoursOnly('Sabato 3 ore fino all’una di notte'),null);});
