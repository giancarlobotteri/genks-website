"use client";

import Image from "next/image";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
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
const STORAGE_KEY = "genks-cart-v1";

export function CartProvider({ children, catalog }: { children: ReactNode; catalog: Beat[] }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [animation, setAnimation] = useState<CartAnimation | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as { beatId: string; selectedLicenseId?: LicenseTier | null }[];
      const restored = saved.flatMap(({ beatId, selectedLicenseId }) => {
        const beat = catalog.find((entry) => entry.id === beatId);
        return beat ? [{ beat, selectedLicenseId: selectedLicenseId && beat.licenseIds.includes(selectedLicenseId) ? selectedLicenseId : null }] : [];
      });
      window.requestAnimationFrame(() => {
        setItems(restored);
        setHydrated(true);
      });
    } catch { localStorage.removeItem(STORAGE_KEY); }
  }, [catalog]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(({ beat, selectedLicenseId }) => ({ beatId: beat.id, selectedLicenseId }))));
  }, [items, hydrated]);

  const add = useCallback((beat: Beat, origin?: DOMRect) => {
    setItems((current) => {
      const existing = current.find((item) => item.beat.id === beat.id);
      return existing ? current : [...current, { beat, selectedLicenseId: null }];
    });
    if (origin) {
      const cartTarget = document.querySelector<HTMLElement>("[data-cart-target]")?.getBoundingClientRect();
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
  }, []);

  const remove = useCallback((beatId: string) => setItems((current) => current.filter((item) => item.beat.id !== beatId)), []);
  const selectLicense = useCallback((beatId: string, licenseId: LicenseTier | null) => setItems((current) => current.map((item) => item.beat.id === beatId ? { ...item, selectedLicenseId: licenseId } : item)), []);
  const clear = useCallback(() => setItems([]), []);
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
