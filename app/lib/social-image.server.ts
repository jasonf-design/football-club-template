import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { SponsorUri } from "./social-sponsor.server";

const C = {
  navy:   "#0e1f44",
  navyDk: "#020509",
  sky:    "#6bb1db",
  skyBt:  "#89c8e8",
  green:  "#2a7d4f",
  red:    "#e0392f",
  white:  "#ffffff",
} as const;

const FONT_DISPLAY = "'Liberation Sans Narrow', Impact, 'Arial Black', 'DejaVu Sans', sans-serif";
const FONT_BODY    = "'Liberation Sans', Arial, 'DejaVu Sans', Helvetica, sans-serif";

const crestDataUri = (() => {
  try {
    const buf = readFileSync(path.join(process.cwd(), "public", "crest-128.png"));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
})();

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
    timeZone: "Europe/London",
  });
}

function fmtDateLong(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: "Europe/London",
  });
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false,
    timeZone: "Europe/London",
  });
}

function txt(
  content: string,
  x: number,
  y: number,
  o: {
    size: number;
    fill?: string;
    family?: string;
    weight?: string | number;
    anchor?: string;
    spacing?: number;
    maxWidth?: number;
  },
): string {
  const fill   = o.fill   ?? C.white;
  const family = o.family ?? FONT_BODY;
  const weight = o.weight ?? "normal";
  const anchor = o.anchor ?? "middle";
  const extra  = [
    o.spacing  ? `letter-spacing="${o.spacing}"` : "",
    o.maxWidth ? `textLength="${o.maxWidth}" lengthAdjust="spacingAndGlyphs"` : "",
  ].filter(Boolean).join(" ");
  return `<text x="${Math.round(x)}" y="${Math.round(y)}" text-anchor="${anchor}" font-family="${family}" font-weight="${weight}" font-size="${Math.round(o.size)}" fill="${fill}"${extra ? " " + extra : ""}>${esc(content)}</text>`;
}

// Two-tone text: e.g. [{text:"FULL ",fill:sky},{text:"TIME",fill:white}]
function txt2(
  parts: Array<{ text: string; fill: string }>,
  x: number,
  y: number,
  o: {
    size: number;
    family?: string;
    weight?: string | number;
    anchor?: string;
    spacing?: number;
  },
): string {
  const family = o.family ?? FONT_DISPLAY;
  const weight = o.weight ?? 900;
  const anchor = o.anchor ?? "middle";
  const tspans = parts.map(p => `<tspan fill="${p.fill}">${esc(p.text)}</tspan>`).join("");
  return `<text x="${Math.round(x)}" y="${Math.round(y)}" text-anchor="${anchor}" font-family="${family}" font-weight="${weight}" font-size="${Math.round(o.size)}"${o.spacing ? ` letter-spacing="${o.spacing}"` : ""}>${tspans}</text>`;
}

function layout(w: number, h: number) {
  const BAR        = Math.max(8, Math.round(h * 0.011));
  const CREST_SZ   = Math.min(150, Math.round(w * 0.139));
  const PAD        = Math.round(h * 0.028);
  const BOTTOM_PAD = Math.round(h * 0.09);
  const crestY     = BAR + PAD;
  const cx         = w / 2;
  const contentTop    = crestY + CREST_SZ + PAD;
  const contentBottom = h - BAR - BOTTOM_PAD;
  const contentH      = contentBottom - contentTop;
  return { w, h, cx, BAR, CREST_SZ, PAD, BOTTOM_PAD, crestY, contentTop, contentH };
}

