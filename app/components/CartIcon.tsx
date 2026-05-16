import { useEffect, useState } from "react";
import { Link } from "react-router";
import { CART_EVENT, readCart, totalQty } from "~/lib/cart";

export function CartIcon({ className = "" }: { className?: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const refresh = () => setCount(totalQty(readCart()));
    refresh();
    window.addEventListener(CART_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CART_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // Hide on SSR to avoid a hydration flash showing 0.
  if (count === null) return null;
  if (count === 0) {
    return (
      <Link
        to="/cart"
        className={`inline-flex items-center gap-1.5 text-sm text-ink/70 hover:text-navy transition-colors ${className}`}
      >
        <BagIcon />
        <span className="sr-only">Cart, empty</span>
      </Link>
    );
  }
  return (
    <Link
      to="/cart"
      className={`relative inline-flex items-center gap-1.5 text-sm text-navy font-medium ${className}`}
    >
      <BagIcon />
      <span className="text-xs">{count}</span>
      <span className="sr-only">items in cart</span>
    </Link>
  );
}

function BagIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 8h12l-1 12H7L6 8Z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </svg>
  );
}
