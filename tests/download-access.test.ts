import test from "node:test";
import assert from "node:assert/strict";
import { allowedDownloadKinds } from "../src/lib/commerce/download-access.ts";
import { assetRegistrationSchema } from "../src/lib/commerce/asset-registration.ts";

const grant = { customer_id: "buyer", beat_id: "beat", license_type_id: "license", order_item_id: "item", revoked_at: null };
const item = { id: "item", order_id: "order", beat_id: "beat", license_type_id: "license", license_terms_snapshot: { includedAssets: ["mp3", "wav"] } };
const order = { id: "order", customer_id: "buyer", status: "paid", paid_at: "2026-10-13T10:00:00Z", refunded_at: null };

test("only the paid license snapshot grants its included premium files", () => {
  assert.deepEqual(allowedDownloadKinds(grant, item, order, "buyer"), ["mp3", "wav"]);
  assert.deepEqual(allowedDownloadKinds(grant, { ...item, license_terms_snapshot: { includedAssets: ["mp3", "preview", "license", "mp3"] } }, order, "buyer"), ["mp3"]);
  assert.deepEqual(allowedDownloadKinds(grant, { ...item, license_terms_snapshot: {} }, order, "buyer"), []);
});

test("pending, failed, cancelled, refunded or revoked purchases never grant a download", () => {
  for (const status of ["pending", "failed", "cancelled", "refunded"]) assert.deepEqual(allowedDownloadKinds(grant, item, { ...order, status }, "buyer"), []);
  assert.deepEqual(allowedDownloadKinds(grant, item, { ...order, paid_at: null }, "buyer"), []);
  assert.deepEqual(allowedDownloadKinds(grant, item, { ...order, refunded_at: "2026-10-14T00:00:00Z" }, "buyer"), []);
  assert.deepEqual(allowedDownloadKinds({ ...grant, revoked_at: "2026-10-14T00:00:00Z" }, item, order, "buyer"), []);
});

test("another customer, beat, license or order cannot reuse a download entitlement", () => {
  assert.deepEqual(allowedDownloadKinds(grant, item, order, "someone-else"), []);
  assert.deepEqual(allowedDownloadKinds(grant, item, { ...order, customer_id: "someone-else" }, "buyer"), []);
  for (const changed of [{ ...item, beat_id: "different-beat" }, { ...item, license_type_id: "higher-license" }, { ...item, id: "different-item" }, { ...item, order_id: "different-order" }]) assert.deepEqual(allowedDownloadKinds(grant, changed, order, "buyer"), []);
});

test("complete audio cannot be registered in a public bucket or another beat folder", () => {
  const beatId = "a53920a7-3ef2-4a94-b673-407b612ab81c";
  const asset = { beatId, kind: "wav", bucket: "beat-assets", path: `${beatId}/master.wav`, filename: "master.wav", size: 1000 };
  assert.equal(assetRegistrationSchema.safeParse(asset).success, true);
  for (const bucket of ["covers", "previews"]) assert.equal(assetRegistrationSchema.safeParse({ ...asset, bucket }).success, false);
  for (const path of ["different-beat/master.wav", `${beatId}/../master.wav`, `${beatId}//master.wav`]) assert.equal(assetRegistrationSchema.safeParse({ ...asset, path }).success, false);
  assert.equal(assetRegistrationSchema.safeParse({ ...asset, kind: "preview", bucket: "previews" }).success, true);
});
