import test from "node:test";
import assert from "node:assert/strict";
import {createSafeOutboundFetch} from "../src/lib/outbound-fetch.ts";

test("outbound requests exclude Brotli without changing authentication or payload", async () => {
  const seen: Array<{input: RequestInfo | URL; init?: RequestInit}> = [];
  const safe = createSafeOutboundFetch(async (input, init) => { seen.push({input, init}); return new Response("ok"); });
  await safe("https://example.invalid", {method:"POST", body:"data", headers:{authorization:"Bearer TEST", "accept-encoding":"br"}, cache:"no-store"});
  assert.equal(new Headers(seen[0].init?.headers).get("accept-encoding"), "gzip, deflate");
  assert.equal(new Headers(seen[0].init?.headers).get("authorization"), "Bearer TEST");
  assert.equal(seen[0].init?.body, "data");
  assert.equal(seen[0].init?.method, "POST");
  assert.equal(seen[0].init?.cache, "no-store");
  const request = new Request("https://example.invalid", {headers:{"x-example":"kept"}});
  await safe(request);
  assert.equal(seen[1].input, request);
  assert.equal(new Headers(seen[1].init?.headers).get("x-example"), "kept");
  await safe(request, {headers:{"x-replace":"yes"}});
  assert.equal(new Headers(seen[2].init?.headers).get("x-example"), null);
  assert.equal(new Headers(seen[2].init?.headers).get("x-replace"), "yes");
  assert.equal(request.headers.get("accept-encoding"), null);
  await assert.rejects(createSafeOutboundFetch(async () => { throw new Error("expected"); })("https://example.invalid"), /expected/);
});
