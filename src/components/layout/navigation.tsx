"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Native Home fragments must replace the existing catalog hash. */

import Link from "next/link";
import {HomeServiceSearch} from "@/components/home/home-service-search";
import type {StoreCard} from "@/lib/home-storefront";
import { BEATS_ENABLED } from "@/config/features";
import styles from "./service-navigation.module.css";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";

export function Navigation({cards=[]}:{cards?:StoreCard[]}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
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
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin-access")) return <header className={`genks-header ${styles.adminHeader}`}><Link className="genks-header-logo" href="/" aria-label="Pagina iniziale GENKS"><Image src="/brand/genks-header.svg" width={104} height={64} alt="GENKS" priority /></Link></header>;
  const placement = pathname === "/" ? styles.homeHeader : styles.centeredHeader;
  return <header className={`genks-header ${!BEATS_ENABLED ? styles.header : ""} ${placement}`}>
    <button ref={toggleRef} type="button" className={`genks-menu-toggle ${!BEATS_ENABLED ? styles.toggle : ""}`} aria-expanded={open} aria-controls={navId} aria-label={open ? "Chiudi il menu" : "Apri il menu"} onClick={() => setOpen(value => !value)}>
      {open ? <X size={21} /> : <Menu size={21} />}<span>Menu</span>
    </button>
    <a className="genks-header-logo" href="/#home" aria-label="Pagina iniziale GENKS" onClick={() => setOpen(false)}>
      <Image src="/brand/genks-header.svg" width={104} height={64} alt="GENKS" priority />
    </a>
    {pathname==="/"&&<div className={styles.headerSearch}><HomeServiceSearch cards={cards}/></div>}
    <nav ref={menuRef} id={navId} hidden={!open} data-open={open} className={`genks-corner-menu ${!BEATS_ENABLED ? styles.menu : ""}`} aria-label="Collegamenti GENKS">
      {BEATS_ENABLED ? <>
      <a href="/#home" onClick={() => setOpen(false)}>Home <ArrowUpRight size={17} /></a>
      <a href="/#collection" onClick={() => setOpen(false)}>Catalogo dei beat <ArrowUpRight size={17} /></a>
      <Link href="/services" onClick={() => setOpen(false)}>Prenota un servizio <ArrowUpRight size={17} /></Link>
      <Link href="/account/library" onClick={() => setOpen(false)}>La tua raccolta <ArrowUpRight size={17} /></Link>
      <Link href="/guida" onClick={() => setOpen(false)}>Guida all’acquisto <ArrowUpRight size={17} /></Link>
      <Link href="/admin-access" onClick={() => setOpen(false)}>Accesso amministratore <ArrowUpRight size={17} /></Link>
      </> : <>{[{label:"Home",href:"/"},{label:"Servizi e pacchetti",href:"/services"},{label:"I miei acquisti e prenotazioni",href:"/account/library"},{label:"Lavori",href:"/lavori"},{label:"Guida all’acquisto",href:"/guida"},{label:"Accesso amministratore",href:"/admin-access"}].map(item => <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>{item.label}<ArrowUpRight size={17}/></Link>)}</>}
    </nav>

  </header>;
}
