/**
 * Tiny localStorage cart. Lives entirely on the client until checkout, where
 * the server re-validates everything against the products table.
 */

import { club } from "~/club.config";

export const CART_KEY = club.session.cartKey;
export const CART_EVENT = club.session.cartEvent;

export type CartItem = {
  productId: string;
  qty: number;
};

export function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (it): it is CartItem =>
          it &&
          typeof it.productId === "string" &&
          typeof it.qty === "number" &&
          it.qty > 0,
      )
      .slice(0, 50);
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CART_EVENT));
}

export function addToCart(productId: string, qty = 1): CartItem[] {
  const items = readCart();
  const existing = items.find((it) => it.productId === productId);
  if (existing) {
    existing.qty = Math.min(99, existing.qty + qty);
  } else {
    items.push({ productId, qty: Math.min(99, Math.max(1, qty)) });
  }
  writeCart(items);
  return items;
}

export function setQty(productId: string, qty: number): CartItem[] {
  const items = readCart();
  const next =
    qty <= 0
      ? items.filter((it) => it.productId !== productId)
      : items.map((it) =>
          it.productId === productId
            ? { ...it, qty: Math.min(99, qty) }
            : it,
        );
  writeCart(next);
  return next;
}

export function removeFromCart(productId: string): CartItem[] {
  const items = readCart().filter((it) => it.productId !== productId);
  writeCart(items);
  return items;
}

export function clearCart(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CART_KEY);
  window.dispatchEvent(new Event(CART_EVENT));
}

export function totalQty(items: CartItem[]): number {
  return items.reduce((acc, it) => acc + it.qty, 0);
}
