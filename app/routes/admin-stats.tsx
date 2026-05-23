import { Form } from "react-router";
import type { Route } from "./+types/admin-stats";
import { requireAdmin } from "~/lib/session.server";
import {
  FwpError,
  readLeagueTable,
  syncLeagueTable,
} from "~/lib/fwp.server";
import { AdminPage, SecondaryButton } from "~/components/admin/AdminShell";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Stats · Admin" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const leagueTable = await readLeagueTable();
  return { leagueTable };
}

type ActionResult =
  | { syncedKey: string; summary: string }
  | { syncError: string };

export async function action({ request }: Route.ActionArgs): Promise<ActionResult> {
  await requireAdmin(request);
  const form = await request.formData();
  const intent = form.get("intent");
  try {
    if (intent === "sync-league-table") {
      const { teams } = await syncLeagueTable();
      return {
        syncedKey: "league-table",
        summary: `${teams} teams stored.`,
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
  const ms = Date.now() - d.getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

export default function AdminStats({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { leagueTable } = loaderData;
  const ok = actionData && "syncedKey" in actionData ? actionData : null;
  const err = actionData && "syncError" in actionData ? actionData.syncError : null;
  return (
    <AdminPage
      eyebrow="Data"
      title="Stats sync"
      description="Pull data from the Football Web Pages API and store it locally. The public site reads from these snapshots — no API calls happen on page loads."
    >
      {ok && (
        <div className="mb-6 border border-line bg-paper-warm/50 p-4 text-sm text-navy">
          <div className="font-semibold mb-1">Synced “{ok.syncedKey}”</div>
          <div className="text-mute">{ok.summary}</div>
        </div>
      )}
      {err && (
        <div className="mb-6 border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <div className="font-semibold mb-1">Sync failed</div>
          <div>{err}</div>
        </div>
      )}

      <section className="border border-line bg-paper p-6 flex items-center justify-between gap-6">
        <div>
          <h2 className="font-serif text-2xl text-navy">League table</h2>
          <p className="text-sm text-mute mt-1">
            Final standings shown on /fixtures. Refresh once per matchday during
            the season; safe to leave untouched in the offseason.
          </p>
          <p className="text-xs text-mute mt-2">
            {leagueTable
              ? `Last synced ${relativeTime(leagueTable.fetchedAt)} · ${leagueTable.data.teams.length} teams`
              : "Never synced."}
          </p>
        </div>
        <Form method="post">
          <input type="hidden" name="intent" value="sync-league-table" />
          <SecondaryButton type="submit">Refresh</SecondaryButton>
        </Form>
      </section>
    </AdminPage>
  );
}
