import { test } from "node:test";
import assert from "node:assert/strict";
import { fromRomeWallTime } from "../src/lib/rome-time.ts";

test("booking wall time follows Rome winter and summer offsets", () => {
  assert.equal(fromRomeWallTime("2026-01-15", "15:00").toISOString(), "2026-01-15T14:00:00.000Z");
  assert.equal(fromRomeWallTime("2026-09-28", "15:00").toISOString(), "2026-09-28T13:00:00.000Z");
});
