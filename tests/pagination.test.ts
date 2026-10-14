import { test } from "node:test";
import assert from "node:assert/strict";
import { paginate } from "../src/lib/pagination.ts";

test("catalog pages contain at most five beats, without duplicates or omissions", () => {
  const beats = Array.from({ length: 12 }, (_, i) => i);
  const pages = [1, 2, 3].map(page => paginate(beats, page));
  assert.deepEqual(pages.map(page => page.items.length), [5, 5, 2]);
  assert.deepEqual(pages.flatMap(page => page.items), beats);
});
test("filtering clamps a formerly later page and empty results remain usable", () => {
  assert.deepEqual(paginate([1, 2], 3).items, [1, 2]);
  assert.equal(paginate([], 2).page, 1);
  assert.deepEqual(paginate([], 2).items, []);
});
