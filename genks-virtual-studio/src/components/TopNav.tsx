import { Menu, ShoppingBag, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStudio } from "../store.tsx";
import s from "../styles/vs.module.css";
import { GenksSymbol } from "./brand.tsx";

export type NavItem = { label: string; go: () => void };

/** Persistent menu: every service is reachable at any time, without completing a scene. */
export function TopNav({ items }: { items: NavItem[] }) {
  const { cart, open } = useStudio();
  const [menu, setMenu] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenu(false); toggleRef.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);
  return (
    <header className={s.nav}>
      <a href="#top" className={s.brand} aria-label="GENKS, inizio"><GenksSymbol size={34} /><span>GENKS</span></a>
      <button ref={toggleRef} type="button" className={`${s.iconBtn} ${s.menuToggle}`} aria-expanded={menu} aria-controls="main-menu" onClick={() => setMenu(v => !v)} aria-label={menu ? "Chiudi menu" : "Apri menu"}>
        {menu ? <X size={22} /> : <Menu size={22} />}
      </button>
      <nav id="main-menu" className={s.navLinks} data-open={menu || undefined} aria-label="Sezioni">
        <ul>
          {items.map(it => <li key={it.label}><button type="button" onClick={() => { setMenu(false); it.go(); }}>{it.label}</button></li>)}
        </ul>
      </nav>
      <button type="button" className={s.cartBtn} onClick={() => open({ type: "cart" })} aria-label={`Carrello, ${cart.length} articoli`}>
        <ShoppingBag size={20} />{cart.length > 0 && <span className={s.cartCount}>{cart.length}</span>}
      </button>
    </header>
  );
}
