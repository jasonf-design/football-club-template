import { useMemo, useState } from "react";
import { Form } from "react-router";
import { getSponsorAt, type PitchSponsor, type SponsorTier } from "~/lib/pitchSponsors";

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

// SVG viewBox units = 10 per cell → 150×100
const VW = 150;
const VH = 100;
const CW = VW / COLS; // 10
const CH = VH / ROWS; // 10

// Pitch markings calculated from real pitch proportions (105m × 68m)
const M = {
  centreX: VW / 2,  // 75
  centreY: VH / 2,  // 50
  centreR: 13.07,   // 9.15m ÷ 7m × 10 = 13.07

  // Penalty areas (both ends)
  penAreaW: 57.6,   // 40.32m ÷ 7m × 10
  penAreaH: 24.26,  // 16.5m ÷ 6.8m × 10
  // 6-yard boxes
  sixYardW: 26.17,  // 18.32m ÷ 7m × 10
  sixYardH: 8.09,   // 5.5m ÷ 6.8m × 10

  penSpotY: 16.18,  // 11m ÷ 6.8m × 10 from goal line
  penArcR: 9.15 / 6.8 * 10, // ~13.46

  cornerR: 1.43,    // 1m ÷ 7m × 10

  goalW: 10.46,     // 7.32m ÷ 7m × 10
  goalH: 2.5,       // visual depth (goals extend off pitch)
};

const LINE = "rgba(255,255,255,0.55)";
const LINE_W = 0.4;

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
  const [hoverSponsor, setHoverSponsor] = useState<PitchSponsor | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

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

  // Build grid cells: 15×10 with their sponsor/purchase status
  const cells = useMemo(() => {
    const out = [];
    for (let r = 1; r <= ROWS; r++) {
      for (let c = 1; c <= COLS; c++) {
        const sq = byRowCol.get(`${r}-${c}`) ?? null;
        const sponsor = getSponsorAt(r, c);
        out.push({ row: r, col: c, sq, sponsor });
      }
    }
    return out;
  }, [byRowCol]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-10 items-start">
      {/* Pitch */}
      <div>
        <div
          className="relative w-full"
          style={{ aspectRatio: `${COLS}/${ROWS}` }}
        >
          {/* SVG pitch markings layer */}
          <svg
            viewBox={`0 0 ${VW} ${VH}`}
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
          >
            {/* Grass stripes */}
            {Array.from({ length: COLS }, (_, i) => (
              <rect
                key={i}
                x={i * CW}
                y={0}
                width={CW}
                height={VH}
                fill={i % 2 === 0 ? "#1a5c2a" : "#1e6830"}
              />
            ))}

            {/* Touch lines */}
            <rect
              x={LINE_W / 2}
              y={LINE_W / 2}
              width={VW - LINE_W}
              height={VH - LINE_W}
              fill="none"
              stroke={LINE}
              strokeWidth={LINE_W}
            />

            {/* Halfway line */}
            <line
              x1={M.centreX}
              y1={0}
              x2={M.centreX}
              y2={VH}
              stroke={LINE}
              strokeWidth={LINE_W}
            />

            {/* Centre circle */}
            <circle
              cx={M.centreX}
              cy={M.centreY}
              r={M.centreR}
              fill="none"
              stroke={LINE}
              strokeWidth={LINE_W}
            />
            <circle cx={M.centreX} cy={M.centreY} r={0.6} fill={LINE} />

            {/* Left penalty area */}
            <rect
              x={0}
              y={(VH - M.penAreaW) / 2}
              width={M.penAreaH}
              height={M.penAreaW}
              fill="none"
              stroke={LINE}
              strokeWidth={LINE_W}
            />
            {/* Left 6-yard box */}
            <rect
              x={0}
              y={(VH - M.sixYardW) / 2}
              width={M.sixYardH}
              height={M.sixYardW}
              fill="none"
              stroke={LINE}
              strokeWidth={LINE_W}
            />
            {/* Left penalty spot */}
            <circle cx={M.penSpotY} cy={M.centreY} r={0.6} fill={LINE} />
            {/* Left penalty arc */}
            <path
              d={penaltyArc(M.penSpotY, M.centreY, M.penArcR, M.penAreaH, "right")}
              fill="none"
              stroke={LINE}
              strokeWidth={LINE_W}
            />

            {/* Right penalty area */}
            <rect
              x={VW - M.penAreaH}
              y={(VH - M.penAreaW) / 2}
              width={M.penAreaH}
              height={M.penAreaW}
              fill="none"
              stroke={LINE}
              strokeWidth={LINE_W}
            />
            {/* Right 6-yard box */}
            <rect
              x={VW - M.sixYardH}
              y={(VH - M.sixYardW) / 2}
              width={M.sixYardH}
              height={M.sixYardW}
              fill="none"
              stroke={LINE}
              strokeWidth={LINE_W}
            />
            {/* Right penalty spot */}
            <circle cx={VW - M.penSpotY} cy={M.centreY} r={0.6} fill={LINE} />
            {/* Right penalty arc */}
            <path
              d={penaltyArc(VW - M.penSpotY, M.centreY, M.penArcR, VW - M.penAreaH, "left")}
              fill="none"
              stroke={LINE}
              strokeWidth={LINE_W}
            />

            {/* Goals */}
            <rect
              x={-M.goalH}
              y={(VH - M.goalW) / 2}
              width={M.goalH}
              height={M.goalW}
              fill="none"
              stroke={LINE}
              strokeWidth={LINE_W}
            />
            <rect
              x={VW}
              y={(VH - M.goalW) / 2}
              width={M.goalH}
              height={M.goalW}
              fill="none"
              stroke={LINE}
              strokeWidth={LINE_W}
            />

            {/* Corner arcs */}
            <path d={`M 0 ${M.cornerR} A ${M.cornerR} ${M.cornerR} 0 0 0 ${M.cornerR} 0`} fill="none" stroke={LINE} strokeWidth={LINE_W} />
            <path d={`M ${VW - M.cornerR} 0 A ${M.cornerR} ${M.cornerR} 0 0 0 ${VW} ${M.cornerR}`} fill="none" stroke={LINE} strokeWidth={LINE_W} />
            <path d={`M 0 ${VH - M.cornerR} A ${M.cornerR} ${M.cornerR} 0 0 1 ${M.cornerR} ${VH}`} fill="none" stroke={LINE} strokeWidth={LINE_W} />
            <path d={`M ${VW - M.cornerR} ${VH} A ${M.cornerR} ${M.cornerR} 0 0 1 ${VW} ${VH - M.cornerR}`} fill="none" stroke={LINE} strokeWidth={LINE_W} />
          </svg>

          {/* Grid overlay */}
          <div
            className="absolute inset-0 grid"
            style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}
          >
            {cells.map(({ row, col, sq, sponsor }) => (
              <GridCell
                key={`${row}-${col}`}
                row={row}
                col={col}
                square={sq}
                sponsor={sponsor}
                selected={sq ? selected.has(sq.id) : false}
                onToggle={sq ? () => toggle(sq) : undefined}
                onSponsorHover={(s, e) => {
                  setHoverSponsor(s);
                  if (e) {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setHoverPos({ x: rect.left + rect.width / 2, y: rect.top });
                  }
                }}
                onSponsorLeave={() => { setHoverSponsor(null); setHoverPos(null); }}
              />
            ))}
          </div>
        </div>

        <Legend />
      </div>

      {/* Sponsor tooltip (portal-style, fixed) */}
      {hoverSponsor && hoverPos && (
        <SponsorTooltip sponsor={hoverSponsor} pos={hoverPos} />
      )}

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
                  <span>R{s.row} · C{s.col}</span>
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
            Click any available square on the pitch to add it to your selection.
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