function sponsorStrip(w: number, h: number, BAR: number, BOTTOM_PAD: number, ss: SponsorUri[]): string {
  if (ss.length === 0) return "";
  const logoH  = Math.min(Math.round(BOTTOM_PAD * 0.40), 40);
  const vPad   = Math.round(logoH * 0.22);
  const hPad   = Math.round(w * 0.018);
  const gap    = Math.round(w * 0.020);
  const margin = Math.round(w * 0.05);
  const logoW  = Math.min(Math.round((w - 2 * margin - (ss.length - 1) * gap) / ss.length), Math.round(w * 0.14));
  const totalW = ss.length * logoW + (ss.length - 1) * gap;
  const startX = Math.round((w - totalW) / 2);
  const logoY  = Math.round(h - BAR - Math.round((BOTTOM_PAD + logoH) / 2));
  const sepY   = h - BAR - BOTTOM_PAD;
  const pillX  = startX - hPad;
  const pillY  = logoY - vPad;
  const pillW  = totalW + 2 * hPad;
  const pillH  = logoH + 2 * vPad;
  const pillR  = Math.round(pillH * 0.22);
  return [
    `<line x1="${margin}" y1="${sepY}" x2="${w - margin}" y2="${sepY}" stroke="${C.sky}" stroke-width="1" opacity="0.2"/>`,
    `<rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillR}" fill="#edf1f7"/>`,
    ...ss.map((s, i) => {
      const x = startX + i * (logoW + gap);
      return `<image href="${s.dataUri}" x="${x}" y="${logoY}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet"/>`;
    }),
  ].join("\n");
}

