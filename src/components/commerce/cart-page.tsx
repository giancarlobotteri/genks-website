"use client";
import Link from "next/link";
import { studioCashOnly } from "@/lib/studio-payment-mode";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/features/cart/cart-provider";
import { CartCheckout } from "./cart-checkout";
export function CartPage() {
  const { count } = useCart();
  return <section className="portal-shell narrow-shell cart-page"><span className="eyebrow">LA TUA SELEZIONE</span><h1>Il tuo carrello.</h1><p className="muted">{studioCashOnly ? "Controlla i beat scelti e invia la selezione a GENKS." : "Scegli le licenze e completa il pagamento in sicurezza."}</p>
    {studioCashOnly && <p className="fine-print">Pagamento in contanti in studio. Licenze e consegna concordate prima dell’acquisto.</p>}
    {count ? <CartCheckout /> : <div className="cart-empty"><ShoppingBag size={32} /><h2>Il carrello è vuoto.</h2><Link className="button button-primary" href="/beats">Vai al catalogo</Link></div>}
    <Link className="cart-library-link" href="/account/library">Hai già acquistato? Apri la tua raccolta</Link>
  </section>;
}
