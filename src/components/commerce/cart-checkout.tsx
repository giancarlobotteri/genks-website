"use client";

import Image from "next/image";
import { useState } from "react";
import { CreditCard, Trash2 } from "lucide-react";
import { useCart } from "@/features/cart/cart-provider";
import { useLicenses } from "@/features/licenses/license-provider";
import { formatPrice } from "@/lib/format";
import type { LicenseTier } from "@/types/domain";

export function CartCheckout() {
  const { items, selectLicense, remove, clear } = useCart();
  const { licenses } = useLicenses();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedItems = items.flatMap(({ beat, selectedLicenseId }) => {
    const license = licenses.find((entry) => entry.id === selectedLicenseId);
    return license ? [{ beat, license, price: beat.licensePrices?.[license.id] ?? license.priceCents }] : [];
  });
  const ready = items.length > 0 && selectedItems.length === items.length;
  const total = selectedItems.reduce((sum, item) => sum + item.price, 0);

  return <>
    <div className="cart-step-heading"><span>1</span><div><strong>Choose a license for each beat</strong><small>Required before payment</small></div></div>
    <div className="cart-items">{items.map(({ beat, selectedLicenseId }) => {
      const available = licenses.filter((license) => beat.licenseIds.includes(license.id) && license.id !== "exclusive");
      return <article key={beat.id}>
        <Image src={beat.cover} width={64} height={64} alt="" />
        <div><strong>{beat.title}</strong><small>{beat.genre} · {beat.bpm} BPM</small></div>
        <button type="button" className="icon-button" aria-label={`Remove ${beat.title} from cart`} onClick={() => remove(beat.id)}><Trash2 size={17} /></button>
        <label className="cart-license-select"><span>License</span><select aria-label={`License for ${beat.title}`} value={selectedLicenseId ?? ""} onChange={(event) => selectLicense(beat.id, (event.target.value || null) as LicenseTier | null)}>
          <option value="">Choose license…</option>
          {available.map((license) => <option value={license.id} key={license.id}>{license.name} — {formatPrice(beat.licensePrices?.[license.id] ?? license.priceCents)}</option>)}
        </select></label>
      </article>;
    })}</div>
    <button type="button" className="text-link cart-clear" onClick={clear}>Clear cart</button>
    <div className={`cart-total ${ready ? "ready" : ""}`} aria-live="polite">
      <div><span>2</span><div><strong>Order total</strong><small>{ready ? `${items.length} ${items.length === 1 ? "license" : "licenses"} selected` : `Choose ${items.length - selectedItems.length} remaining ${items.length - selectedItems.length === 1 ? "license" : "licenses"}`}</small></div></div>
      <strong>{formatPrice(total)}</strong>
    </div>
    <form className="cart-payment-form" onSubmit={async (event) => {
      event.preventDefault();
      if (!ready) return;
      setBusy(true); setError("");
      const fields = new FormData(event.currentTarget);
      const response = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: fields.get("name"), email: fields.get("email"), items: items.map((item) => ({ beatId: item.beat.id, licenseCode: item.selectedLicenseId })) }) });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.url) window.location.assign(result.url);
      else { setError(result.error ?? "Checkout failed. Try again."); setBusy(false); }
    }}>
      <div className="cart-customer-fields"><label>Name<input name="name" autoComplete="name" required minLength={2} /></label><label>Email<input name="email" type="email" autoComplete="email" required /></label></div>
      {error ? <p className="notice error" role="alert">{error}</p> : null}
      <button className="button button-primary magnetic-cta cart-pay-button" disabled={!ready || busy}><CreditCard size={18} />{busy ? "OPENING STRIPE…" : `PAY ${formatPrice(total)} SECURELY`}</button>
      <small className="cart-payment-note">Cards and Apple Pay via Stripe. Files unlock only after confirmed payment.</small>
    </form>
  </>;
}