function chrome(w: number, h: number, children: string, sponsors: SponsorUri[]): string {
  const L = layout(w, h);
  const { cx, BAR, CREST_SZ, BOTTOM_PAD } = L;
  const crestX = Math.round((w - CREST_SZ) / 2);

  // Watermark crest
  const wmSz = Math.round(w * 0.65);
  const wmX  = Math.round(cx - wmSz / 2);
  const wmY  = Math.round(h * 0.18);

  // Corner accent triangles
  const triH = Math.round(h * 0.10);
  const triW = Math.round(w * 0.16);

  // Circular arc decorations (Georgia-style energy)
  const arc1r  = Math.round(w * 0.42);
  const arc1sw = Math.round(w * 0.09);
  const arc2r  = Math.round(w * 0.34);
  const arc2sw = Math.round(w * 0.075);

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <radialGradient id="bg" cx="50%" cy="38%" r="65%">
    <stop offset="0%" stop-color="#162548"/>
    <stop offset="100%" stop-color="#020509"/>
  </radialGradient>
  <pattern id="dots" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
    <circle cx="1" cy="1" r="0.5" fill="#ffffff" opacity="0.035"/>
  </pattern>
</defs>
<rect width="${w}" height="${h}" fill="url(#bg)"/>
<rect width="${w}" height="${h}" fill="url(#dots)"/>
<circle cx="${Math.round(w * 0.93)}" cy="${Math.round(h * 0.07)}" r="${arc1r}" fill="none" stroke="${C.sky}" stroke-width="${arc1sw}" opacity="0.09"/>
<circle cx="${Math.round(w * 0.07)}" cy="${Math.round(h * 0.93)}" r="${arc2r}" fill="none" stroke="${C.sky}" stroke-width="${arc2sw}" opacity="0.07"/>
${crestDataUri ? `<image href="${crestDataUri}" x="${wmX}" y="${wmY}" width="${wmSz}" height="${wmSz}" opacity="0.05" preserveAspectRatio="xMidYMid meet"/>` : ""}
<rect x="0" y="0" width="${w}" height="${BAR}" fill="${C.sky}"/>
<rect x="0" y="${h - BAR}" width="${w}" height="${BAR}" fill="${C.sky}"/>
<polygon points="${w},${BAR} ${w - triW},${BAR} ${w},${BAR + triH}" fill="${C.sky}" opacity="0.13"/>
<polygon points="0,${h - BAR} ${triW},${h - BAR} 0,${h - BAR - triH}" fill="${C.sky}" opacity="0.13"/>
${crestDataUri ? `<image href="${crestDataUri}" x="${crestX}" y="${L.crestY}" width="${CREST_SZ}" height="${CREST_SZ}" preserveAspectRatio="xMidYMid meet"/>` : ""}
${children}
${sponsorStrip(w, h, BAR, BOTTOM_PAD, sponsors)}
</svg>`;
}

// Wrap a title into up to 3 lines at a target char width
function wrapTitle(title: string, maxChars = 26): string[] {
  const words = title.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const candidate = cur ? `${cur} ${word}` : word;
    if (candidate.length > maxChars && cur) {
      lines.push(cur);
      cur = word;
      if (lines.length >= 2) break;
    } else {
      cur = candidate;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

export async function renderToPng(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

// ─── Result ──────────────────────────────────────────────────────────────────

export type ResultParams = {
  opponent:      string;
  competition:   string;
  kickoff:       Date;
  homeAway:      "home" | "away";
  dcfcScore:     number;
  opponentScore: number;
  scorers?:      string[];
};

export function buildResultSvg(p: ResultParams, w = 1080, h = 1080, sponsors: SponsorUri[] = []): string {
  const L = layout(w, h);
  const { cx, contentTop: ct, contentH: ch } = L;

  const outcome   = p.dcfcScore > p.opponentScore ? "WIN"
                  : p.dcfcScore === p.opponentScore ? "DRAW" : "LOSS";
  const bandColor = outcome === "WIN" ? C.green : outcome === "DRAW" ? C.sky : C.red;
  const prefix    = p.homeAway === "home" ? "VS" : "AT";

  const labelSz    = Math.min(ch * 0.057, 46);
  const scoreSz    = Math.min(ch * 0.345, 258);
  const opponentSz = Math.min(ch * 0.073, 58);
  const resultSz   = Math.min(ch * 0.068, 54);
  const metaSz     = Math.min(ch * 0.046, 37);
  const scorerSz   = Math.min(ch * 0.033, 27);

  const labelY     = ct + ch * 0.09;
  const scoreY     = ct + ch * 0.43;
  const opponentY  = ct + ch * 0.56;
  const bandTopY   = ct + ch * 0.635;
  const bandH      = Math.min(ch * 0.100, 78);
  const resultTextY = bandTopY + bandH * 0.70;
  const compY      = ct + ch * 0.815;
  const dateY      = ct + ch * 0.888;
  const scorersY   = ct + ch * 0.958;

  const bandX = Math.round(w * 0.06);
  const bandW = Math.round(w * 0.88);
  const bandR = Math.round(bandH * 0.16);

  const scorerLine = p.scorers?.length ? p.scorers.join("  ·  ") : "";

  const inner = `
${txt2([{text: "FULL ", fill: C.sky}, {text: "TIME", fill: C.white}], cx, labelY, { size: labelSz, spacing: Math.round(labelSz * 0.22) })}
${txt(`${p.dcfcScore}–${p.opponentScore}`, cx, scoreY, { size: scoreSz, fill: C.white, family: FONT_DISPLAY, weight: 900 })}
${txt(`${prefix} ${p.opponent.toUpperCase()}`, cx, opponentY, { size: opponentSz, fill: C.white, family: FONT_DISPLAY, weight: 700, maxWidth: Math.round(w * 0.82) })}
<rect x="${bandX}" y="${Math.round(bandTopY)}" width="${bandW}" height="${Math.round(bandH)}" rx="${bandR}" fill="${bandColor}" opacity="0.92"/>
${txt(outcome, cx, resultTextY, { size: resultSz, fill: C.white, family: FONT_DISPLAY, weight: 900, spacing: Math.round(resultSz * 0.18) })}
${txt(p.competition.toUpperCase(), cx, compY, { size: metaSz, fill: C.sky, maxWidth: Math.round(w * 0.82) })}
${txt(fmtDate(p.kickoff), cx, dateY, { size: Math.round(metaSz * 0.84), fill: "rgba(255,255,255,0.5)" })}
${scorerLine ? txt(scorerLine, cx, scorersY, { size: scorerSz, fill: "rgba(255,255,255,0.44)", maxWidth: Math.round(w * 0.86) }) : ""}`;

  return chrome(w, h, inner, sponsors);
}

// ─── Fixture ─────────────────────────────────────────────────────────────────

export type FixtureParams = {
  opponent:    string;
  competition: string;
  kickoff:     Date;
  homeAway:    "home" | "away";
  venue?:      string | null;
};

export function buildFixtureSvg(p: FixtureParams, w = 1080, h = 1080, sponsors: SponsorUri[] = []): string {
  const L = layout(w, h);
  const { cx, contentTop: ct, contentH: ch } = L;

  const isHome        = p.homeAway === "home";
  const homeAwayColor = isHome ? C.green : C.sky;
  const homeAwayLabel = isHome ? "HOME" : "AWAY";

  const labelSz    = Math.min(ch * 0.052, 42);
  const vsLabelSz  = Math.min(ch * 0.037, 30);
  const opponentSz = Math.min(ch * 0.125, 94);
  const pillSz     = Math.min(ch * 0.056, 45);
  const compSz     = Math.min(ch * 0.046, 37);
  const dateSz     = Math.min(ch * 0.060, 48);
  const timeSz     = Math.min(ch * 0.152, 115);
  const venueSz    = Math.min(ch * 0.034, 28);

  const labelY    = ct + ch * 0.085;
  const vsY       = ct + ch * 0.215;
  const opponentY = ct + ch * 0.345;
  const pillTopY  = ct + ch * 0.408;
  const pillH     = Math.min(ch * 0.085, 66);
  const pillW     = Math.round(w * 0.26);
  const pillR     = Math.round(pillH * 0.28);
  const pillTextY = pillTopY + pillH * 0.72;
  const dividerY  = ct + ch * 0.525;
  const compY     = ct + ch * 0.615;
  const dateY     = ct + ch * 0.718;
  const timeY     = ct + ch * 0.892;
  const venueY    = ct + ch * 0.970;

  const inner = `
${txt2([{text: "NEXT ", fill: C.white}, {text: "MATCH", fill: C.sky}], cx, labelY, { size: labelSz, spacing: Math.round(labelSz * 0.22) })}
${txt("VS", cx, vsY, { size: vsLabelSz, fill: "rgba(255,255,255,0.38)", family: FONT_DISPLAY, weight: 700, spacing: 6 })}
${txt(p.opponent.toUpperCase(), cx, opponentY, { size: opponentSz, fill: C.white, family: FONT_DISPLAY, weight: 900, maxWidth: Math.round(w * 0.88) })}
<rect x="${Math.round(cx - pillW / 2)}" y="${Math.round(pillTopY)}" width="${pillW}" height="${Math.round(pillH)}" rx="${pillR}" fill="${homeAwayColor}"/>
${txt(homeAwayLabel, cx, pillTextY, { size: pillSz, fill: C.white, family: FONT_DISPLAY, weight: 900, spacing: 3 })}
<line x1="${Math.round(w * 0.12)}" y1="${Math.round(dividerY)}" x2="${Math.round(w * 0.88)}" y2="${Math.round(dividerY)}" stroke="${C.sky}" stroke-width="1" opacity="0.28"/>
${txt(p.competition.toUpperCase(), cx, compY, { size: compSz, fill: C.sky, maxWidth: Math.round(w * 0.82) })}
${txt(fmtDateLong(p.kickoff).toUpperCase(), cx, dateY, { size: dateSz, fill: C.white, maxWidth: Math.round(w * 0.88) })}
${txt(fmtTime(p.kickoff), cx, timeY, { size: timeSz, fill: C.white, family: FONT_DISPLAY, weight: 900 })}
${p.venue ? txt(p.venue.toUpperCase(), cx, venueY, { size: venueSz, fill: "rgba(255,255,255,0.42)", maxWidth: Math.round(w * 0.82) }) : ""}`;

  return chrome(w, h, inner, sponsors);
}

// ─── Signing ─────────────────────────────────────────────────────────────────

export type SigningParams = {
  name:          string;
  position?:     string | null;
  photoDataUri?: string | null;
};

export function buildSigningSvg(p: SigningParams, w = 1080, h = 1080, sponsors: SponsorUri[] = []): string {
  return p.photoDataUri
    ? buildSigningWithPhoto(p, w, h, sponsors)
    : buildSigningNoPhoto(p, w, h, sponsors);
}

function buildSigningWithPhoto(p: SigningParams, w: number, h: number, sps: SponsorUri[]): string {
  const photoW  = Math.round(w * 0.52);
  const panelX  = Math.round(w * 0.48);
  const panelW  = w - panelX;
  const panelCX = panelX + panelW / 2;
  const diag    = Math.round(w * 0.07);

  const crestSz = Math.min(80, Math.round(panelW * 0.22));
  const crestX  = Math.round(panelX + (panelW - crestSz) / 2);
  const crestY  = Math.round(h * 0.06);

  const badgeTopY = h * 0.25;
  const badgeH    = Math.min(h * 0.092, 88);
  const badgeCY   = badgeTopY + badgeH / 2;
  const badgeW    = Math.round(panelW * 0.74);
  const badgeR    = Math.round(badgeH * 0.22);

  const nameY = h * 0.515;
  const posY  = h * 0.610;

  const signedSz = Math.min(h * 0.052, 52);
  const nameSz   = Math.min(h * 0.078, 74);
  const posSz    = Math.min(h * 0.040, 40);

  const wmSz = Math.round(panelW * 0.90);
  const wmX  = Math.round(panelX + (panelW - wmSz) / 2);
  const wmY  = Math.round(h * 0.28);

  // Sponsor strip — full image width at bottom
  const BAR        = 10;
  const BOTTOM_PAD = Math.round(h * 0.09);
  const strip = sponsorStrip(w, h, BAR, BOTTOM_PAD, sps);

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <radialGradient id="pbg" cx="75%" cy="38%" r="60%">
    <stop offset="0%" stop-color="#162548"/>
    <stop offset="100%" stop-color="#020509"/>
  </radialGradient>
  <pattern id="pdots" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
    <circle cx="1" cy="1" r="0.5" fill="#ffffff" opacity="0.035"/>
  </pattern>
  <clipPath id="photo-clip">
    <polygon points="0,0 ${photoW + diag},0 ${photoW},${h} 0,${h}"/>
  </clipPath>
</defs>
<rect width="${w}" height="${h}" fill="url(#pbg)"/>
<rect width="${w}" height="${h}" fill="url(#pdots)"/>
<circle cx="${Math.round(w * 0.93)}" cy="${Math.round(h * 0.07)}" r="${Math.round(w * 0.38)}" fill="none" stroke="${C.sky}" stroke-width="${Math.round(w * 0.08)}" opacity="0.09"/>
${crestDataUri ? `<image href="${crestDataUri}" x="${wmX}" y="${wmY}" width="${wmSz}" height="${wmSz}" opacity="0.05" preserveAspectRatio="xMidYMid meet"/>` : ""}
<image href="${p.photoDataUri}" x="0" y="0" width="${photoW + diag}" height="${h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#photo-clip)"/>
<polygon points="${photoW},0 ${photoW + diag},0 ${photoW},${h}" fill="${C.sky}" opacity="0.65"/>
<rect x="0" y="0" width="${w}" height="${BAR}" fill="${C.sky}"/>
<rect x="0" y="${h - BAR}" width="${w}" height="${BAR}" fill="${C.sky}"/>
${crestDataUri ? `<image href="${crestDataUri}" x="${crestX}" y="${crestY}" width="${crestSz}" height="${crestSz}" preserveAspectRatio="xMidYMid meet"/>` : ""}
<rect x="${Math.round(panelCX - badgeW / 2)}" y="${Math.round(badgeTopY)}" width="${badgeW}" height="${Math.round(badgeH)}" rx="${badgeR}" fill="${C.sky}"/>
${txt("SIGNED", panelCX, badgeCY + badgeH * 0.36, { size: signedSz, fill: C.white, family: FONT_DISPLAY, weight: 900, spacing: Math.round(signedSz * 0.22) })}
${txt(p.name.toUpperCase(), panelCX, nameY, { size: nameSz, fill: C.white, family: FONT_DISPLAY, weight: 900, maxWidth: Math.round(panelW * 0.88) })}
${p.position ? txt(p.position.toUpperCase(), panelCX, posY, { size: posSz, fill: C.sky, maxWidth: Math.round(panelW * 0.84) }) : ""}
${strip}
</svg>`;
}

