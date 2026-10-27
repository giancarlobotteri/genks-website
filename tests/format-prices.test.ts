import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatPrice} from '../src/lib/format.ts';
test('cached money formatters preserve cents, whole amounts and refunds',()=>{
 for(const [cents,label] of [[0,'0 €'],[1,'0,01 €'],[9999,'99,99 €'],[10000,'100 €'],[-1234,'-12,34 €'],[100000099,'1.000.000,99 €']] as const)assert.equal(formatPrice(cents),label);
});
