"use client";
import { useState } from "react";

export function CheckoutForm({ beatId, licenseCode, disabled }: { beatId: string; licenseCode: string; disabled?: boolean }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  return <form className="premium-form" onSubmit={async (event) => {
    event.preventDefault(); setError(""); setBusy(true);
    const fields = new FormData(event.currentTarget);
    const response = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ beatId, licenseCode, name: fields.get("name"), email: fields.get("email") }) });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.url) window.location.assign(result.url); else { setError(result.error ?? "Checkout failed. Try again."); setBusy(false); }
  }}>
    <label>Name<input name="name" autoComplete="name" required minLength={2} /></label>
    <label>Email<input name="email" type="email" autoComplete="email" required /></label>
    <div className="checkout-payment-methods" aria-label="Payment method">
      <p><strong>Card or Apple Pay</strong><small>Visa, Mastercard and Apple Pay on compatible devices.</small></p>
    </div>
    {error && <p className="notice error" role="alert">{error}</p>}
    <button className="button button-primary" disabled={disabled || busy}>{busy ? "OPENING STRIPE…" : "CONTINUE TO SECURE PAYMENT"}</button>
  </form>;
}
