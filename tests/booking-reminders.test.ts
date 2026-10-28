import test from "node:test";
import assert from "node:assert/strict";
import { bookingCalendarUrl, bookingCalendarFile, bookingReminderMessage } from "../src/lib/booking-calendar.ts";
import { renderGenksStudioEmail } from "../src/lib/email-design.ts";
const booking = { id: "test-calendar", reference: "BKG-1234ABCD", starts_at: "2026-10-25T22:30:00Z", ends_at: "2026-10-26T00:30:00Z", updated_at: "2026-10-20T12:00:00Z" };
test("the Google calendar button keeps UTC instants and Italy timezone for overnight sessions", () => {
  const url = new URL(bookingCalendarUrl(booking,true));
  assert.equal(url.origin, "https://calendar.google.com");
  assert.equal(url.searchParams.get("dates"), "20261025T223000Z/20261026T003000Z");
  assert.equal(url.searchParams.get("ctz"), "Europe/Rome");
  assert.match(url.searchParams.get("location")!, /Quintina/);
});
test("personal calendar files contain one private event, stable UID and properly folded location", () => {
  const ics = bookingCalendarFile(booking,true);
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 1);
  assert.match(ics, /UID:booking-test-calendar@prodbygenks.com/);
  assert.match(ics, /CLASS:PRIVATE/);
  assert.match(ics, /DTSTART:20261025T223000Z/);
  assert.match(ics, /DTEND:20261026T003000Z/);
  assert.match(ics.replace(/\r\n /g, ""), /LOCATION:Via Quintina\\, Ponte San Giovanni/);
  for (const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75);
});
test("both reminder types reuse the Gmail dark-mode frame with white text and escaped customer content", () => {
  for (const hours_before of [24, 2]) {
    const message = bookingReminderMessage({ ...booking, name: '<script>private</script>', hours_before });
    assert.match(message.body, /23:30 – 01:30/);
    const html = renderGenksStudioEmail(message);
    assert.match(html, /gmail-blend-screen/);
    assert.match(html, /gmail-blend-difference/);
    assert.match(html, /supported-color-schemes/);
    assert.ok(!html.includes('<script>private</script>'));
    assert.ok(html.includes('&lt;script&gt;private&lt;/script&gt;'));
    for (const colour of html.matchAll(/(?:^|[;"\s])color:(#[a-f0-9]+)/gi)) assert.equal(colour[1].toLowerCase(), "#ffffff");
    assert.match(html, /Aggiungi a Google Calendar/);
  }
});

test('website calendar links disclose only locality; email events retain directions',()=>{assert.equal(new URL(bookingCalendarUrl(booking)).searchParams.get('location'),'Ponte San Giovanni (PG)');assert.doesNotMatch(bookingCalendarFile(booking),/Quintina/);assert.match(bookingCalendarFile(booking,true),/Quintina/);});
