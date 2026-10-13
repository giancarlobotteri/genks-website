import assert from "node:assert/strict";
import test from "node:test";
import { cartStorageKey, restoreCart } from "../src/lib/cart-storage.ts";
import type { Beat } from "../src/types/domain.ts";
const catalog = [{ id: "beat-a", licenseIds: ["mp3", "wav"] }] as unknown as Beat[];
test("a second device and a second account never read the first cart", () => {
  const storage = new Map([[cartStorageKey("phone", "guest"), '[{"beatId":"beat-a","selectedLicenseId":"mp3"}]']]);
  assert.equal(restoreCart(storage.get(cartStorageKey("phone", "guest")) ?? null, catalog).length, 1);
  assert.deepEqual(restoreCart(storage.get(cartStorageKey("pc", "guest")) ?? null, catalog), []);
  assert.deepEqual(restoreCart(storage.get(cartStorageKey("phone", "customer-b")) ?? null, catalog), []);
});
test("reload keeps the selection, removes deleted beats and rejects invalid licenses", () => {
  const items = restoreCart('[{"beatId":"beat-a","selectedLicenseId":"wav"},{"beatId":"deleted"},{"beatId":"beat-a"}]', catalog);
  assert.equal(items.length, 1);
  assert.equal(items[0].selectedLicenseId, "wav");
  assert.equal(restoreCart('[{"beatId":"beat-a","selectedLicenseId":"exclusive"}]', catalog)[0].selectedLicenseId, null);
});
test("corrupted or malicious storage cannot break the shop", () => {
  for (const raw of ["bad json", "{}", '[null,5,"x",{}]', null]) assert.deepEqual(restoreCart(raw, catalog), []);
});
