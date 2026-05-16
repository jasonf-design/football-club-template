import { useEffect, useState } from "react";
import { Form, Link, useNavigation } from "react-router";
import {
  CART_EVENT,
  clearCart,
  readCart,
  removeFromCart,
  setQty,
  type CartItem,
} from "~/lib/cart";

export type ShopProductLite = {
  id: string;
  slug: string;
  name: string;
  pricePence: number;
  stock: number | null;
  imageFilename: string | null;
};

export function CartView({
  products,
  stripeReady,
  error,
}: {
  products: ShopProductLite[];
  stripeReady: boolean;
  error?: string | null;
}) {
  const [items, setItems] = useState<CartItem[] | null>(null);
  const nav = useNavigation();

  useEffect(() => {
    const refresh = () => setItems(readCart());
    refresh();
    window.addEventListener(CART_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CART_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  if (items === null) {
    return (
      <div className="text-mute text-sm">Loading your cart…</div>
    );
  }

  const productById = new Map(products.map((p) => [p.id, p]));
  const enriched = items
    .map((it) => {
      const p = productById.get(it.productId);
      if (!p) return null;
      return { ...it, product: p };
    })
    .filter(
      (it): it is { productId: string; qty: number; product: ShopProductLite } =>
        !!it,
    );

  // Drop stale items quietly (a product was removed/deactivated).
  const stale = items.length - enriched.length;
  if (stale > 0 && items.length > 0) {
    // Sync back to localStorage on next tick.
    queueMicrotask(() => {
      for (const it of items) {
        if (!productById.has(it.productId)) removeFromCart(it.productId);
      }
    });
  }

  if (enriched.length === 0) {
    return (
      <div className="border border-line bg-paper-warm/40 p-16 text-center">
        <div className="font-serif text-3xl text-navy">Your bag is empty.</div>
        <p className="mt-3 text-mute max-w-md mx-auto">
          Have a browse — there's some good stuff up there.
        </p>
        <div className="mt-6">
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 bg-navy text-paper px-6 py-3 text-sm font-semibold tracking-wide uppercase hover:bg-navy-deep transition-colors"
          >
            Browse the shop
          </Link>
        </div>
      </div>
    );
  }

  const totalPence = enriched.reduce(
    (acc, it) => acc + it.product.pricePence * it.qty,
    0,
  );
  const submitting = nav.state === "submitting";
  const cartJson = JSON.stringify(
    enriched.map((it) => ({ productId: it.productId, qty: it.qty })),
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-12">
      <div className="space-y-px bg-line border border-line">
        {enriched.map((it) => (
          <CartRow
            key={it.productId}
            item={it}
            onQty={(q) => setItems(setQty(it.productId, q))}
            onRemove={() => setItems(removeFromCart(it.productId))}
          />
        ))}
      </div>

      <aside className="bg-paper border border-line p-6 lg:p-8 lg:sticky lg:top-6 h-fit">
        <div className="text-[10px] uppercase tracking-[0.28em] text-mute mb-3">
          Order summary
        </div>
        <dl className="space-y-2 text-sm text-ink">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>£{(totalPence / 100).toFixed(2)}</dd>
          </div>
          <div className="flex justify-between text-mute text-xs">
            <dt>Shipping</dt>
            <dd>Calculated at checkout</dd>
          </div>
        </dl>
        <div className="mt-4 pt-4 border-t border-line flex justify-between items-baseline">
          <span className="text-[10px] uppercase tracking-[0.24em] text-mute">
            Total
          </span>
          <span className="scoreboard text-3xl text-navy">
            £{(totalPence / 100).toFixed(2)}
          </span>
        </div>

        <Form method="post" className="mt-6 space-y-4">
          <input type="hidden" name="cart" value={cartJson} />
          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.24em] text-mute mb-1.5">
              Email <span className="text-red">*</span>
            </span>
            <input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              className="w-full bg-paper border border-line focus:border-navy outline-none px-3 py-2.5 text-sm text-ink"
            />
            <span className="block mt-1.5 text-[10px] text-mute/80">
              We'll send your receipt and shipping updates here.
            </span>
          </label>
          {error && (
            <div className="text-xs border-l-2 border-red bg-red/5 text-red px-3 py-2">
              {error}
            </div>
          )}
          {!stripeReady && (
            <div className="text-[11px] border-l-2 border-cream/80 bg-cream/30 px-3 py-2 text-ink">
              Online payments aren't enabled yet. Submitting will show a clear
              error.
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-sky text-navy py-3 text-sm font-semibold tracking-[0.16em] uppercase hover:bg-navy hover:text-paper transition-colors disabled:opacity-50"
          >
            {submitting ? "Redirecting…" : "Checkout securely"}
          </button>
          <button
            type="button"
            onClick={() => {
              clearCart();
              setItems([]);
            }}
            className="w-full text-xs uppercase tracking-[0.18em] text-mute hover:text-navy py-1"
          >
            Empty bag
          </button>
        </Form>
      </aside>
    </div>
  );
}

function CartRow({
  item,
  onQty,
  onRemove,
}: {
  item: { qty: number; product: ShopProductLite };
  onQty: (q: number) => void;
  onRemove: () => void;
}) {
  const { product, qty } = item;
  const lineTotal = product.pricePence * qty;
  const img = product.imageFilename
    ? `/uploads/${product.imageFilename}`
    : null;
  return (
    <div className="bg-paper p-4 sm:p-5 flex items-center gap-5">
      <Link
        to={`/shop/${product.slug}`}
        className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 bg-paper-warm relative overflow-hidden"
      >
        {img && (
          <img
            src={img}
            alt={product.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </Link>
      <div className="flex-1 min-w-0">
        <Link
          to={`/shop/${product.slug}`}
          className="font-serif text-lg text-navy hover:text-sky-bright leading-tight"
        >
          {product.name}
        </Link>
        <div className="text-xs text-mute mt-1">
          £{(product.pricePence / 100).toFixed(2)} each
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="inline-flex items-stretch border border-line bg-paper">
            <button
              type="button"
              onClick={() => onQty(qty - 1)}
              className="px-2 text-mute hover:text-navy"
              aria-label="Decrease"
            >
              −
            </button>
            <input
              type="number"
              min={0}
              max={99}
              value={qty}
              onChange={(e) => {
                const n = Number(e.target.value);
                onQty(Number.isFinite(n) ? n : 0);
              }}
              className="w-12 text-center bg-transparent outline-none text-sm text-ink"
            />
            <button
              type="button"
              onClick={() => onQty(qty + 1)}
              className="px-2 text-mute hover:text-navy"
              aria-label="Increase"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="text-xs uppercase tracking-[0.18em] text-mute hover:text-red"
          >
            Remove
          </button>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="scoreboard text-2xl text-navy leading-none">
          £{(lineTotal / 100).toFixed(2)}
        </div>
      </div>
    </div>
  );
}
