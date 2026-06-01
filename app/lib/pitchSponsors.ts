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
  {
    id: "smiles-thai-massage",
    name: "Smiles Thai Massage",
    tier: "platinum",
    website: "https://www.smilesthaimassage.co.uk",
    squares: [
      { row: 5, col: 7 },
      { row: 5, col: 8 },
      { row: 6, col: 7 },
      { row: 6, col: 8 },
    ],
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
