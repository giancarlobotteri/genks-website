"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useId, useRef, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { site } from "@/config/site";

export function Navigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link
          className="brand-mark"
          href="/"
          aria-label="GENKS home"
          onClick={() => setOpen(false)}
        >
          <Image src="/brand/genks-logo.jpeg" width={50} height={50} alt="" priority style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <span className="sr-only">GENKS</span>
        </Link>
        <nav className="desktop-navigation" aria-label="Main navigation">
          {site.navigation.map((item) => (
            <Link
              key={item.href}
              className={
                pathname === item.href ? "nav-link active" : "nav-link"
              }
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          ref={toggleRef}
          type="button"
          className="icon-button menu-toggle"
          aria-expanded={open}
          aria-controls={navId}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      <nav
        id={navId}
        className={`mobile-navigation ${open ? "open" : ""}`}
        aria-label="Mobile navigation"
        hidden={!open}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            toggleRef.current?.focus();
          }
        }}
      >
        {site.navigation.map((item, index) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={pathname === item.href ? "page" : undefined}
          >
            <span className="mono">0{index + 1}</span>
            {item.label}
            <ArrowUpRight size={22} />
          </Link>
        ))}
      </nav>
    </header>
  );
}
