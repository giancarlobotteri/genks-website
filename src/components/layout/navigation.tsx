"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { site } from "@/config/site";

export function Navigation() {
  const [open, setOpen] = useState(false);
  const navId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); toggleRef.current?.focus(); }
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target) && !toggleRef.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", outside);
    return () => { window.removeEventListener("keydown", close); window.removeEventListener("pointerdown", outside); };
  }, [open]);
  return <header className="genks-header">
    <button ref={toggleRef} type="button" className="genks-menu-toggle" aria-expanded={open} aria-controls={navId} aria-label={open ? "Chiudi il menu" : "Apri il menu"} onClick={() => setOpen(value => !value)}>
      {open ? <X size={21} /> : <Menu size={21} />}<span>Menu</span>
    </button>
    <Link className="genks-header-logo" href="/#home" aria-label="Pagina iniziale GENKS" onClick={() => setOpen(false)}>
      <Image src="/brand/genks-logo.jpeg" width={64} height={64} alt="GENKS" priority />
    </Link>
    <nav ref={menuRef} id={navId} hidden={!open} className="genks-corner-menu" aria-label="Collegamenti GENKS">
      <a href={site.instagram} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>Instagram <ArrowUpRight size={17} /></a>
      <a href={site.tiktok} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>TikTok <ArrowUpRight size={17} /></a>
      <Link href="/admin-access" onClick={() => setOpen(false)}>Accesso amministratore <ArrowUpRight size={17} /></Link>
    </nav>
  </header>;
}
