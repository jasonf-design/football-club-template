/**
 * Football Web Pages API client.
 *
 * Docs: https://www.footballwebpages.co.uk/api
 * Base: https://api.footballwebpages.co.uk/v2/
 * Auth: FWP-API-Key header. Rate limit: 10 requests/minute.
 *
 * This module is server-only. Do not import from client code.
 */
import { and, eq } from "drizzle-orm";
import { db } from "~/db.server";
import { fixtures, fwpSnapshots, type Fixture } from "../../db/schema";

const BASE = "https://api.footballwebpages.co.uk/v2";

export class FwpError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "FwpError";
  }
}

function config() {
  const key = process.env.FWP_API_KEY?.trim();
  const teamRaw = process.env.FWP_TEAM_ID?.trim();
  if (!key) throw new FwpError("FWP_API_KEY is not set.");
  if (!teamRaw) throw new FwpError("FWP_TEAM_ID is not set.");
  const teamId = Number(teamRaw);
  if (!Number.isInteger(teamId) || teamId <= 0) {
    throw new FwpError(`FWP_TEAM_ID must be a positive integer, got "${teamRaw}".`);
  }
  return { key, teamId };
}

async function fwpFetch<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const { key } = config();
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { "FWP-API-Key": key } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new FwpError(
      `FWP ${res.status} on ${path}: ${body.slice(0, 200) || res.statusText}`,
      res.status,
    );
  }
  return (await res.json()) as T;
}

// --- fixtures-results response ---

type FwpTeamSide = {
  id: number;
  name: string;
  score: number | null;
  "half-time-score"?: number | null;
};

type FwpStatus = { full: string; short: string };

type FwpMatch = {
  id: number;
  date: string;       // "YYYY-MM-DD"
  time: string;       // "HH:MM" (24h, UK local)
  venue: string | null;
  attendance?: number | null;
  referee?: string | null;
  competition: { id: number; name: string };
  "home-team": FwpTeamSide;
  "away-team": FwpTeamSide;
  status: FwpStatus;
  round?: { id: number; name: string };
};

type FwpFixturesResults = {
  "fixtures-results": {
    matches: FwpMatch[];
    team?: { id: number; name: string };
  };
};

export async function fetchTeamFixtures(): Promise<FwpMatch[]> {
  const { teamId } = config();
  const data = await fwpFetch<FwpFixturesResults>("fixtures-results.json", {
    team: teamId,
  });
  return data["fixtures-results"]?.matches ?? [];
}

// --- mapping FWP → our schema ---

// FWP uses status.short codes. When the field is unrecognised (FWP sometimes
// puts the kickoff time there, e.g. "7.30pm") default to "scheduled" — a
// completed match will always have FT/AET/PEN so we never need the score fallback.
function mapStatus(m: FwpMatch): Fixture["status"] {
  const s = m.status.short.toUpperCase();
  if (s === "FT" || s === "AET" || s === "PEN") return "completed";
  if (s === "P-P" || s === "POST" || s === "PP") return "postponed";
  if (s === "CANC" || s === "ABAN") return "cancelled";
  if (s === "HT" || s === "1H" || s === "2H" || s === "LIVE") return "in_progress";
  return "scheduled";
}

// Combines "YYYY-MM-DD" + "HH:MM" into a Date interpreted as the server's
// local time (production runs Europe/London, matching the FWP feed).
function parseKickoff(m: FwpMatch): Date {
  const time = /^\d{2}:\d{2}$/.test(m.time) ? m.time : "15:00";
  return new Date(`${m.date}T${time}:00`);
}

type Mapped = {
  externalId: string;
  competition: string;
  opponent: string;
  homeAway: "home" | "away";
  kickoff: Date;
  venue: string | null;
  status: Fixture["status"];
  homeScore: number | null;
  awayScore: number | null;
};

function mapMatch(m: FwpMatch, ourTeamId: number): Mapped {
  const isHome = m["home-team"].id === ourTeamId;
  const opponentSide = isHome ? m["away-team"] : m["home-team"];
  const status = mapStatus(m);
  const hasResult = status === "completed" || status === "in_progress";
  return {
    externalId: String(m.id),
    competition: m.competition.name,
    opponent: opponentSide.name,
    homeAway: isHome ? "home" : "away",
    kickoff: parseKickoff(m),
    venue: m.venue?.trim() || null,
    status,
    homeScore: hasResult ? (m["home-team"].score ?? null) : null,
    awayScore: hasResult ? (m["away-team"].score ?? null) : null,
  };
}

// --- sync ---

export type SyncResult = {
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: Array<{ externalId: string; reason: string }>;
};

/**
 * Pull the team's fixtures-results from FWP and upsert into the DB.
 *
 * Match-source contract:
 *  - Only rows with source='fwp' are read or written by this function.
 *  - Rows with source='manual' are never touched, even if they look like
 *    duplicates. Admins keep full ownership of anything typed by hand.
 *  - Matched by externalId, which is the FWP match id.
 */
