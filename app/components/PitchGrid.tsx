import { useMemo, useState } from "react";
import { Form } from "react-router";

export type PitchSquare = {
  id: number;
  row: number;
  col: number;
  zone: string;
  status: "available" | "pending" | "sold";
  sponsorName: string | null;
  pricePence: number;
};

export type PitchGridConfig = {
  rows: number;
  cols: number;
  pricePence: number;
};

export function PitchGrid({
  squares,
  config,
  stripeReady,
  error,
}: {
  squares: PitchSquare[];
  config: PitchGridConfig;
  stripeReady: boolean;
  error?: string | null;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showForm, setShowForm] = useState(false);

  const byId = useMemo(() => {
    const m = new Map<number, PitchSquare>();
    for (const s of squares) m.set(s.id, s);
    return m;
  }, [squares]);

  const totalPence = selected.size * config.pricePence;

  function toggle(square: PitchSquare) {
    if (square.status !== "available") return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(square.id)) next.delete(square.id);
      else next.add(square.id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setShowForm(false);
  }

  // Group squares into zone bands.
  const zones = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const s of squares) {
      if (!seen.has(s.zone)) {
        seen.add(s.zone);
        order.push(s.zone);
      }
    }
    return order;
  }, [squares]);

  const squaresByZone = useMemo(() => {
    const m = new Map<string, PitchSquare[]>();
    for (const s of squares) {
      const arr = m.get(s.zone) ?? [];
      arr.push(s);
      m.set(s.zone, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => a.row - b.row || a.col - b.col);
    }
    return m;
  }, [squares]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-10 items-start">
      {/* Pitch */}
      <div>
        <div className="rounded-sm bg-navy/95 p-4 sm:p-5 relative">
          {/* pitch markings (decorative) */}
          <div className="absolute inset-4 sm:inset-5 border border-sky/15 rounded-sm pointer-events-none" />
          <div className="absolute left-1/2 top-4 bottom-4 sm:top-5 sm:bottom-5 w-px bg-sky/15 pointer-events-none" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-20 w-20 sm:h-28 sm:w-28 rounded-full border border-sky/15 pointer-events-none" />

          {zones.map((zone, zi) => (
            <div key={zone} className={zi > 0 ? "mt-3" : ""}>
              <div className="flex items-center gap-3 mb-2 text-[10px] uppercase tracking-[0.22em] text-sky/70">
                <span>{zone}</span>
                <span className="flex-1 h-px bg-sky/15" />
              </div>
              <div
                className="grid gap-[3px] sm:gap-[4px]"
                style={{
                  gridTemplateColumns: `repeat(${config.cols}, minmax(0, 1fr))`,
                }}
              >
                {(squaresByZone.get(zone) ?? []).map((s) => (
                  <Cell
                    key={s.id}
                    square={s}
                    selected={selected.has(s.id)}
                    onToggle={() => toggle(s)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <Legend />
      </div>

      {/* Side panel */}
      <aside className="bg-paper border border-line p-6 lg:sticky lg:top-6">
        <div className="text-[10px] uppercase tracking-[0.28em] text-mute mb-2">
          Your selection
        </div>
        <div className="flex items-baseline gap-3">
          <div className="scoreboard text-5xl text-navy leading-none">
            {selected.size}
          </div>
          <div className="text-mute text-sm">
            {selected.size === 1 ? "square" : "squares"}
          </div>
          <div className="ml-auto text-right">
            <div className="scoreboard text-3xl text-navy leading-none">
              £{(totalPence / 100).toLocaleString("en-GB")}
            </div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-mute mt-1">
              Total
            </div>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="mt-5 max-h-28 overflow-y-auto text-xs text-mute space-y-1 border-t border-line pt-4">
            {[...selected]
              .map((id) => byId.get(id))
              .filter((x): x is PitchSquare => !!x)
              .sort((a, b) => a.row - b.row || a.col - b.col)
              .map((s) => (
                <div key={s.id} className="flex justify-between gap-3">
                  <span>
                    {s.zone} · R{s.row} · C{s.col}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggle(s)}
                    className="text-mute hover:text-red"
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
          </div>
        )}

        {selected.size === 0 ? (
          <p className="mt-6 text-sm text-mute leading-relaxed">
            Click any white square on the pitch to add it to your selection.
            Pick as many as you like — each is £
            {(config.pricePence / 100).toFixed(0)}.
          </p>
        ) : !showForm ? (
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="w-full bg-navy text-paper py-3 text-sm font-semibold tracking-[0.16em] uppercase hover:bg-navy-deep transition-colors"
            >
              Continue · £{(totalPence / 100).toLocaleString("en-GB")}
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs uppercase tracking-[0.18em] text-mute hover:text-navy py-1"
            >
              Clear selection
            </button>
          </div>
        ) : (
          <Form method="post" className="mt-6 space-y-4">
            <input
              type="hidden"
              name="squareIds"
              value={[...selected].join(",")}
            />
            <CheckoutField
              name="displayName"
              label="Name to display"
              hint="On the pitch and in the matchday programme"
              required
              maxLength={60}
            />
            <CheckoutField
              name="email"
              label="Email"
              type="email"
              hint="For your receipt"
              required
            />
            <CheckoutField
              name="contactName"
              label="Your name"
              hint="Optional"
            />
            {error && (
              <div className="text-xs border-l-2 border-red bg-red/5 text-red px-3 py-2">
                {error}
              </div>
            )}
            {!stripeReady && (
              <div className="text-[11px] border-l-2 border-cream/80 bg-cream/30 px-3 py-2 text-ink">
                Stripe isn't configured yet — submitting now will return an
                error. Ask an admin to add the keys.
              </div>
            )}
            <button
              type="submit"
              className="w-full bg-sky text-navy py-3 text-sm font-semibold tracking-[0.16em] uppercase hover:bg-navy hover:text-paper transition-colors"
            >
              Pay £{(totalPence / 100).toLocaleString("en-GB")} →
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs uppercase tracking-[0.18em] text-mute hover:text-navy w-full text-center"
            >
              ← Back to selection
            </button>
          </Form>
        )}
      </aside>
    </div>
  );
}

function Cell({
  square,
  selected,
  onToggle,
}: {
  square: PitchSquare;
  selected: boolean;
  onToggle: () => void;
}) {
  const base =
    "relative aspect-square text-[8px] sm:text-[9px] uppercase tracking-tight flex items-center justify-center transition-colors";
  if (square.status === "sold") {
    return (
      <div
        className={`${base} bg-sky text-navy cursor-help group`}
        title={square.sponsorName ?? "Sold"}
      >
        {square.sponsorName && (
          <span className="absolute inset-0 hidden lg:flex items-center justify-center overflow-hidden">
            <span className="px-0.5 leading-[0.95] text-center font-semibold truncate w-full">
              {initials(square.sponsorName)}
            </span>
          </span>
        )}
      </div>
    );
  }
  if (square.status === "pending") {
    return (
      <div
        className={`${base} bg-cream/80 text-mute cursor-not-allowed`}
        title="Reserved"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Sponsor square ${square.zone} row ${square.row} column ${square.col}`}
      className={[
        base,
        selected
          ? "bg-paper text-navy ring-2 ring-inset ring-sky"
          : "bg-paper/[0.06] text-paper/0 hover:bg-paper/15 hover:text-paper/40 cursor-pointer",
      ].join(" ")}
    >
      {selected ? "✓" : ""}
    </button>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function Legend() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] uppercase tracking-[0.22em] text-mute">
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 bg-sky" /> Sold
      </span>
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 bg-cream/80" /> Reserved
      </span>
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 bg-paper border border-line" /> Selected
      </span>
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 bg-navy/95" /> Available
      </span>
    </div>
  );
}

function CheckoutField({
  name,
  label,
  hint,
  type = "text",
  required,
  maxLength,
}: {
  name: string;
  label: string;
  hint?: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] uppercase tracking-[0.24em] text-mute">
          {label}
          {required && <span className="text-red ml-1">*</span>}
        </span>
        {hint && <span className="text-[10px] text-mute/70">{hint}</span>}
      </div>
      <input
        type={type}
        name={name}
        required={required}
        maxLength={maxLength}
        className="w-full bg-paper border border-line focus:border-navy outline-none px-3 py-2 text-sm text-ink transition-colors"
      />
    </label>
  );
}
