import { useMemo, useState } from "react";
import { Form } from "react-router";
import { getSponsorAt, pitchSponsors, type PitchSponsor, type SponsorTier } from "~/lib/pitchSponsors";

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

const COLS = 15;
const ROWS = 10;

// SVG viewBox: 10 units per cell → 150×100
const VW = 150;
const VH = 100;
const CW = VW / COLS;
const CH = VH / ROWS;

const M = {
  centreX: VW / 2,
  centreY: VH / 2,
  centreR: 13.07,   // 9.15m ÷ 7m/col × 10 units/col
  penAreaW: 57.6,   // 40.32m wide
  penAreaH: 24.26,  // 16.5m deep
  sixYardW: 26.17,  // 18.32m wide
  sixYardH: 8.09,   // 5.5m deep
  penSpotY: 16.18,  // 11m from goal line
  penArcR: 13.46,
  cornerR: 1.43,
  goalW: 10.46,
  goalH: 2.5,
};

const LINE = "rgba(255,255,255,0.55)";
const LW = 0.4;

// Pre-compute sponsor origin / span info keyed by "row-col"
const sponsorOriginMap = new Map<string, { sponsor: PitchSponsor; colSpan: number; rowSpan: number }>();
const sponsorSkipSet = new Set<string>();

for (const s of pitchSponsors) {
  const rows = s.squares.map((sq) => sq.row);
  const cols = s.squares.map((sq) => sq.col);
  const minRow = Math.min(...rows);
  const minCol = Math.min(...cols);
  const maxRow = Math.max(...rows);
  const maxCol = Math.max(...cols);
  sponsorOriginMap.set(`${minRow}-${minCol}`, {
    sponsor: s,
    colSpan: maxCol - minCol + 1,
    rowSpan: maxRow - minRow + 1,
  });
  for (const sq of s.squares) {
    if (sq.row !== minRow || sq.col !== minCol) {
      sponsorSkipSet.add(`${sq.row}-${sq.col}`);
    }
  }
}