function buildSigningNoPhoto(p: SigningParams, w: number, h: number, sponsors: SponsorUri[]): string {
  const L = layout(w, h);
  const { cx, contentTop: ct, contentH: ch } = L;

  const signedSz = Math.min(ch * 0.070, 55);
  const nameSz   = Math.min(ch * 0.115, 88);
  const posSz    = Math.min(ch * 0.056, 46);
  const clubSz   = Math.min(ch * 0.038, 32);

  const badgeTopY = ct + ch * 0.04;
  const badgeH    = Math.min(ch * 0.115, 88);
  const badgeCY   = badgeTopY + badgeH / 2;
  const badgeW    = Math.round(w * 0.44);
  const badgeR    = Math.round(badgeH * 0.15);

  const nameY = ct + ch * 0.40;
  const posY  = ct + ch * 0.54;
  const divY  = ct + ch * 0.635;
  const clubY = ct + ch * 0.920;

  const inner = `
<rect x="${Math.round(cx - badgeW / 2)}" y="${Math.round(badgeTopY)}" width="${badgeW}" height="${Math.round(badgeH)}" rx="${badgeR}" fill="${C.sky}"/>
${txt("SIGNED", cx, badgeCY + badgeH * 0.36, { size: signedSz, fill: C.white, family: FONT_DISPLAY, weight: 900, spacing: Math.round(signedSz * 0.22) })}
${txt(p.name.toUpperCase(), cx, nameY, { size: nameSz, fill: C.white, family: FONT_DISPLAY, weight: 900, maxWidth: Math.round(w * 0.88) })}
${p.position ? txt(p.position.toUpperCase(), cx, posY, { size: posSz, fill: C.sky, maxWidth: Math.round(w * 0.74) }) : ""}
<line x1="${Math.round(w * 0.15)}" y1="${Math.round(divY)}" x2="${Math.round(w * 0.85)}" y2="${Math.round(divY)}" stroke="${C.sky}" stroke-width="1" opacity="0.28"/>
${txt("DONCASTER CITY FC", cx, clubY, { size: clubSz, fill: "rgba(255,255,255,0.42)", spacing: 3 })}`;

  return chrome(w, h, inner, sponsors);
}

