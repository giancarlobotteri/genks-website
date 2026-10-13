import test from 'node:test';
import assert from 'node:assert/strict';
import { italianLabel } from '../src/lib/italian.ts';

test('Italian labels translate presentation values without modifying product names', () => {
  assert.equal(italianLabel('approved_awaiting_payment'), 'Approvato, in attesa di pagamento');
  assert.equal(italianLabel('MP3 Lease'), 'Licenza MP3');
  assert.equal(italianLabel('Dark'), 'Scuro');
  assert.equal(italianLabel('BLUE HOUR'), 'BLUE HOUR');
  assert.equal(italianLabel(undefined), '');
});
