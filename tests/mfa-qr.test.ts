import test from "node:test";
import assert from "node:assert/strict";
import { mfaQrImage } from "../src/lib/security/mfa-qr.ts";

test("Supabase SVG data URLs remain valid images instead of being encoded twice", () => {
  const image = 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>';
  assert.equal(mfaQrImage(image), image);
  assert.equal(mfaQrImage("data:image/svg+xml;base64,PHN2Zy8+"), "data:image/svg+xml;base64,PHN2Zy8+");
});
test("raw SVG is encoded once and remote or executable image types are rejected", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>';
  assert.equal(decodeURIComponent(mfaQrImage(svg).split(",")[1]), svg);
  assert.throws(() => mfaQrImage("https://example.invalid/qr.svg"));
  assert.throws(() => mfaQrImage("data:text/html,<script></script>"));
});
