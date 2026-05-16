import { useState } from "react";
import { Link } from "react-router";
import { addToCart } from "~/lib/cart";

export function AddToCart({
  productId,
  disabled,
  soldOut,
}: {
  productId: string;
  disabled?: boolean;
  soldOut?: boolean;
}) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if (soldOut) {
    return (
      <button
        type="button"
        disabled
        className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-line text-mute px-8 py-3.5 text-sm font-semibold tracking-[0.18em] uppercase cursor-not-allowed"
      >
        Sold out
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 max-w-sm">
      <div className="flex items-stretch gap-3">
        <div className="flex items-stretch border border-line bg-paper">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="px-3 text-mute hover:text-navy text-lg"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            max={99}
            value={qty}
            onChange={(e) =>
              setQty(Math.min(99, Math.max(1, Number(e.target.value) || 1)))
            }
            className="w-12 text-center bg-transparent outline-none text-ink"
          />
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(99, q + 1))}
            className="px-3 text-mute hover:text-navy text-lg"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            addToCart(productId, qty);
            setAdded(true);
          }}
          className="flex-1 bg-navy text-paper px-6 py-3 text-sm font-semibold tracking-[0.18em] uppercase hover:bg-navy-deep transition-colors disabled:opacity-50"
        >
          Add to bag
        </button>
      </div>
      {added && (
        <Link
          to="/cart"
          className="text-xs uppercase tracking-[0.18em] text-sky-bright hover:text-navy"
        >
          Added · view cart →
        </Link>
      )}
    </div>
  );
}