// ─── News ─────────────────────────────────────────────────────────────────────

export type NewsParams = {
  title:        string;
  publishedAt?: Date | null;
  heroDataUri?: string | null;
};

export function buildNewsSvg(p: NewsParams, w = 1080, h = 1080, sponsors: SponsorUri[] = []): string {
  const BAR        = Math.max(8, Math.round(h * 0.011));
  const BOTTOM_PAD = Math.round(h * 0.09);
  const lx         = Math.round(w * 0.065); // left text margin

  const lines     = wrapTitle(p.title.toUpperCase(), 24);
  const lineCount = lines.length;
  const titleSz   = lineCount === 1 ? Math.min(h * 0.085, 92)
                  : lineCount === 2 ? Math.min(h * 0.072, 78)
                  :                   Math.min(h * 0.057, 62);
  const lineGap   = Math.round(titleSz * 0.14);

  const newsSz        = Math.min(h * 0.028, 30);
  const dateSz        = Math.min(h * 0.028, 30);
  const contentBottom = h - BAR - BOTTOM_PAD - Math.round(h * 0.018);

  // Build text block bottom-up from contentBottom
  const dateY      = contentBottom;
  const titleLastY = dateY - dateSz - Math.round(h * 0.022);
  const title1Y    = titleLastY - (lineCount - 1) * (titleSz + lineGap);
  const newsY      = title1Y - titleSz * 0.15 - newsSz - Math.round(h * 0.022);

  // Vertical sky-blue accent bar spanning the whole text block
  const accentX  = lx - Math.round(w * 0.016);
  const accentY1 = newsY - newsSz;
  const accentY2 = dateY + 4;
  const accentW  = Math.round(w * 0.005);

  // Crest — top-right
  const crestSz  = Math.min(86, Math.round(w * 0.08));
  const crestX   = w - crestSz - Math.round(w * 0.038);
  const crestY   = BAR + Math.round(h * 0.025);

  // "DCFC" micro-label above NEWS
  const dcfcSz  = Math.min(h * 0.018, 20);
  const dcfcY   = newsY - newsSz - Math.round(h * 0.012);

  const titleLines = lines
    .map((line, i) =>
      txt(line, lx, title1Y + i * (titleSz + lineGap), {
        size: titleSz, fill: C.white, family: FONT_DISPLAY, weight: 900,
        anchor: "start", maxWidth: Math.round(w * 0.88),
      }),
    )
    .join("\n");

  if (p.heroDataUri) {
    return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="topdark" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#000000" stop-opacity="0.42"/>
    <stop offset="18%" stop-color="#000000" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="btmdark" x1="0" y1="0" x2="0" y2="1">
    <stop offset="48%" stop-color="#000000" stop-opacity="0"/>
    <stop offset="78%" stop-color="#000000" stop-opacity="0.82"/>
    <stop offset="100%" stop-color="#000000" stop-opacity="0.96"/>
  </linearGradient>
  <linearGradient id="leftdark" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#000000" stop-opacity="0.38"/>
    <stop offset="55%" stop-color="#000000" stop-opacity="0"/>
  </linearGradient>
</defs>
<rect width="${w}" height="${h}" fill="#000000"/>
<image href="${p.heroDataUri}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>
<rect width="${w}" height="${h}" fill="url(#topdark)"/>
<rect width="${w}" height="${h}" fill="url(#btmdark)"/>
<rect width="${w}" height="${h}" fill="url(#leftdark)"/>
<rect x="0" y="0" width="${w}" height="${BAR}" fill="${C.sky}"/>
<rect x="0" y="${h - BAR}" width="${w}" height="${BAR}" fill="${C.sky}"/>
${crestDataUri ? `<image href="${crestDataUri}" x="${crestX}" y="${crestY}" width="${crestSz}" height="${crestSz}" preserveAspectRatio="xMidYMid meet"/>` : ""}
<rect x="${accentX}" y="${Math.round(accentY1)}" width="${accentW}" height="${Math.round(accentY2 - accentY1)}" fill="${C.sky}"/>
${txt("DONCASTER CITY FC", lx, dcfcY, { size: dcfcSz, fill: "rgba(255,255,255,0.5)", family: FONT_BODY, anchor: "start", spacing: 2 })}
${txt("NEWS", lx, newsY, { size: newsSz, fill: C.sky, family: FONT_DISPLAY, weight: 900, anchor: "start", spacing: 4 })}
${titleLines}
${p.publishedAt ? txt(fmtDate(p.publishedAt), lx, dateY, { size: dateSz, fill: "rgba(255,255,255,0.5)", anchor: "start" }) : ""}
${sponsorStrip(w, h, BAR, BOTTOM_PAD, sponsors)}
</svg>`;
  }

  // No hero — dark chrome, same left-aligned layout
  const L = layout(w, h);
  const { contentTop: ct, contentH: ch } = L;
  const noTitleSz  = lineCount === 1 ? Math.min(ch * 0.12, 92)
                   : lineCount === 2 ? Math.min(ch * 0.095, 72)
                   :                   Math.min(ch * 0.072, 58);
  const noLineGap  = Math.round(noTitleSz * 0.14);
  const noNewsY    = ct + ch * 0.20;
  const noTitle1Y  = noNewsY + Math.round(ch * 0.10);
  const noDateY    = noTitle1Y + lineCount * (noTitleSz + noLineGap) + Math.round(ch * 0.06);
  const noAccentY1 = noNewsY - newsSz;
  const noAccentY2 = noDateY + 4;

  const inner = `
<rect x="${accentX}" y="${Math.round(noAccentY1)}" width="${accentW}" height="${Math.round(noAccentY2 - noAccentY1)}" fill="${C.sky}"/>
${txt("NEWS", lx, noNewsY, { size: newsSz, fill: C.sky, family: FONT_DISPLAY, weight: 900, anchor: "start", spacing: 4 })}
${lines.map((line, i) => txt(line, lx, noTitle1Y + i * (noTitleSz + noLineGap), { size: noTitleSz, fill: C.white, family: FONT_DISPLAY, weight: 900, anchor: "start", maxWidth: Math.round(w * 0.88) })).join("\n")}
${p.publishedAt ? txt(fmtDate(p.publishedAt), lx, noDateY, { size: dateSz, fill: C.sky, anchor: "start" }) : ""}`;

  return chrome(w, h, inner, sponsors);
}
