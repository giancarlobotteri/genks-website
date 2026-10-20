import test from "node:test";
import assert from "node:assert/strict";
import { reminderHealth } from "../src/lib/reminder-health.ts";
const now = Date.parse("2026-10-20T16:00:00Z");
const report = { enabled: true, failed: 0, scheduler: { last_checked_at: "2026-10-20T15:59:00Z", last_success_at: "2026-10-20T15:46:00Z", last_http_status: 200, last_failures: 0 } };
test("an idle healthy scheduler is not confused with missing reminder delivery", () => {
  assert.equal(reminderHealth(report, now).issue, false);
  assert.equal(reminderHealth({ ...report, enabled: false }, now).issue, false);
});
test("stopped checks, lost worker contact and provider failures cannot appear healthy", () => {
  assert.equal(reminderHealth(null, now).issue, true);
  for (const change of [{ last_checked_at: "2026-10-20T15:54:00Z" }, { last_success_at: "2026-10-20T15:39:00Z" }, { last_checked_at: "invalid" }, { last_success_at: "2026-10-21T16:00:00Z" }, { last_http_status: 503 }, { last_failures: 1 }])
    assert.equal(reminderHealth({ ...report, scheduler: { ...report.scheduler, ...change } }, now).issue, true);
  assert.equal(reminderHealth({ ...report, failed: 1 }, now).issue, true);
});
