import { test } from "node:test";
import assert from "node:assert/strict";
import { fromRomeWallTime } from "../src/lib/rome-time.ts";

test("booking wall time follows Rome winter and summer offsets", () => {
  assert.equal(fromRomeWallTime("2026-01-15", "15:00").toISOString(), "2026-01-15T14:00:00.000Z");
  assert.equal(fromRomeWallTime("2026-09-28", "15:00").toISOString(), "2026-09-28T13:00:00.000Z");
});

test("clock-change Sunday keeps 01:30 before the autumn change and matches PostgreSQL for the repeated hour", () => {
  assert.equal(fromRomeWallTime("2026-10-25", "01:30").toISOString(), "2026-10-24T23:30:00.000Z");
  assert.equal(fromRomeWallTime("2026-10-25", "02:30").toISOString(), "2026-10-25T01:30:00.000Z");
  assert.equal(fromRomeWallTime("2026-10-25", "03:30").toISOString(), "2026-10-25T02:30:00.000Z");
});

test("spring missing wall times and invalid dates are rejected rather than shifted to a different appointment", () => {
  assert.ok(Number.isNaN(fromRomeWallTime("2026-03-29", "02:30").getTime()));
  assert.ok(Number.isNaN(fromRomeWallTime("2026-02-30", "12:00").getTime()));
});
