"use client";

import Link from "next/link";
import { site } from "@/config/site";
import { studioCashOnly, studioBeatHref } from "@/lib/studio-payment-mode";
import { italianLabel } from "@/lib/italian";
import Image from "next/image";
import { useState } from "react";
import { AlertTriangle, CreditCard, Trash2 } from "lucide-react";
import { useCart } from "@/features/cart/cart-provider";
import { useLicenses } from "@/features/licenses/license-provider";
import { formatPrice } from "@/lib/format";
import { Modal } from "@/components/ui/modal";
import type { LicenseTier } from "@/types/domain";
import { CheckoutConsents } from "./checkout-consents";
import { canBuyLicense } from "@/lib/catalog-availability";

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
  const choicesComplete = items.length > 0 && selectedItems.length === items.length;
  const unavailable = selectedItems.some(item => !canBuyLicense(item.beat, item.license));
  const ready = choicesComplete && !unavailable;
  const total = selectedItems.reduce((sum, item) => sum + item.price, 0);

  if (studioCashOnly) {
    const message = `Ciao GENKS, vorrei informazioni su questi beat: ${items.map(item => item.beat.title).join(", ")}. Vorrei concordare licenze, prezzo e appuntamento in studio con pagamento in contanti.`;
    const phone = site.whatsapp.replace(/\\D/g, "");
    return <><div className="cart-items">{items.map(({beat}) => <article key={beat.id}><Image src={beat.cover} alt="" width={64} height={64}/><strong>{beat.title}</strong><Link className="text-link" href={studioBeatHref(beat)}>Richiedi in studio</Link><button type="button" className="icon-button" aria-label={`Rimuovi ${beat.title}`} onClick={()=>remove(beat.id)}><Trash2 size={17}/></button></article>)}</div><div className="custom-contact-actions">{phone && <a className="button button-primary" href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">Richiedi la selezione su WhatsApp</a>}<a className="button button-secondary" href={`mailto:assistenza@prodbygenks.com?${new URLSearchParams({subject:"Selezione beat GENKS",body:message})}`}>Richiedi via email</a><button type="button" className="button cart-clear cart-clear-prominent" onClick={()=>clear()}><Trash2 size={17}/>Svuota il carrello</button></div></>;
  }
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
      <div><span>2</span><div><strong>Totale ordine</strong><small>{choicesComplete ? unavailable ? "Una licenza è ancora in preparazione" : `${items.length} ${items.length === 1 ? "licenza selezionata" : "licenze selezionate"}` : `Licenze da scegliere: ${items.length - selectedItems.length}`}</small></div></div>
      <strong>{formatPrice(total)}</strong>
    </div>
    {unavailable && <p className="notice" role="status">Una delle licenze scelte non è ancora acquistabile. Rimuovi il beat oppure scegli un’altra licenza disponibile.</p>}
    <form className="cart-payment-form" onSubmit={async (event) => {
      event.preventDefault();
      if (!ready) return;
      setBusy(true); setError("");
      const fields = new FormData(event.currentTarget);
      try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: fields.get("name"), email: fields.get("email"), promoCode: fields.get("promoCode") || undefined, acceptedTerms: fields.get("acceptedTerms") === "on", immediateDelivery: fields.get("immediateDelivery") === "on", items: items.map((item) => ({ beatId: item.beat.id, licenseCode: item.selectedLicenseId })) }) });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.url) window.location.assign(result.url);
      else { setError(result.error ?? "Il pagamento non è stato avviato. Riprova."); setBusy(false); }
      } catch { setError("Connessione interrotta. Riprova ad aprire il pagamento."); setBusy(false); }
    }}>
      <div className="cart-customer-fields"><label>Nome<input name="name" autoComplete="name" required minLength={2} /></label><label>Email<input name="email" type="email" autoComplete="email" required /></label></div>
      <details><summary>Hai un codice sconto?</summary><label>Codice sconto<input name="promoCode" autoComplete="off" maxLength={40} /></label></details>
      {selectedItems.map(({beat,license})=><details key={beat.id}><summary>Licenza di {beat.title}</summary><p className="license-contract-copy">{license.contractText||"Licenza in preparazione: acquisto non ancora disponibile."}</p></details>)}
      {error ? <p className="notice error" role="alert">{error}</p> : null}
      <CheckoutConsents />
      <button className="button button-primary magnetic-cta cart-pay-button" disabled={!ready || busy}><CreditCard size={18} />{busy ? "APERTURA DI STRIPE…" : `PAGA ${formatPrice(total)} IN SICUREZZA`}</button>
      <small className="cart-payment-note">Non serve un account per pagare. Stripe mostra i metodi disponibili sul tuo dispositivo. I file si sbloccano dopo la conferma del pagamento; usa questa email per accedere alla tua raccolta.</small>
    </form>
  </>;
}
