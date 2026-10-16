"use client";
import { useState } from "react";
import { CheckoutConsents } from "./checkout-consents";

export function CheckoutForm({ beatId, licenseCode, disabled }: { beatId: string; licenseCode: string; disabled?: boolean }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  return <form className="premium-form" onSubmit={async (event) => {
    event.preventDefault(); setError(""); setBusy(true);
    const fields = new FormData(event.currentTarget);
    try {
    const response = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ beatId, licenseCode, name: fields.get("name"), email: fields.get("email"), promoCode: fields.get("promoCode") || undefined, acceptedTerms: fields.get("acceptedTerms") === "on", immediateDelivery: fields.get("immediateDelivery") === "on" }) });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.url) window.location.assign(result.url); else { setError(result.error ?? "Il pagamento non è stato avviato. Riprova."); setBusy(false); }
    } catch { setError("Connessione interrotta. Il pagamento non è stato aperto: riprova."); setBusy(false); }
  }}>
    <label>Nome<input name="name" autoComplete="name" required minLength={2} /></label>
    <label>Email<input name="email" type="email" autoComplete="email" required /></label>
    <label>Codice sconto (facoltativo)<input name="promoCode" autoComplete="off" maxLength={40} /></label>
    <div className="checkout-payment-methods" aria-label="Metodo di pagamento">
      <p><strong>Carta o Apple Pay</strong><small>Visa, Mastercard e Apple Pay sui dispositivi compatibili.</small></p>
    </div>
    {error && <p className="notice error" role="alert">{error}</p>}
    <CheckoutConsents />
    <button className="button button-primary" disabled={disabled || busy}>{busy ? "APERTURA DI STRIPE…" : "PROSEGUI AL PAGAMENTO SICURO"}</button>
  </form>;
}
