import assert from 'node:assert/strict';
import { POST } from '../src/app/api/cinematic/quote/route.ts';

// The new site's summaries: totals end in ,99, the cash deposit is 20 € (or the whole total when lower).
const origin = 'https://www.prodbygenks.com';
const booking = hours => ({ kind: 'booking', data: { recordingMode: 'hourly', hours: String(hours), date: '2030-01-04', time: '20:00' } });
const transfer = { fileUrl: 'https://www.swisstransfer.com/d/0b3f6a52-6c1e-4f43-9b7e-2f6a2a1c9d10', filesThirtyDays: 'on', title: 'Prova' };
const cases = [
  ['2 ore, carta', booking(2), 'card', { total: 3999, cardNow: 3999, cashNow: 0, balance: 0 }],
  ['2 ore, contanti', booking(2), 'cash', { total: 3999, cardNow: 0, cashNow: 2000, balance: 1999 }],
  ['1 ora, carta', booking(1), 'card', { total: 1999, cardNow: 1999, cashNow: 0, balance: 0 }],
  ['1 ora, contanti', booking(1), 'cash', { total: 1999, cardNow: 0, cashNow: 1999, balance: 0 }],
  ['mix', { kind: 'remote-project', data: { serviceId: 'mix', stems: '24', ...transfer } }, 'card', { total: 6999, cardNow: 6999, cashNow: 0, balance: 0 }],
  ['master', { kind: 'remote-project', data: { serviceId: 'master', stems: '1', ...transfer } }, 'card', { total: 2999, cardNow: 2999, cashNow: 0, balance: 0 }],
];
for (const [label, order, payment, expected] of cases) {
  const result = await POST(new Request(origin + '/api/cinematic/quote', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...order, payment }),
  }));
  assert.equal(result.status, 200, label);
  assert.match(result.headers.get('content-type') ?? '', /^application\/json/);
  const { total, cardNow, cashNow, balance } = await result.json();
  assert.deepEqual({ total, cardNow, cashNow, balance }, expected, label);
  assert.equal(total % 100, 99, label);
  console.log('GENKS quote check:', label, JSON.stringify(expected));
}