const TIER_STYLES: Record<SponsorTier, { bg: string; border: string; text: string }> = {
  platinum: { bg: "rgba(212,175,55,0.82)", border: "rgba(255,215,80,0.9)", text: "#1a1a1a" },
  gold:     { bg: "rgba(200,160,40,0.75)", border: "rgba(240,190,60,0.85)", text: "#1a1a1a" },
  silver:   { bg: "rgba(160,170,180,0.75)", border: "rgba(190,200,210,0.85)", text: "#1a1a1a" },
};

function GridCell({
  row,
  col,
  square,
  sponsor,
  selected,
  onToggle,
  onSponsorHover,
  onSponsorLeave,
}: {
  row: number;
  col: number;
  square: PitchSquare | null;
  sponsor: PitchSponsor | undefined;
  selected: boolean;
  onToggle?: () => void;
  onSponsorHover: (s: PitchSponsor, e: React.MouseEvent | null) => void;
  onSponsorLeave: () => void;
}) {
  // Commercial sponsor square
  if (sponsor) {
    const ts = TIER_STYLES[sponsor.tier];
    return (
      <div
        className="relative cursor-pointer group"
        style={{
          background: ts.bg,
          outline: `1px solid ${ts.border}`,
          outlineOffset: "-1px",
        }}
        onMouseEnter={(e) => onSponsorHover(sponsor, e)}
        onMouseLeave={onSponsorLeave}
        onClick={() => sponsor.website && window.open(sponsor.website, "_blank", "noopener")}
        title={sponsor.name}
      >
        <TierBadge tier={sponsor.tier} row={row} col={col} sponsor={sponsor} />
      </div>
    );
  }

  const base = "relative transition-colors";

  if (!square) {
    return <div className={`${base} border border-white/5`} />;
  }

  if (square.status === "sold") {
    return (
      <div
        className={`${base} bg-sky/70 border border-sky/40 cursor-help group flex items-center justify-center`}
        title={square.sponsorName ?? "Sold"}
      >
        {square.sponsorName && (
          <span className="text-[6px] sm:text-[7px] text-navy font-bold leading-none text-center px-0.5 truncate w-full text-center">
            {initials(square.sponsorName)}
          </span>
        )}
      </div>
    );
  }

  if (square.status === "pending") {
    return (
      <div
        className={`${base} bg-white/10 border border-white/10 cursor-not-allowed`}
        title="Reserved"
      />
    );
  }

  // Available
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Sponsor square row ${square.row} column ${square.col}`}
      className={[
        base,
        "border",
        selected
          ? "bg-paper border-sky ring-1 ring-inset ring-sky"
          : "bg-white/[0.04] border-white/8 hover:bg-white/[0.14] hover:border-white/25 cursor-pointer",
      ].join(" ")}
    >
      {selected && (
        <span className="absolute inset-0 flex items-center justify-center text-navy text-[8px] sm:text-[10px] font-bold">
          ✓
        </span>
      )}
    </button>
  );
}

function TierBadge({
  tier,
  row,
  col,
  sponsor,
}: {
  tier: SponsorTier;
  row: number;
  col: number;
  sponsor: PitchSponsor;
}) {
  // Only show label on the top-left square of a multi-square sponsor
  const isOrigin = sponsor.squares[0]?.row === row && sponsor.squares[0]?.col === col;
  if (!isOrigin) return null;

  const spanCols = Math.max(...sponsor.squares.map((s) => s.col)) - Math.min(...sponsor.squares.map((s) => s.col)) + 1;
  const spanRows = Math.max(...sponsor.squares.map((s) => s.row)) - Math.min(...sponsor.squares.map((s) => s.row)) + 1;

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none overflow-hidden px-1"
      style={{
        width: `${spanCols * 100}%`,
        height: `${spanRows * 100}%`,
      }}
    >
      <span
        className="font-semibold text-center leading-tight"
        style={{
          fontSize: tier === "platinum" ? "clamp(5px, 1.1vw, 11px)" : "clamp(4px, 0.9vw, 9px)",
          color: TIER_STYLES[tier].text,
          textShadow: "none",
        }}
      >
        {sponsor.name}
      </span>
      <span
        className="uppercase tracking-widest mt-0.5"
        style={{
          fontSize: "clamp(4px, 0.6vw, 7px)",
          color: tier === "platinum" ? "rgba(100,70,0,0.8)" : "rgba(60,60,60,0.7)",
        }}
      >
        {tier}
      </span>
    </div>
  );
}

function SponsorTooltip({
  sponsor,
  pos,
}: {
  sponsor: PitchSponsor;
  pos: { x: number; y: number };
}) {
  const ts = TIER_STYLES[sponsor.tier];
  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: pos.x,
        top: pos.y - 8,
        transform: "translate(-50%, -100%)",
      }}
    >
      <div
        className="px-3 py-2 rounded shadow-lg text-center min-w-[120px]"
        style={{ background: ts.bg, border: `1px solid ${ts.border}`, color: ts.text }}
      >
        <div className="font-semibold text-sm leading-tight">{sponsor.name}</div>
        <div className="text-[10px] uppercase tracking-widest mt-0.5 opacity-70">{sponsor.tier} sponsor</div>
        {sponsor.website && (
          <div className="text-[10px] mt-1 opacity-60">Click to visit ↗</div>
        )}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0"
          style={{
            borderLeft: "5px solid transparent",
            borderRight: "5px solid transparent",
            borderTop: `5px solid ${ts.border}`,
          }}
        />
      </div>
    </div>
  );
}

function penaltyArc(
  spotX: number,
  spotY: number,
  r: number,
  areaEdgeX: number,
  side: "left" | "right",
): string {
  const angle = Math.acos((areaEdgeX - spotX) / r);
  const sign = side === "right" ? 1 : -1;
  const y1 = spotY - Math.sin(angle) * r;
  const y2 = spotY + Math.sin(angle) * r;
  const x1 = areaEdgeX;
  const x2 = areaEdgeX;
  return `M ${x1} ${y1} A ${r} ${r} 0 0 ${side === "right" ? 1 : 0} ${x2} ${y2}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function Legend() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] uppercase tracking-[0.22em] text-mute">
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 bg-sky/70" /> Sold
      </span>
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 bg-white/10" /> Reserved
      </span>
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 bg-paper border border-sky" /> Selected
      </span>
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 bg-white/5 border border-white/20" /> Available
      </span>
      <span className="flex items-center gap-2">
        <span className="h-3 w-3" style={{ background: "rgba(212,175,55,0.82)" }} /> Sponsor
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
