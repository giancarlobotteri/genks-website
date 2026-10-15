"use client";

import { italianLabel } from "@/lib/italian";
import Image from "next/image";
import { useState } from "react";
import { AlertTriangle, CreditCard, Trash2 } from "lucide-react";
import { useCart } from "@/features/cart/cart-provider";
import { useLicenses } from "@/features/licenses/license-provider";
import { formatPrice } from "@/lib/format";
import { Modal } from "@/components/ui/modal";
import type { LicenseTier } from "@/types/domain";

export function CartCheckout() {
  const { items, selectLicense, remove, clear } = useCart();
  const { licenses } = useLicenses();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const selectedItems = items.flatMap(({ beat, selectedLicenseId }) => {
    const license = licenses.find((entry) => entry.id === selectedLicenseId);
    return license ? [{ beat, license, price: beat.licensePrices?.[license.id] ?? license.priceCents }] : [];
  });
  const ready = items.length > 0 && selectedItems.length === items.length;
  const total = selectedItems.reduce((sum, item) => sum + item.price, 0);

  return <>
    <div className="cart-step-heading"><span>1</span><div><strong>Scegli una licenza per ogni beat</strong><small>Necessario prima del pagamento</small></div></div>
    <div className="cart-items">{items.map(({ beat, selectedLicenseId }) => {
      const available = licenses.filter((license) => beat.licenseIds.includes(license.id) && !license.isExclusive && license.id !== "exclusive");
      return <article key={beat.id}>
        <Image src={beat.cover} width={64} height={64} alt="" />
        <div><strong>{beat.title}</strong><small>{italianLabel(beat.genre)} · {beat.bpm} BPM</small></div>
        <button type="button" className="icon-button" aria-label={`Rimuovi ${beat.title} dal carrello`} onClick={() => remove(beat.id)}><Trash2 size={17} /></button>
        <label className="cart-license-select"><span>Licenza</span><select aria-label={`Licenza per ${beat.title}`} value={selectedLicenseId ?? ""} onChange={(event) => selectLicense(beat.id, (event.target.value || null) as LicenseTier | null)}>
          <option value="">Scegli la licenza…</option>
          {available.map((license) => <option value={license.id} key={license.id}>{italianLabel(license.name)} — {formatPrice(beat.licensePrices?.[license.id] ?? license.priceCents)}</option>)}
        </select></label>
      </article>;
    })}</div>
    <button type="button" className="button cart-clear cart-clear-prominent" onClick={() => setConfirmClear(true)}><Trash2 size={15} />Svuota il carrello</button>
    <Modal open={confirmClear} onClose={() => setConfirmClear(false)} titleId="clear-cart-title">
      <div className="cart-clear-dialog-icon"><AlertTriangle size={25} /></div>
      <h2 id="clear-cart-title">Vuoi svuotare il carrello?</h2>
      <p>Stai per rimuovere tutti i {items.length} {items.length === 1 ? "beat" : "beat"} e le licenze selezionate. Dovrai aggiungerli nuovamente per ripristinare il carrello.</p>
      <div className="cart-clear-dialog-actions">
        <button type="button" className="button button-secondary" onClick={() => setConfirmClear(false)}>MANTIENI LA SELEZIONE</button>
        <button type="button" className="button cart-clear-confirm" onClick={() => { setConfirmClear(false); clear(); }}><Trash2 size={17} />SVUOTA IL CARRELLO</button>
      </div>
    </Modal>
    <div className={`cart-total ${ready ? "ready" : ""}`} aria-live="polite">
      <div><span>2</span><div><strong>Totale ordine</strong><small>{ready ? `${items.length} ${items.length === 1 ? "licenza selezionata" : "licenze selezionate"}` : `Licenze da scegliere: ${items.length - selectedItems.length}`}</small></div></div>
      <strong>{formatPrice(total)}</strong>
    </div>
    <form className="cart-payment-form" onSubmit={async (event) => {
      event.preventDefault();
      if (!ready) return;
      setBusy(true); setError("");
      const fields = new FormData(event.currentTarget);
      const response = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: fields.get("name"), email: fields.get("email"), promoCode: fields.get("promoCode") || undefined, items: items.map((item) => ({ beatId: item.beat.id, licenseCode: item.selectedLicenseId })) }) });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.url) window.location.assign(result.url);
      else { setError(result.error ?? "Il pagamento non è stato avviato. Riprova."); setBusy(false); }
    }}>
      <div className="cart-customer-fields"><label>Nome<input name="name" autoComplete="name" required minLength={2} /></label><label>Email<input name="email" type="email" autoComplete="email" required /></label></div>
      <details><summary>Hai un codice sconto?</summary><label>Codice sconto<input name="promoCode" autoComplete="off" maxLength={40} /></label></details>
      {error ? <p className="notice error" role="alert">{error}</p> : null}
      <button className="button button-primary magnetic-cta cart-pay-button" disabled={!ready || busy}><CreditCard size={18} />{busy ? "APERTURA DI STRIPE…" : `PAGA ${formatPrice(total)} IN SICUREZZA`}</button>
      <small className="cart-payment-note">Non serve un account per pagare. Stripe mostra i metodi disponibili sul tuo dispositivo. I file si sbloccano dopo la conferma del pagamento; usa questa email per accedere alla tua raccolta.</small>
    </form>
  </>;
}
