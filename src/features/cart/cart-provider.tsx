"use client";

import Image from "next/image";
import { BEATS_ENABLED } from "@/config/features";
import { usePathname } from "next/navigation";
import { cartStorageKey, restoreCart } from "@/lib/cart-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Beat, LicenseTier } from "@/types/domain";

export interface CartItem { beat: Beat; selectedLicenseId: LicenseTier | null }
interface CartAnimation {
  id: number;
  cover: string;
  startX: number;
  startY: number;
  midX: number;
  midY: number;
  endX: number;
  endY: number;
}
interface CartContextValue {
  items: CartItem[];
  count: number;
  animation: CartAnimation | null;
  add: (beat: Beat, origin?: DOMRect) => void;
  selectLicense: (beatId: string, licenseId: LicenseTier | null) => void;
  remove: (beatId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const DEVICE_KEY = "genks:cart:device:v2";

export function CartProvider({ children, catalog }: { children: ReactNode; catalog: Beat[] }) {
  const pathname = usePathname();
  const [selection, setSelection] = useState<{ key: string | null; items: CartItem[] }>({ key: null, items: [] });
  const [animation, setAnimation] = useState<CartAnimation | null>(null);
  const deviceRef = useRef<string | null>(null);
  const items = selection.items;
  const setItems = useCallback((update: (current: CartItem[]) => CartItem[]) => setSelection(current => ({ ...current, items: update(current.items) })), []);

  useEffect(() => {
    if (!BEATS_ENABLED) return;
    let cancelled = false;
    const controller = new AbortController();
    const hydrate = async () => {
      // Identity comes from the verified server session. No cross-device cart database exists.
      const response = await fetch("/api/cart/identity", { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Identità non disponibile");
      const { owner } = await response.json() as { owner: string };
      if (cancelled) return;
      let key: string | null = null;
      let restored: CartItem[] = [];
      try {
        localStorage.removeItem("genks-cart-v1");
        deviceRef.current ??= localStorage.getItem(DEVICE_KEY) || crypto.randomUUID();
        localStorage.setItem(DEVICE_KEY, deviceRef.current);
        key = cartStorageKey(deviceRef.current, owner);
        restored = restoreCart(localStorage.getItem(key), catalog);
      } catch { /* Disabled storage: keep this tab's cart in memory. */ }
      setSelection(current => {
        if (current.key === key) return current;
        const pending = current.key === null ? current.items : [];
        const combined = [...restored, ...pending.filter(item => !restored.some(saved => saved.beat.id === item.beat.id))];
        return { key, items: combined };
      });
    };
    void hydrate().catch(() => { /* A temporary network error must not overwrite a saved cart. */ });
    return () => { cancelled = true; controller.abort(); };
  }, [catalog, pathname]);

  useEffect(() => {
    if (!selection.key) return;
    try {
      localStorage.setItem(selection.key, JSON.stringify(items.map(({ beat, selectedLicenseId }) => ({ beatId: beat.id, selectedLicenseId }))));
    } catch { /* Shopping still works when browser storage is disabled. */ }
  }, [items, selection.key]);

  const add = useCallback((beat: Beat, origin?: DOMRect) => {
    setItems((current) => {
      const existing = current.find((item) => item.beat.id === beat.id);
      return existing ? current : [...current, { beat, selectedLicenseId: null }];
    });
    if (origin) {
      const cartTarget = Array.from(document.querySelectorAll<HTMLElement>("[data-cart-target]")).map(element => element.getBoundingClientRect()).find(rect => rect.width > 0 && rect.height > 0);
      const startX = origin.left + origin.width / 2;
      const startY = origin.top + origin.height / 2;
      const endX = cartTarget ? cartTarget.left + cartTarget.width / 2 : window.innerWidth - 40;
      const endY = cartTarget ? cartTarget.top + cartTarget.height / 2 : 40;
      const distance = Math.hypot(endX - startX, endY - startY);
      const arcHeight = Math.min(190, Math.max(72, distance * 0.2));

      setAnimation({
        id: Date.now(),
        cover: beat.cover,
        startX,
        startY,
        midX: startX + (endX - startX) * 0.56,
        midY: Math.min(startY, endY) - arcHeight,
        endX,
        endY,
      });
      window.setTimeout(() => setAnimation(null), 1450);
    }
  }, [setItems]);

  const remove = useCallback((beatId: string) => setItems((current) => current.filter((item) => item.beat.id !== beatId)), [setItems]);
  const selectLicense = useCallback((beatId: string, licenseId: LicenseTier | null) => setItems((current) => current.map((item) => item.beat.id === beatId ? { ...item, selectedLicenseId: licenseId } : item)), [setItems]);
  const clear = useCallback(() => setItems(() => []), [setItems]);
  const count = items.length;
  const value = useMemo(() => ({ items, count, animation, add, selectLicense, remove, clear }), [items, count, animation, add, selectLicense, remove, clear]);

  const animationStyle = animation ? {
    "--cart-start-x": `${animation.startX}px`,
    "--cart-start-y": `${animation.startY}px`,
    "--cart-mid-x": `${animation.midX}px`,
    "--cart-mid-y": `${animation.midY}px`,
    "--cart-end-x": `${animation.endX}px`,
    "--cart-end-y": `${animation.endY}px`,
  } as CSSProperties : undefined;

  return <CartContext value={value}>{children}{animation ? <span key={animation.id} className="cart-fly" style={animationStyle} aria-hidden="true"><Image src={animation.cover} alt="" width={60} height={60} /></span> : null}</CartContext>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("CartProvider is required");
  return value;
}