export function PitchGrid({
  squares,
  config,
  stripeReady,
  error,
  success,
}: {
  squares: PitchSquare[];
  config: PitchGridConfig;
  stripeReady: boolean;
  error?: string | null;
  success?: boolean;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [tooltip, setTooltip] = useState<{ sponsor: PitchSponsor; x: number; y: number } | null>(null);

  const byRowCol = useMemo(() => {
    const m = new Map<string, PitchSquare>();
    for (const s of squares) m.set(`${s.row}-${s.col}`, s);
    return m;
  }, [squares]);

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

  // Build all 150 grid items with explicit placement — avoids CSS auto-placement bugs
  const gridItems = useMemo(() => {
    const items = [];
    for (let r = 1; r <= ROWS; r++) {
      for (let c = 1; c <= COLS; c++) {
        const key = `${r}-${c}`;
        const originInfo = sponsorOriginMap.get(key);
        const sq = byRowCol.get(key) ?? null;
        items.push({
          row: r,
          col: c,
          sq,
          origin: originInfo ?? null,
          isSkipped: sponsorSkipSet.has(key),
        });
      }
    }
    return items;
  }, [byRowCol]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-10 items-start">
      {/* Pitch */}
      <div>
        {/* padding-top enforces 15:10 aspect ratio reliably across all browsers */}
        <div className="relative w-full overflow-hidden" style={{ paddingTop: `${(ROWS / COLS) * 100}%` }}>
          <div className="absolute inset-0">
            {/* SVG pitch markings */}
            <svg
              viewBox={`0 0 ${VW} ${VH}`}
              className="absolute inset-0 w-full h-full pointer-events-none"
              preserveAspectRatio="none"
            >
              {Array.from({ length: COLS }, (_, i) => (
                <rect key={i} x={i * CW} y={0} width={CW} height={VH}
                  fill={i % 2 === 0 ? "#1a5c2a" : "#1e6830"} />
              ))}
              <rect x={LW / 2} y={LW / 2} width={VW - LW} height={VH - LW}
                fill="none" stroke={LINE} strokeWidth={LW} />
              <line x1={M.centreX} y1={0} x2={M.centreX} y2={VH} stroke={LINE} strokeWidth={LW} />
              <circle cx={M.centreX} cy={M.centreY} r={M.centreR} fill="none" stroke={LINE} strokeWidth={LW} />
              <circle cx={M.centreX} cy={M.centreY} r={0.6} fill={LINE} />
              <rect x={0} y={(VH - M.penAreaW) / 2} width={M.penAreaH} height={M.penAreaW}
                fill="none" stroke={LINE} strokeWidth={LW} />
              <rect x={0} y={(VH - M.sixYardW) / 2} width={M.sixYardH} height={M.sixYardW}
                fill="none" stroke={LINE} strokeWidth={LW} />
              <circle cx={M.penSpotY} cy={M.centreY} r={0.6} fill={LINE} />
              <path d={penaltyArc(M.penSpotY, M.centreY, M.penArcR, M.penAreaH, "right")}
                fill="none" stroke={LINE} strokeWidth={LW} />
              <rect x={VW - M.penAreaH} y={(VH - M.penAreaW) / 2} width={M.penAreaH} height={M.penAreaW}
                fill="none" stroke={LINE} strokeWidth={LW} />
              <rect x={VW - M.sixYardH} y={(VH - M.sixYardW) / 2} width={M.sixYardH} height={M.sixYardW}
                fill="none" stroke={LINE} strokeWidth={LW} />
              <circle cx={VW - M.penSpotY} cy={M.centreY} r={0.6} fill={LINE} />
              <path d={penaltyArc(VW - M.penSpotY, M.centreY, M.penArcR, VW - M.penAreaH, "left")}
                fill="none" stroke={LINE} strokeWidth={LW} />
              <rect x={-M.goalH} y={(VH - M.goalW) / 2} width={M.goalH} height={M.goalW}
                fill="none" stroke={LINE} strokeWidth={LW} />
              <rect x={VW} y={(VH - M.goalW) / 2} width={M.goalH} height={M.goalW}
                fill="none" stroke={LINE} strokeWidth={LW} />
              <path d={`M 0 ${M.cornerR} A ${M.cornerR} ${M.cornerR} 0 0 0 ${M.cornerR} 0`} fill="none" stroke={LINE} strokeWidth={LW} />
              <path d={`M ${VW - M.cornerR} 0 A ${M.cornerR} ${M.cornerR} 0 0 0 ${VW} ${M.cornerR}`} fill="none" stroke={LINE} strokeWidth={LW} />
              <path d={`M 0 ${VH - M.cornerR} A ${M.cornerR} ${M.cornerR} 0 0 1 ${M.cornerR} ${VH}`} fill="none" stroke={LINE} strokeWidth={LW} />
              <path d={`M ${VW - M.cornerR} ${VH} A ${M.cornerR} ${M.cornerR} 0 0 1 ${VW} ${VH - M.cornerR}`} fill="none" stroke={LINE} strokeWidth={LW} />
            </svg>

            {/* Cells: absolute % positioning — no CSS Grid, no layout ambiguity */}
            {gridItems.map(({ row, col, sq, origin, isSkipped }) => {
              if (isSkipped) return null;
              const colSpan = origin?.colSpan ?? 1;
              const rowSpan = origin?.rowSpan ?? 1;
              const pct = {
                position: "absolute" as const,
                left: `${((col - 1) / COLS) * 100}%`,
                top: `${((row - 1) / ROWS) * 100}%`,
                width: `${(colSpan / COLS) * 100}%`,
                height: `${(rowSpan / ROWS) * 100}%`,
              };
              return (
                <GridCell
                  key={`${row}-${col}`}
                  row={row}
                  col={col}
                  pct={pct}
                  square={sq}
                  origin={origin}
                  selected={sq ? selected.has(sq.id) : false}
                  onToggle={sq && sq.status === "available" ? () => toggle(sq) : undefined}
                  onSponsorEnter={(sponsor, e) => {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setTooltip({ sponsor, x: rect.left + rect.width / 2, y: rect.top });
                  }}
                  onSponsorLeave={() => setTooltip(null)}
                />
              );
            })}
          </div>
        </div>

        <Legend />
      </div>

      {/* Sponsor tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y - 10, transform: "translate(-50%, -100%)" }}
        >
          <SponsorTooltip sponsor={tooltip.sponsor} />
        </div>
      )}

      {/* Side panel */}
      <aside className="bg-paper border border-line p-6 lg:sticky lg:top-6">
        {success ? (
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-sky-deep mb-3">
              Request received
            </div>
            <div className="font-serif text-2xl text-navy leading-snug">
              Thanks — we&apos;ll be in touch.
            </div>
            <p className="mt-3 text-sm text-mute leading-relaxed">
              We&apos;ve noted your interest in those squares. Someone from the club
              will contact you to arrange payment.
            </p>
          </div>
        ) : (
          <>
            <div className="text-[10px] uppercase tracking-[0.28em] text-mute mb-2">
              Your selection
            </div>
            <div className="flex items-baseline gap-3">
              <div className="scoreboard text-5xl text-navy leading-none">{selected.size}</div>
              <div className="text-mute text-sm">{selected.size === 1 ? "square" : "squares"}</div>
              <div className="ml-auto text-right">
                <div className="scoreboard text-3xl text-navy leading-none">
                  £{(totalPence / 100).toLocaleString("en-GB")}
                </div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-mute mt-1">Total</div>
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
                      <span>R{s.row} · C{s.col}</span>
                      <button type="button" onClick={() => toggle(s)}
                        className="text-mute hover:text-red" aria-label="Remove">✕</button>
                    </div>
                  ))}
              </div>
            )}

            {selected.size === 0 ? (
              <p className="mt-6 text-sm text-mute leading-relaxed">
                Click any available square on the virtual pitch to add it to your selection.
                Pick as many as you like — each is £{(config.pricePence / 100).toFixed(0)}.
              </p>
            ) : !showForm ? (
              <div className="mt-6 flex flex-col gap-2">
                <button type="button" onClick={() => setShowForm(true)}
                  className="w-full bg-navy text-paper py-3 text-sm font-semibold tracking-[0.16em] uppercase hover:bg-navy-deep transition-colors">
                  Continue · £{(totalPence / 100).toLocaleString("en-GB")}
                </button>
                <button type="button" onClick={clearSelection}
                  className="text-xs uppercase tracking-[0.18em] text-mute hover:text-navy py-1">
                  Clear selection
                </button>
              </div>
            ) : (
              <Form method="post" className="mt-6 space-y-4">
                <input type="hidden" name="squareIds" value={[...selected].join(",")} />
                <CheckoutField name="displayName" label="Name to display"
                  hint="On the virtual pitch and in the programme" required maxLength={60} />
                <CheckoutField name="email" label="Email" type="email"
                  hint="We'll be in touch" required />
                <CheckoutField name="contactName" label="Your name" hint="Optional" />
                {error && (
                  <div className="text-xs border-l-2 border-red bg-red/5 text-red px-3 py-2">{error}</div>
                )}
                <button type="submit"
                  className="w-full bg-sky text-navy py-3 text-sm font-semibold tracking-[0.16em] uppercase hover:bg-navy hover:text-paper transition-colors">
                  {stripeReady
                    ? `Pay £${(totalPence / 100).toLocaleString("en-GB")} →`
                    : "Register interest →"}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="text-xs uppercase tracking-[0.18em] text-mute hover:text-navy w-full text-center">
                  ← Back to selection
                </button>
              </Form>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

const TIER_STYLE: Record<SponsorTier, { bg: string; ring: string; nameColor: string; labelColor: string }> = {
  platinum: {
    bg: "linear-gradient(135deg, #b8860b 0%, #d4af37 40%, #f0d060 60%, #c8941a 100%)",
    ring: "#d4af37",
    nameColor: "#1a0e00",
    labelColor: "rgba(80,50,0,0.75)",
  },
  gold: {
    bg: "linear-gradient(135deg, #a07820 0%, #c8a040 50%, #a07820 100%)",
    ring: "#c8a040",
    nameColor: "#1a0e00",
    labelColor: "rgba(60,40,0,0.7)",
  },
  silver: {
    bg: "linear-gradient(135deg, #8a9aaa 0%, #b0bfc8 50%, #8a9aaa 100%)",
    ring: "#b0bfc8",
    nameColor: "#0e1520",
    labelColor: "rgba(20,40,60,0.65)",
  },
};

function GridCell({
  row,
  col,
  pct,
  square,
  origin,
  selected,
  onToggle,
  onSponsorEnter,
  onSponsorLeave,
}: {
  row: number;
  col: number;
  pct: React.CSSProperties;
  square: PitchSquare | null;
  origin: { sponsor: PitchSponsor; colSpan: number; rowSpan: number } | null;
  selected: boolean;
  onToggle?: () => void;
  onSponsorEnter: (s: PitchSponsor, e: React.MouseEvent) => void;
  onSponsorLeave: () => void;
}) {
  // Sponsor block
  if (origin) {
    const { sponsor } = origin;
    const ts = TIER_STYLE[sponsor.tier];
    return (
      <div
        className="flex flex-col items-center justify-center cursor-pointer select-none group overflow-hidden"
        style={{
          ...pct,
          background: ts.bg,
          boxShadow: `inset 0 0 0 1px ${ts.ring}`,
          zIndex: 2,
        }}
        onMouseEnter={(e) => onSponsorEnter(sponsor, e)}
        onMouseLeave={onSponsorLeave}
        onClick={() => sponsor.website && window.open(sponsor.website, "_blank", "noopener")}
      >
        {sponsor.logo && (
          <img src={sponsor.logo} alt={sponsor.name}
            className="max-h-[45%] max-w-[80%] object-contain mb-1 opacity-90" />
        )}
        <span
          className="font-bold text-center leading-tight px-1"
          style={{
            color: ts.nameColor,
            fontSize: "clamp(6px, 1.5vw, 13px)",
            textShadow: "0 1px 1px rgba(255,255,255,0.3)",
          }}
        >
          {sponsor.name}
        </span>
        <span
          className="uppercase tracking-widest mt-0.5 font-medium"
          style={{ color: ts.labelColor, fontSize: "clamp(4px, 0.7vw, 8px)" }}
        >
          {sponsor.tier}
        </span>
        {/* Shine overlay */}
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </div>
    );
  }

  const base = "transition-colors overflow-hidden";

  if (!square) {
    return <div className={base} style={{ ...pct, borderRight: "1px solid rgba(255,255,255,0.04)" }} />;
  }

  if (square.status === "sold") {
    return (
      <div
        className={`${base} bg-sky/65 flex items-center justify-center cursor-help`}
        style={{ ...pct, boxShadow: "inset 0 0 0 1px rgba(100,200,255,0.3)" }}
        title={square.sponsorName ?? "Sold"}
      >
        {square.sponsorName && (
          <span className="text-[6px] sm:text-[7px] text-navy font-bold text-center leading-none px-0.5 w-full truncate text-center">
            {initials(square.sponsorName)}
          </span>
        )}
      </div>
    );
  }

  if (square.status === "pending") {
    return (
      <div className={`${base} bg-white/8 cursor-not-allowed`}
        style={{ ...pct, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}
        title="Reserved" />
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Sponsor square row ${square.row} column ${square.col}`}
      className={[
        base,
        selected
          ? "bg-paper"
          : "bg-white/[0.04] hover:bg-white/[0.14] cursor-pointer",
      ].join(" ")}
      style={{
        ...pct,
        boxShadow: selected
          ? "inset 0 0 0 2px #7dd3fc"
          : "inset 0 0 0 1px rgba(255,255,255,0.06)",
      }}
    >
      {selected && (
        <span className="absolute inset-0 flex items-center justify-center text-navy text-[9px] sm:text-[11px] font-bold">
          ✓
        </span>
      )}
    </button>
  );
}

function SponsorTooltip({ sponsor }: { sponsor: PitchSponsor }) {
  const ts = TIER_STYLE[sponsor.tier];
  return (
    <div
      className="px-4 py-2.5 rounded shadow-xl text-center min-w-[140px] relative"
      style={{ background: ts.bg, boxShadow: `0 4px 20px rgba(0,0,0,0.4), inset 0 0 0 1px ${ts.ring}` }}
    >
      <div className="font-bold text-sm leading-tight" style={{ color: ts.nameColor }}>
        {sponsor.name}
      </div>
      <div className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: ts.labelColor }}>
        {sponsor.tier} sponsor
      </div>
      {sponsor.website && (
        <div className="text-[10px] mt-1" style={{ color: ts.labelColor }}>
          Click to visit ↗
        </div>
      )}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0"
        style={{
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          borderTop: `5px solid ${ts.ring}`,
        }}
      />
    </div>
  );
}

function penaltyArc(spotX: number, spotY: number, r: number, areaEdgeX: number, side: "left" | "right"): string {
  const cos = (areaEdgeX - spotX) / r;
  const clampedCos = Math.max(-1, Math.min(1, cos));
  const angle = Math.acos(clampedCos);
  const y1 = spotY - Math.sin(angle) * r;
  const y2 = spotY + Math.sin(angle) * r;
  const sweep = side === "right" ? 1 : 0;
  return `M ${areaEdgeX} ${y1} A ${r} ${r} 0 0 ${sweep} ${areaEdgeX} ${y2}`;
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function Legend() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] uppercase tracking-[0.22em] text-mute">
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 bg-sky/65" /> Sold
      </span>
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 bg-white/8" /> Reserved
      </span>
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 bg-paper" style={{ boxShadow: "inset 0 0 0 2px #7dd3fc" }} /> Selected
      </span>
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 bg-white/5" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)" }} /> Available
      </span>
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-sm"
          style={{ background: "linear-gradient(135deg, #b8860b, #f0d060, #c8941a)" }} /> Sponsor
      </span>
    </div>
  );
}

function CheckoutField({
  name, label, hint, type = "text", required, maxLength,
}: {
  name: string; label: string; hint?: string; type?: string; required?: boolean; maxLength?: number;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] uppercase tracking-[0.24em] text-mute">
          {label}{required && <span className="text-red ml-1">*</span>}
        </span>
        {hint && <span className="text-[10px] text-mute/70">{hint}</span>}
      </div>
      <input
        type={type} name={name} required={required} maxLength={maxLength}
        className="w-full bg-paper border border-line focus:border-navy outline-none px-3 py-2 text-sm text-ink transition-colors"
      />
    </label>
  );
}
