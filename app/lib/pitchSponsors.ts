export type SponsorTier = "platinum" | "gold" | "silver";

export type PitchSponsor = {
  id: string;
  name: string;
  tier: SponsorTier;
  logo?: string;
  website?: string;
  squares: Array<{ row: number; col: number }>;
};

// Grid: 15 cols × 10 rows. Rows 1–10 top to bottom. Cols 1–15 left to right.
// Centre of pitch: row 5.5, col 8 (between rows 5/6, cols 7/8 in 1-indexed).
export const pitchSponsors: PitchSponsor[] = [
  // ── Platinum ──────────────────────────────────────────────────────────────
  {
    id: "smile-thai-massage",
    name: "Smile Thai Massage",
    tier: "platinum",
    logo: "/sponsors/smile-thai-massage.jpg",
    website: "https://www.smilethaimassage.co.uk",
    squares: [
      { row: 5, col: 7 },
      { row: 5, col: 8 },
      { row: 6, col: 7 },
      { row: 6, col: 8 },
    ],
  },

  // ── Gold ──────────────────────────────────────────────────────────────────
  {
    id: "college-grove-estates",
    name: "College Grove Estates",
    tier: "gold",
    squares: [
      { row: 2, col: 4 },
      { row: 2, col: 5 },
    ],
  },
  {
    id: "smokeys",
    name: "Smokeys",
    tier: "gold",
    logo: "/sponsors/smokeys.png",
    website: "https://smokeys.online/",
    squares: [
      { row: 2, col: 11 },
      { row: 2, col: 12 },
    ],
  },
  {
    id: "green-electrical",
    name: "Green Electrical & Plumbing Supplies",
    tier: "gold",
    logo: "/sponsors/green-electrical.png",
    website: "https://www.green.supplies/",
    squares: [
      { row: 9, col: 4 },
      { row: 9, col: 5 },
    ],
  },
  {
    id: "visit-bawtry",
    name: "Visit Bawtry",
    tier: "gold",
    logo: "/sponsors/visit-bawtry.png",
    website: "https://www.visitbawtry.com/",
    squares: [
      { row: 9, col: 11 },
      { row: 9, col: 12 },
    ],
  },

  // ── Silver ────────────────────────────────────────────────────────────────
  {
    id: "aay",
    name: "AAY",
    tier: "silver",
    logo: "/sponsors/aay.avif",
    squares: [
      { row: 5, col: 6 },
      { row: 6, col: 6 },
    ],
  },
  {
    id: "alt-rubber",
    name: "Alt Rubber and Plastics",
    tier: "silver",
    logo: "/sponsors/alt-rubber.png",
    website: "https://www.altrubberplastics.co.uk/",
    squares: [{ row: 5, col: 2 }],
  },
  {
    id: "eland-cables",
    name: "Eland Cables",
    tier: "silver",
    logo: "/sponsors/eland-cables.png",
    website: "https://www.elandcables.com/",
    squares: [{ row: 6, col: 14 }],
  },
];

export function getSponsorAt(
  row: number,
  col: number,
): PitchSponsor | undefined {
  return pitchSponsors.find((s) =>
    s.squares.some((sq) => sq.row === row && sq.col === col),
  );
}

export const TIER_SQUARES: Record<SponsorTier, number> = {
  platinum: 4,
  gold: 2,
  silver: 1,
};
