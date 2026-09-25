"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useId, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, Menu, ShoppingBag, Trash2, X } from "lucide-react";
import { site } from "@/config/site";
import { useCart } from "@/features/cart/cart-provider";
import { LicenseButton } from "@/components/beats/license-button";

const menuItems = [
  ...site.navigation,
  { label: "Orders", href: "/account/orders" },
  { label: "Bookings", href: "/account/bookings" },
  { label: "Projects", href: "/account/projects" },
  { label: "Admin access", href: "/admin-access" },
];

export function Navigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const navId = useId();
  const cartId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const { items, count, remove, clear } = useCart();

  const closeAll = () => { setOpen(false); setCartOpen(false); };

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand-mark" href="/" aria-label="GENKS home" onClick={closeAll}>
          <Image src="/brand/genks-logo.jpeg" width={50} height={50} alt="" priority style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <span className="sr-only">GENKS</span>
        </Link>

        <nav className="desktop-navigation" aria-label="Main navigation">
          <Link className={pathname === "/beats" ? "nav-link active" : "nav-link"} href="/beats">Beat store</Link>
          <Link className={pathname === "/services" ? "nav-link active" : "nav-link"} href="/services">Book / services</Link>
          <button ref={toggleRef} type="button" className="nav-menu-button" aria-expanded={open} aria-controls={navId} onClick={() => { setOpen((value) => !value); setCartOpen(false); }}>
            Menu <ChevronDown size={16} className={open ? "rotated" : ""} />
          </button>
        </nav>

        <div className="header-actions">
          <button type="button" className="header-cart-button" aria-expanded={cartOpen} aria-controls={cartId} aria-label={`Open cart, ${count} items`} onClick={() => { setCartOpen((value) => !value); setOpen(false); }}>
            <ShoppingBag size={20} />
            {count > 0 ? <span className="cart-count" key={count}>{count}</span> : null}
          </button>
          <button type="button" className="icon-button menu-toggle" aria-expanded={open} aria-controls={navId} aria-label={open ? "Close menu" : "Open menu"} onClick={() => { setOpen((value) => !value); setCartOpen(false); }}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <nav id={navId} className={`site-menu-dropdown ${open ? "open" : ""}`} aria-label="Full navigation" hidden={!open} onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); toggleRef.current?.focus(); } }}>
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

      <aside id={cartId} className={`cart-drawer ${cartOpen ? "open" : ""}`} hidden={!cartOpen} aria-label="Beat cart">
        <div className="cart-drawer-heading"><div><span className="eyebrow">YOUR SELECTION</span><h2>Cart <span>{count}</span></h2></div><button type="button" className="icon-button" aria-label="Close cart" onClick={() => setCartOpen(false)}><X /></button></div>
        {items.length ? <>
          <div className="cart-items">{items.map(({ beat, quantity }) => <article key={beat.id}>
            <Image src={beat.cover} width={64} height={64} alt="" />
            <div><strong>{beat.title}</strong><small>{beat.genre} · {beat.bpm} BPM{quantity > 1 ? ` · ×${quantity}` : ""}</small></div>
            <button type="button" className="icon-button" aria-label={`Remove ${beat.title} from cart`} onClick={() => remove(beat.id)}><Trash2 size={17} /></button>
            <LicenseButton beat={beat} compact />
          </article>)}</div>
          <button type="button" className="text-link cart-clear" onClick={clear}>Clear cart</button>
        </> : <div className="cart-empty"><ShoppingBag size={28} /><strong>Your cart is waiting.</strong><p>Add a beat, then choose its license when you are ready.</p><Link href="/beats" className="button button-primary magnetic-cta" onClick={closeAll}>EXPLORE BEATS</Link></div>}
      </aside>
    </header>
  );
}
