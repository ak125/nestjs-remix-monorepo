/**
 * V5 Cart Hook — ship 1 (mock data)
 *
 * Cart isolé localStorage pour le parcours mobile V5.
 * NE PAS confondre avec ~/hooks/useCart.ts (cart réel SSR via root loader,
 * branché sur cartApi). V5 utilise des refs string ("BR-2412") incompatibles
 * avec les productId number du cart réel.
 *
 * Au ship 2 : cette implémentation sera supprimée, V5 brancha sur le cart
 * réel via un mapping ref → productId.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { type V5Product } from "../data";

const STORAGE_KEY = "v5.cart.ship1";
const SHIPPING_FREE_THRESHOLD = 49;
const SHIPPING_RATE = 5.9;

export type V5CartItem = V5Product & { qty: number };

export type V5CartState = {
  items: V5CartItem[];
  count: number;
  subtotal: number;
  shipping: number;
  total: number;
  add: (product: V5Product, qty?: number) => void;
  setQty: (ref: string, qty: number) => void;
  remove: (ref: string) => void;
  clear: () => void;
};

const readStorage = (): V5CartItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as V5CartItem[]) : [];
  } catch {
    return [];
  }
};

const writeStorage = (items: V5CartItem[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage may be full or blocked — fail silently for V5 mock
  }
};

export function useV5Cart(): V5CartState {
  const [items, setItems] = useState<V5CartItem[]>([]);

  // Hydrate from localStorage (post-mount, avoid SSR mismatch)
  useEffect(() => {
    setItems(readStorage());
  }, []);

  // Persist on change
  useEffect(() => {
    writeStorage(items);
  }, [items]);

  // Cross-tab sync
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      try {
        const next = e.newValue ? (JSON.parse(e.newValue) as V5CartItem[]) : [];
        setItems(Array.isArray(next) ? next : []);
      } catch {
        setItems([]);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback((product: V5Product, qty: number = 1) => {
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

  return useMemo<V5CartState>(() => {
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
