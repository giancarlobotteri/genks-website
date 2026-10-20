// Anonymous production regression checks. Never follows redirects or prints response data.
import assert from "node:assert/strict";
const origin = process.argv[2] || "https://www.prodbygenks.com";
const adminPages = ["", "customers", "orders", "settings", "bookings", "projects", "analytics", "exclusive", "beats", "licenses", "promotions", "support"];
for (const name of adminPages) {
  const path = `/admin${name ? `/${name}` : ""}`;
  for (const rsc of [false, true]) {
    const response = await fetch(new URL(path, origin), { redirect: "manual", headers: rsc ? { RSC: "1" } : {}, signal: AbortSignal.timeout(20000) });
    const body = await response.text();
    assert.equal(response.status, 307, `${path}: unauthorized response`);
    assert.equal(new URL(response.headers.get("location"), origin).pathname, "/admin-access");
    assert.ok(body.length < 300, `${path}: admin content must never enter the response`);
    assert.doesNotMatch(body, /\/api\/calendar\/feed\?token=[a-f0-9]{64}|admin-customer-list/);
    assert.match(response.headers.get("cache-control") || "", /no-store/);
  }
}
for (const path of ["/api/admin/sales-export", "/api/internal/maintenance", "/api/calendar/feed"]) {
  const response = await fetch(new URL(path, origin), { redirect: "manual", signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 401, `${path}: unauthorized API response`);
  await response.body?.cancel();
}
const csrf = await fetch(new URL("/api/checkout", origin), { method: "POST", headers: { Origin: "https://example.invalid", "Sec-Fetch-Site": "cross-site", "Content-Type": "application/json" }, body: "{}", redirect: "manual" });
assert.equal(csrf.status, 403);
await csrf.body?.cancel();
console.log("PASS: anonymous HTML/RSC requests blocked on 12 admin pages; private APIs and cross-site checkout blocked.");
