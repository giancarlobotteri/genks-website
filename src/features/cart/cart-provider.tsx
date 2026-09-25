"use client";

import Image from "next/image";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Beat, LicenseTier } from "@/types/domain";

export interface CartItem { beat: Beat; selectedLicenseId: LicenseTier | null }
interface CartAnimation { id: number; cover: string; x: number; y: number }
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
      setAnimation({ id: Date.now(), cover: beat.cover, x: origin.left + origin.width / 2, y: origin.top + origin.height / 2 });
      window.setTimeout(() => setAnimation(null), 850);
    }
  }, []);

  const remove = useCallback((beatId: string) => setItems((current) => current.filter((item) => item.beat.id !== beatId)), []);
  const selectLicense = useCallback((beatId: string, licenseId: LicenseTier | null) => setItems((current) => current.map((item) => item.beat.id === beatId ? { ...item, selectedLicenseId: licenseId } : item)), []);
  const clear = useCallback(() => setItems([]), []);
  const count = items.length;
  const value = useMemo(() => ({ items, count, animation, add, selectLicense, remove, clear }), [items, count, animation, add, selectLicense, remove, clear]);

  return <CartContext value={value}>{children}{animation ? <Image key={animation.id} className="cart-fly" src={animation.cover} alt="" width={56} height={56} style={{ "--cart-x": `${animation.x}px`, "--cart-y": `${animation.y}px` } as React.CSSProperties} /> : null}</CartContext>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("CartProvider is required");
  return value;
}
