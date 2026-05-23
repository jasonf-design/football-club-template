import { asc, eq } from "drizzle-orm";
import { Form, Link } from "react-router";
import type { Route } from "./+types/admin-fixtures";
import { db } from "~/db.server";
import { fixtures } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";
import { FwpError, syncDcfcFixtures, type SyncResult } from "~/lib/fwp.server";
import {
  AdminPage,
  DangerButton,
  LinkButton,
  SecondaryButton,
  StatusPill,
  Table,
  Td,
  Th,
} from "~/components/admin/AdminShell";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Fixtures · Admin" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const all = await db.select().from(fixtures).orderBy(asc(fixtures.kickoff));
  return { fixtures: all };
}

type ActionResult =
  | { ok: true }
  | { ok: false }
  | { sync: SyncResult }
  | { syncError: string };

export async function action({ request }: Route.ActionArgs): Promise<ActionResult> {
  await requireAdmin(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "sync-fwp") {
    try {
      const sync = await syncDcfcFixtures();
      return { sync };
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

  if (intent === "delete") {
    const id = form.get("id");
    if (typeof id !== "string") return { ok: false };
    await db.delete(fixtures).where(eq(fixtures.id, id));
    return { ok: true };
  }

  return { ok: false };
}

const STATUS_PILL: Record<
  string,
  { status: "ok" | "pending" | "draft" | "muted" | "warn"; label: string }
> = {
  scheduled: { status: "pending", label: "Scheduled" },
  in_progress: { status: "warn", label: "Live" },
  completed: { status: "ok", label: "Completed" },
  postponed: { status: "muted", label: "Postponed" },
  cancelled: { status: "muted", label: "Cancelled" },
};

export default function AdminFixturesList({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { fixtures } = loaderData;
  const sync = actionData && "sync" in actionData ? actionData.sync : null;
  const syncError =
    actionData && "syncError" in actionData ? actionData.syncError : null;
  return (
    <AdminPage
      eyebrow="Schedule"
      title="Fixtures & results"
      description="Manually manage every match. Drafts and live updates show on the public site immediately."
      actions={
        <>
          <Form method="post">
            <input type="hidden" name="intent" value="sync-fwp" />
            <SecondaryButton type="submit">Sync from FWP</SecondaryButton>
          </Form>
          <LinkButton to="/admin/fixtures/new">+ Add fixture</LinkButton>
        </>
      }
    >
      {sync && (
        <div className="mb-6 border border-line bg-paper-warm/50 p-4 text-sm text-navy">
          <div className="font-semibold mb-1">Sync complete</div>
          <div className="text-mute">
            Fetched {sync.fetched} · created {sync.created} · updated{" "}
            {sync.updated} · unchanged {sync.unchanged}
            {sync.skipped.length > 0 && ` · skipped ${sync.skipped.length}`}
          </div>
        </div>
      )}
      {syncError && (
        <div className="mb-6 border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <div className="font-semibold mb-1">Sync failed</div>
          <div>{syncError}</div>
        </div>
      )}
      {fixtures.length === 0 ? (
        <div className="bg-paper border border-line p-12 text-center">
          <div className="font-serif text-2xl text-navy">
            No fixtures yet.
          </div>
          <p className="mt-2 text-mute text-sm">
            Add the first one and it shows up on the public fixtures page
            right away.
          </p>
          <div className="mt-5">
            <LinkButton to="/admin/fixtures/new">Add a fixture</LinkButton>
          </div>
        </div>
      ) : (
        <Table
          head={
            <>
              <Th>Date</Th>
              <Th className="w-full">Opponent</Th>
              <Th>Comp.</Th>
              <Th>Status</Th>
              <Th>Score</Th>
              <Th className="text-right">Actions</Th>
            </>
          }
        >
          {fixtures.map((f) => (
            <tr key={f.id} className="hover:bg-paper-warm/40">
              <Td className="text-mute text-xs whitespace-nowrap">
                {f.kickoff.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                <div className="text-[10px] text-mute/70">
                  {f.kickoff.toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </Td>
              <Td>
                <Link
                  to={`/admin/fixtures/${f.id}/edit`}
                  className="font-medium text-navy hover:text-sky-bright"
                >
                  <span className="text-mute mr-1.5">
                    {f.homeAway === "home" ? "vs" : "at"}
                  </span>
                  {f.opponent}
                </Link>
                {f.venue && (
                  <div className="text-xs text-mute mt-0.5">{f.venue}</div>
                )}
              </Td>
              <Td className="text-xs text-mute">{f.competition}</Td>
              <Td>
                {STATUS_PILL[f.status] && (
                  <StatusPill {...STATUS_PILL[f.status]} />
                )}
              </Td>
              <Td className="scoreboard text-lg text-navy">
                {f.homeScore != null && f.awayScore != null
                  ? `${f.homeScore} · ${f.awayScore}`
                  : "—"}
              </Td>
              <Td>
                <div className="flex justify-end gap-3 items-center">
                  <Link
                    to={`/admin/fixtures/${f.id}/edit`}
                    className="text-xs uppercase tracking-[0.18em] text-navy hover:text-sky-bright"
                  >
                    Edit
                  </Link>
                  <Form method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={f.id} />
                    <DangerButton
                      type="submit"
                      onClick={(e) => {
                        if (
                          !confirm(`Delete fixture vs ${f.opponent}?`)
                        ) {
                          e.preventDefault();
                        }
                      }}
                    >
                      Delete
                    </DangerButton>
                  </Form>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </AdminPage>
  );
}
