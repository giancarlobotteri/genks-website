import assert from 'node:assert/strict';
import { POST } from '../src/app/api/cinematic/quote/route.ts';

const origin = 'https://www.prodbygenks.com';
const data = { recordingMode: 'hourly', hours: '2', date: '2030-01-04', time: '20:00' };
for (const [payment, expected] of [
  ['card', { total: 3998, cardNow: 3998, cashNow: 0, balance: 0 }],
  ['cash', { total: 3998, cardNow: 0, cashNow: 2000, balance: 1998 }],
]) {
  const result = await POST(new Request(origin + '/api/cinematic/quote', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'booking', payment, data }),
  }));
  assert.equal(result.status, 200);
  assert.match(result.headers.get('content-type') ?? '', /^application\/json/);
  const { total, cardNow, cashNow, balance } = await result.json();
  assert.deepEqual({ total, cardNow, cashNow, balance }, expected);
  console.log('GENKS quote check:', payment, JSON.stringify(expected));
}
