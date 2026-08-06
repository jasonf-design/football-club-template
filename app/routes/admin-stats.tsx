import { max, eq } from "drizzle-orm";
import { Form, Link } from "react-router";
import type { Route } from "./+types/admin-stats";
import { db } from "~/db.server";
import { fixtures } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";
import {
  FwpError,
  syncDcfcFixtures,
  readLeagueTable,
  syncLeagueTable,
  readTopScorers,
  syncTopScorers,
  type SyncResult,
} from "~/lib/fwp.server";
import { AdminPage, SecondaryButton } from "~/components/admin/AdminShell";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Sync · Admin" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const [leagueTable, topScorers] = await Promise.all([
    readLeagueTable(),
    readTopScorers(),
  ]);

  const [fixturesRow] = await db
    .select({ lastSync: max(fixtures.updatedAt) })
    .from(fixtures)
    .where(eq(fixtures.source, "fwp"));

  return {
    leagueTable,
    topScorers,
    fixturesLastSync: fixturesRow?.lastSync ?? null,
  };
}

type ActionResult =
  | { syncedKey: string; summary: string }
  | { syncError: string };

export async function action({ request }: Route.ActionArgs): Promise<ActionResult> {
  await requireAdmin(request);
  const form = await request.formData();
  const intent = form.get("intent");
  try {
    if (intent === "sync-fixtures") {
      const result: SyncResult = await syncDcfcFixtures();
      return {
        syncedKey: "fixtures",
        summary: `Fetched ${result.fetched} — created ${result.created}, updated ${result.updated}, unchanged ${result.unchanged}${result.skipped.length ? `, skipped ${result.skipped.length}` : ""}.`,
      };
    }
    if (intent === "sync-league-table") {
      const { teams } = await syncLeagueTable();
      return { syncedKey: "league-table", summary: `${teams} teams stored.` };
    }
    if (intent === "sync-top-scorers") {
      const { count, competition } = await syncTopScorers();
      return {
        syncedKey: "top-scorers",
        summary: `${count} scorers from ${competition}.`,
      };
    }
    return { syncError: `Unknown intent: ${String(intent)}` };
  } catch (err) {
    const msg =
      err instanceof FwpError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unknown error";
    return { syncError: msg };
  }
}

function relativeTime(d: Date): string {
  const ms = Date.now() - new Date(d).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

function SyncCard({
  title,
  description,
  hint,
  meta: metaText,
  intent,
  buttonLabel = "Sync now",
  disabled,
  disabledReason,
}: {
  title: string;
  description: string;
  hint?: string;
  meta: string;
  intent: string;
  buttonLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <section className="border border-line bg-paper p-6 flex items-start justify-between gap-6">
      <div className="flex-1 min-w-0">
        <h2 className="font-serif text-2xl text-navy">{title}</h2>
        <p className="text-sm text-mute mt-1">{description}</p>
        {hint && <p className="text-xs text-mute/70 mt-1 italic">{hint}</p>}
        <p className="text-xs text-mute mt-2">{metaText}</p>
        {disabled && disabledReason && (
          <p className="text-xs text-amber-600 mt-1">{disabledReason}</p>
        )}
      </div>
      <Form method="post" className="shrink-0">
        <input type="hidden" name="intent" value={intent} />
        <SecondaryButton type="submit" disabled={disabled}>{buttonLabel}</SecondaryButton>
      </Form>
    </section>
  );
}

export default function AdminStats({ loaderData, actionData }: Route.ComponentProps) {
  const { leagueTable, topScorers, fixturesLastSync } = loaderData;
  const ok = actionData && "syncedKey" in actionData ? actionData : null;
  const err = actionData && "syncError" in actionData ? actionData.syncError : null;

  return (
    <AdminPage
      eyebrow="Data"
      title="FWP sync"
      description="Pull live data from the Football Web Pages API and cache it locally. The public site reads from these snapshots — no API calls happen on visitor page loads."
    >
      {ok && (
        <div className="mb-6 border border-line bg-paper-warm/50 p-4 text-sm text-navy">
          <div className="font-semibold mb-1">Synced "{ok.syncedKey}"</div>
          <div className="text-mute">{ok.summary}</div>
        </div>
      )}
      {err && (
        <div className="mb-6 border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <div className="font-semibold mb-1">Sync failed</div>
          <div>{err}</div>
        </div>
      )}

      <div className="space-y-4">
        <SyncCard
          title="Fixtures & results"
          description="Full season schedule — kick-off times, scores, and statuses. Also synced from the Fixtures admin page."
          hint="Safe to run at any time. Only FWP-sourced rows are touched; manually-added fixtures are never overwritten."
          intent="sync-fixtures"
          meta={fixturesLastSync ? `Last updated ${relativeTime(fixturesLastSync)}` : "Never synced."}
        />

        <SyncCard
          title="League table"
          description="NCEL standings shown on the Fixtures page and in match-day programmes. Refresh once per matchday during the season."
          intent="sync-league-table"
          meta={
            leagueTable
              ? `Last synced ${relativeTime(leagueTable.fetchedAt)} · ${leagueTable.data.teams.length} teams · ${leagueTable.data.competition.name}`
              : "Never synced."
          }
        />

        <SyncCard
          title="Top scorers"
          description="NCEL golden boot standings. Requires the league table to be synced first (to get the competition ID)."
          intent="sync-top-scorers"
          disabled={!leagueTable}
          disabledReason="Sync the league table first."
          meta={
            topScorers
              ? `Last synced ${relativeTime(topScorers.fetchedAt)} · ${topScorers.data.scorers.length} players · ${topScorers.data.competition.name}`
              : "Never synced."
          }
        />
      </div>

      {/* What else FWP offers */}
      <div className="mt-10 border border-line p-6">
        <h2 className="text-[10px] uppercase tracking-[0.24em] text-mute mb-4">Other FWP endpoints available</h2>
        <div className="space-y-4 text-sm">
          <div>
            <div className="font-medium text-navy">Match detail (lineups &amp; goalscorers)</div>
            <div className="text-mute mt-0.5">
              Already in use — fetched on demand when you visit a completed fixture's page. Includes the full starting eleven, substitutes, and goal timeline for both sides.
              Live matches are also supported (status updates every time the page is loaded while in progress).
            </div>
          </div>
          <div>
            <div className="font-medium text-navy">Live match scores</div>
            <div className="text-mute mt-0.5">
              The same match detail endpoint returns live scores during a game. To surface this on the site (e.g. a score ticker on the home page) you'd need a polling mechanism — either a client-side interval or a short cron. The infrastructure is already there; it just needs wiring up.
            </div>
          </div>
          <div>
            <div className="font-medium text-navy">Squad / registered players</div>
            <div className="text-mute mt-0.5">
              FWP holds the official registered squad for DCFC. This could be used to cross-check your player list or auto-populate shirt numbers, but since you manage players manually here it's probably not worth the extra complexity.
            </div>
          </div>
          <div>
            <div className="font-medium text-navy">Competition &amp; season listings</div>
            <div className="text-mute mt-0.5">
              FWP exposes competition metadata (IDs, names, current season). Mostly useful for building the competition selector if you were supporting multiple leagues. For NCEL only, the ID is already captured in the league table snapshot.
            </div>
          </div>
          <div className="pt-3 border-t border-line">
            <div className="text-xs text-mute">
              FWP API key in use · Team ID 3314 ·{" "}
              <Link to="/admin/fixtures" className="underline">Fixtures admin</Link> also has a sync button
            </div>
          </div>
        </div>
      </div>
    </AdminPage>
  );
}
