"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, House, Menu, ShoppingBag, X } from "lucide-react";
import { site } from "@/config/site";
import { useCart } from "@/features/cart/cart-provider";
import { CartCheckout } from "@/components/commerce/cart-checkout";

const menuItems = [
  ...site.navigation,
  { label: "Ordini", href: "/account/orders" },
  { label: "Prenotazioni", href: "/account/bookings" },
  { label: "Progetti", href: "/account/projects" },
  { label: "Accesso amministratore", href: "/admin-access" },
];

export function Navigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const navId = useId();
  const cartId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const { items, count } = useCart();

  const closeAll = () => { setOpen(false); setCartOpen(false); };

  useEffect(() => {
    if (!open && !cartOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAll();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, cartOpen]);

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand-mark" href="/#home" aria-label="Pagina iniziale GENKS" onClick={closeAll}>
          <Image src="/brand/genks-logo.jpeg" width={50} height={50} alt="" priority style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <span className="sr-only">GENKS</span>
        </Link>

        <nav className="desktop-navigation" aria-label="Navigazione principale">
          <Link className={pathname === "/beats" ? "nav-link active" : "nav-link"} href="/beats">Negozio di beat</Link>
          <Link className={pathname === "/services" ? "nav-link active" : "nav-link"} href="/services">Prenotazioni e servizi</Link>
          <button ref={toggleRef} type="button" className="nav-menu-button" aria-expanded={open} aria-controls={navId} onClick={() => { setOpen((value) => !value); setCartOpen(false); }}>
            Menu <ChevronDown size={16} className={open ? "rotated" : ""} />
          </button>
        </nav>

        <div className="header-actions">
          <Link href="/#home" scroll className="header-home-button" aria-label="Torna alla pagina iniziale" onClick={closeAll}><House size={19} /><span>Inizio</span></Link>
          <button data-cart-target type="button" className="header-cart-button" aria-expanded={cartOpen} aria-controls={cartId} aria-label={`Apri il carrello, ${count} articoli`} onClick={() => { setCartOpen((value) => !value); setOpen(false); }}>
            <ShoppingBag size={20} />
            {count > 0 ? <span className="cart-count" key={count}>{count}</span> : null}
          </button>
          <button type="button" className="icon-button menu-toggle" aria-expanded={open} aria-controls={navId} aria-label={open ? "Chiudi il menu" : "Apri il menu"} onClick={() => { setOpen((value) => !value); setCartOpen(false); }}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <nav id={navId} className={`site-menu-dropdown ${open ? "open" : ""}`} aria-label="Tutte le sezioni" hidden={!open} onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); toggleRef.current?.focus(); } }}>
        <div className="menu-dropdown-grid">
          {menuItems.map((item, index) => (
            <Link key={item.href} href={item.href} onClick={closeAll} aria-current={pathname === item.href ? "page" : undefined}>
              <span className="mono">{String(index + 1).padStart(2, "0")}</span>
              <strong>{item.label}</strong>
              <ArrowUpRight size={19} />
            </Link>
          ))}
        </div>
        <div className="menu-socials">
          <a href={site.instagram} target="_blank" rel="noopener noreferrer">Instagram <ArrowUpRight size={16} /></a>
          <a href={site.tiktok} target="_blank" rel="noopener noreferrer">TikTok <ArrowUpRight size={16} /></a>
          <a href={site.youtube} target="_blank" rel="noopener noreferrer">YouTube <ArrowUpRight size={16} /></a>
        </div>
      </nav>

      {cartOpen ? <button type="button" className="cart-backdrop" aria-label="Chiudi il carrello" onClick={() => setCartOpen(false)} /> : null}
      <aside id={cartId} className={`cart-drawer ${cartOpen ? "open" : ""}`} hidden={!cartOpen} aria-label="Carrello dei beat">
        <div className="cart-drawer-heading"><div><span className="eyebrow">LA TUA SELEZIONE</span><h2>Carrello <span>{count}</span></h2></div><button type="button" className="icon-button" aria-label="Chiudi il carrello" onClick={() => setCartOpen(false)}><X /></button></div>
        {items.length ? <>
          <CartCheckout />
        </> : <div className="cart-empty"><ShoppingBag size={28} /><strong>Il tuo carrello è vuoto.</strong><p>Aggiungi un beat, poi scegli la licenza quando sei pronto.</p><Link href="/beats" className="button button-primary magnetic-cta" onClick={closeAll}>ESPLORA I BEAT</Link></div>}
      </aside>
    </header>
  );
}