export async function syncDcfcFixtures(): Promise<SyncResult> {
  const { teamId } = config();
  const matches = await fetchTeamFixtures();
  const result: SyncResult = {
    fetched: matches.length,
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: [],
  };

  for (const raw of matches) {
    if (raw["home-team"].id !== teamId && raw["away-team"].id !== teamId) {
      result.skipped.push({
        externalId: String(raw.id),
        reason: "team not on either side",
      });
      continue;
    }
    const m = mapMatch(raw, teamId);

    const [existing] = await db
      .select()
      .from(fixtures)
      .where(and(eq(fixtures.source, "fwp"), eq(fixtures.externalId, m.externalId)))
      .limit(1);

    if (!existing) {
      await db.insert(fixtures).values({ ...m, source: "fwp", notes: null });
      result.created++;
      continue;
    }

    const changed =
      existing.competition !== m.competition ||
      existing.opponent !== m.opponent ||
      existing.homeAway !== m.homeAway ||
      existing.kickoff.getTime() !== m.kickoff.getTime() ||
      existing.venue !== m.venue ||
      existing.status !== m.status ||
      existing.homeScore !== m.homeScore ||
      existing.awayScore !== m.awayScore;

    if (!changed) {
      result.unchanged++;
      continue;
    }

    await db
      .update(fixtures)
      .set({
        competition: m.competition,
        opponent: m.opponent,
        homeAway: m.homeAway,
        kickoff: m.kickoff,
        venue: m.venue,
        status: m.status,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
      })
      .where(eq(fixtures.id, existing.id));
    result.updated++;
  }

  return result;
}

// --- snapshots (key/value JSON cache for static-during-offseason data) ---

export type LeagueTableTeam = {
  id: number;
  name: string;
  position: number;
  "total-points": number;
  outcome?: string;
  zone?: string;
  "all-matches": {
    played: number;
    won: number;
    drawn: number;
    lost: number;
    for: number;
    against: number;
    "goal-difference": number;
  };
};

export type LeagueTable = {
  competition: { id: number; name: string };
  description?: string;
  teams: LeagueTableTeam[];
};

type SnapshotKey = "league-table" | `match:${string}`;

async function upsertSnapshot(key: SnapshotKey, data: unknown): Promise<void> {
  const now = new Date();
  const [existing] = await db
    .select({ key: fwpSnapshots.key })
    .from(fwpSnapshots)
    .where(eq(fwpSnapshots.key, key))
    .limit(1);
  if (existing) {
    await db
      .update(fwpSnapshots)
      .set({ data, fetchedAt: now })
      .where(eq(fwpSnapshots.key, key));
  } else {
    await db.insert(fwpSnapshots).values({ key, data, fetchedAt: now });
  }
}

export async function syncLeagueTable(): Promise<{ teams: number; fetchedAt: Date }> {
  const { teamId } = config();
  const data = await fwpFetch<{ "league-table": LeagueTable }>(
    "league-table.json",
    { team: teamId },
  );
  const table = data["league-table"];
  await upsertSnapshot("league-table", table);
  return { teams: table.teams.length, fetchedAt: new Date() };
}

export type SnapshotRecord<T> = { data: T; fetchedAt: Date } | null;

async function readSnapshot<T>(key: SnapshotKey): Promise<SnapshotRecord<T>> {
  const [row] = await db
    .select()
    .from(fwpSnapshots)
    .where(eq(fwpSnapshots.key, key))
    .limit(1);
  if (!row) return null;
  return { data: row.data as T, fetchedAt: row.fetchedAt };
}

export function readLeagueTable() {
  return readSnapshot<LeagueTable>("league-table");
}

// --- match detail ---

export type MatchGoal = {
  description: string;
  minute: number;
  penalty?: boolean;
  sort?: number;
  player?: {
    id?: number;
    "first-name"?: string;
    "last-name"?: string;
  };
};

export type MatchLineupEntry = {
  shirt: number | null;
  sort: number;
  player: {
    id?: number;
    "first-name"?: string;
    "last-name"?: string;
  };
};

export type MatchTeamSide = {
  id: number;
  name: string;
  score: number | null;
  "half-time-score": number | null;
  goals?: MatchGoal[];
  "line-up"?: MatchLineupEntry[];
};

export type MatchDetail = {
  id: number;
  date: string;
  time: string;
  venue: string | null;
  attendance?: number | null;
  referee?: string | null;
  competition: { id: number; name: string };
  "home-team": MatchTeamSide;
  "away-team": MatchTeamSide;
  status: { full: string; short: string };
};

export async function fetchAndCacheMatchDetail(
  externalId: string,
): Promise<MatchDetail> {
  const cached = await readSnapshot<MatchDetail>(`match:${externalId}`);
  if (cached) return cached.data;
  const data = await fwpFetch<{ match: MatchDetail }>("match.json", {
    match: externalId,
  });
  await upsertSnapshot(`match:${externalId}`, data.match);
  return data.match;
}

export async function readMatchDetail(externalId: string) {
  return readSnapshot<MatchDetail>(`match:${externalId}`);
}
