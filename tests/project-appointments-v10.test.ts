import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProjectAppointmentsV10} from '../src/lib/project-appointments-v10.ts';
const now=new Date('2026-10-27T10:00:00Z');
test('each EP song reserves its own two-hour slot on the chosen day',()=>{
  const sessions=validateProjectAppointmentsV10([{date:'2026-11-02',time:'19:30',extraHours:0},{date:'2026-11-03',time:'19:30',extraHours:1}],2,now);
  assert.equal(sessions[0].hours,2);assert.equal(sessions[1].hours,3);
  assert.equal(sessions[0].end.getTime()-sessions[0].start.getTime(),7200000);
});
test('overlapping sessions and missing appointments cannot be ordered',()=>{
  assert.throws(()=>validateProjectAppointmentsV10([{date:'2026-11-02',time:'19:30',extraHours:0},{date:'2026-11-02',time:'20:30',extraHours:0}],2,now));
  assert.throws(()=>validateProjectAppointmentsV10([],4,now));
});
test('back-to-back sessions are valid and extra hours must be nonnegative whole hours',()=>{
  assert.equal(validateProjectAppointmentsV10([{date:'2026-11-02',time:'19:30',extraHours:0},{date:'2026-11-02',time:'21:30',extraHours:0}],2,now).length,2);
  assert.throws(()=>validateProjectAppointmentsV10([{date:'2026-11-02',time:'19:30',extraHours:-1},{date:'2026-11-03',time:'19:30',extraHours:0}],2,now));
});
