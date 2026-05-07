/**
 * Cart de preview — localStorage isolé, valable UNIQUEMENT pour les routes
 * /preview-mobile/*. Permet la validation visuelle du parcours panier mobile.
 *
 * NE PAS confondre avec le `useCart` réel de V4 (~/hooks/useCart.ts) qui
 * dialogue avec cartApi/backend. Une fois la migration vers V4 faite, ce
 * hook disparaît et les composants utiliseront directement `useCart`.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { type MV5Product } from "./ProductCard";

const STORAGE_KEY = "mv5.preview.cart";
const SHIPPING_FREE_THRESHOLD = 49;
const SHIPPING_RATE = 5.9;

export type MV5CartItem = MV5Product & { qty: number };

export type MV5CartState = {
  items: MV5CartItem[];
  count: number;
  subtotal: number;
  shipping: number;
  total: number;
  add: (product: MV5Product, qty?: number) => void;
  setQty: (ref: string, qty: number) => void;
  remove: (ref: string) => void;
  clear: () => void;
};

const readStorage = (): MV5CartItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MV5CartItem[]) : [];
  } catch {
    return [];
  }
};

const writeStorage = (items: MV5CartItem[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage may be full or blocked — silent for preview
  }
};

export function usePreviewCart(): MV5CartState {
  const [items, setItems] = useState<MV5CartItem[]>([]);

  useEffect(() => {
    setItems(readStorage());
  }, []);

  useEffect(() => {
    writeStorage(items);
  }, [items]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      try {
        const next = e.newValue
          ? (JSON.parse(e.newValue) as MV5CartItem[])
          : [];
        setItems(Array.isArray(next) ? next : []);
      } catch {
        setItems([]);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback((product: MV5Product, qty = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.ref === product.ref);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      }
      return [...prev, { ...product, qty }];
    });
  }, []);

  const remove = useCallback((ref: string) => {
    setItems((prev) => prev.filter((it) => it.ref !== ref));
  }, []);

  const setQty = useCallback(
    (ref: string, qty: number) => {
      if (qty <= 0) {
        remove(ref);
        return;
      }
      setItems((prev) =>
        prev.map((it) => (it.ref === ref ? { ...it, qty } : it)),
      );
    },
    [remove],
  );

  const clear = useCallback(() => setItems([]), []);

  return useMemo<MV5CartState>(() => {
    const count = items.reduce((s, it) => s + it.qty, 0);
    const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
    const shipping =
      subtotal >= SHIPPING_FREE_THRESHOLD || subtotal === 0 ? 0 : SHIPPING_RATE;
    const total = subtotal + shipping;
    return {
      items,
      count,
      subtotal,
      shipping,
      total,
      add,
      setQty,
      remove,
      clear,
    };
  }, [items, add, setQty, remove, clear]);
}
