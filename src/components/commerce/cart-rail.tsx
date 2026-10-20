"use client";

import Image from "next/image";
import { studioCashOnly } from "@/lib/studio-payment-mode";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, ShoppingBag, Trash2, X } from "lucide-react";
import { useCart } from "@/features/cart/cart-provider";
import { Modal } from "@/components/ui/modal";

export function CartRail() {
  const pathname = usePathname();
  const { items, count, remove, clear } = useCart();
  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const id = useId();
  const panelRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const visible = pathname === "/" || pathname.startsWith("/beats");
  useEffect(() => {
    if (!visible) return;
    document.body.classList.add("has-cart-rail");
    return () => document.body.classList.remove("has-cart-rail");
  }, [visible]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); toggleRef.current?.focus(); }
    };
    window.addEventListener("keydown", close);
    panelRef.current?.querySelector<HTMLElement>("button,a")?.focus();
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  if (!visible) return null;
  return <>
    <button ref={toggleRef} type="button" data-cart-target className="cart-rail-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <ShoppingBag size={19} /><span>Carrello</span><strong aria-live="polite">{count}</strong>
    </button>
    {open ? <button className="cart-rail-backdrop" type="button" aria-label="Chiudi il carrello" onClick={() => setOpen(false)} /> : null}
    <aside ref={panelRef} id={id} className={`cart-rail ${open ? "is-open" : ""}`} aria-label="Il tuo carrello">
      <div className="cart-rail-heading" data-cart-target><h2><ShoppingBag size={20} />Carrello <span aria-live="polite">{count}</span></h2><button className="icon-button cart-rail-close" type="button" aria-label="Chiudi il carrello" onClick={() => { setOpen(false); toggleRef.current?.focus(); }}><X size={20} /></button></div>
      {count ? <>
        <div className="cart-rail-items">{items.map(({ beat }) => <article key={beat.id}>
          <Image src={beat.cover} alt="" width={46} height={46} /><strong>{beat.title}</strong>
          <button className="icon-button" type="button" aria-label={`Rimuovi ${beat.title}`} onClick={() => remove(beat.id)}><X size={16} /></button>
        </article>)}</div>
        <Link href="/carrello" className="button button-primary cart-rail-checkout" onClick={() => setOpen(false)}>{studioCashOnly ? "Richiedi la selezione" : "Vai all’acquisto"} <ArrowUpRight size={18} /></Link>
        <button className="button cart-clear cart-clear-prominent" type="button" onClick={() => setConfirmClear(true)}><Trash2 size={17} />Svuota il carrello</button>
      </> : <div className="cart-rail-empty"><span className="cart-orbit" aria-hidden="true"><ShoppingBag size={27} /></span><p>Il prossimo suono<br /><strong>lo scegli tu.</strong></p><span>Aggiungi un beat dal catalogo.</span></div>}
      <Link href="/account/library" className="cart-library-link" onClick={() => setOpen(false)}>I miei acquisti <ArrowUpRight size={15} /></Link>
      <small>La selezione resta su questo dispositivo.</small>
    </aside>
    <Modal open={confirmClear} onClose={() => setConfirmClear(false)} titleId={`${id}-clear`}>
      <div className="cart-clear-dialog-icon"><Trash2 size={25} /></div><h2 id={`${id}-clear`}>Svuotare il carrello?</h2><p>Verranno rimossi tutti i beat e le licenze selezionate.</p>
      <div className="cart-clear-dialog-actions"><button type="button" className="button button-secondary" onClick={() => setConfirmClear(false)}>Annulla</button><button type="button" className="button cart-clear-confirm" onClick={() => { clear(); setConfirmClear(false); }}>Svuota il carrello</button></div>
    </Modal>
  </>;
}
