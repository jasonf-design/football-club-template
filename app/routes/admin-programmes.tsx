import { asc, desc, eq, gte, and, not, like } from "drizzle-orm";
import { Form, Link } from "react-router";
import type { Route } from "./+types/admin-programmes";
import { db } from "~/db.server";
import { fixtures, media, programmes } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";
import {
  AdminPage,
  DangerButton,
  LinkButton,
  StatusPill,
  Table,
  Td,
  Th,
} from "~/components/admin/AdminShell";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Programmes · Admin" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);

  const upcomingHomeFixtures = await db
    .select({ id: fixtures.id, opponent: fixtures.opponent, kickoff: fixtures.kickoff, competition: fixtures.competition })
    .from(fixtures)
    .where(and(eq(fixtures.homeAway, "home"), gte(fixtures.kickoff, new Date()), not(like(fixtures.competition, "%riendly%"))))
    .orderBy(asc(fixtures.kickoff));

  const rows = await db
    .select({
      id: programmes.id,
      status: programmes.status,
      managersNotes: programmes.managersNotes,
      oppositionProfile: programmes.oppositionProfile,
      featuredPlayerId: programmes.featuredPlayerId,
      coverImageMediaId: programmes.coverImageMediaId,
      fixtureId: programmes.fixtureId,
      fixtureOpponent: fixtures.opponent,
      fixtureHomeAway: fixtures.homeAway,
      fixtureKickoff: fixtures.kickoff,
      fixtureCompetition: fixtures.competition,
      coverImageFilename: media.filename,
      updatedAt: programmes.updatedAt,
    })
    .from(programmes)
    .leftJoin(fixtures, eq(fixtures.id, programmes.fixtureId))
    .leftJoin(media, eq(media.id, programmes.coverImageMediaId))
    .orderBy(desc(programmes.createdAt));

  // Map fixture id → programme for quick lookup
  const progByFixture = new Map(rows.filter((r) => r.fixtureId).map((r) => [r.fixtureId!, r]));

  const schedule = upcomingHomeFixtures.map((f) => ({
    fixture: f,
    programme: progByFixture.get(f.id) ?? null,
  }));

  return { programmes: rows, schedule };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  const id = form.get("id");
  if (typeof id !== "string") return { ok: false };
  if (form.get("intent") === "delete") {
    await db.delete(programmes).where(eq(programmes.id, id));
  }
  return { ok: true };
}

function checklist(p: { managersNotes: string | null; oppositionProfile: string | null; featuredPlayerId: string | null; coverImageMediaId: string | null }) {
  const items = [
    { label: "Cover image", done: !!p.coverImageMediaId },
    { label: "Manager's notes", done: !!(p.managersNotes?.trim()) },
    { label: "Featured player", done: !!p.featuredPlayerId },
    { label: "Opposition profile", done: !!(p.oppositionProfile?.trim()) },
  ];
  return { items, done: items.filter((i) => i.done).length, total: items.length };
}

function daysUntil(isoDate: Date | string) {
  return Math.ceil((new Date(isoDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function AdminProgrammesList({ loaderData }: Route.ComponentProps) {
  const { programmes: rows, schedule } = loaderData;
  return (
    <AdminPage
      eyebrow="Content"
      title="Programmes"
      description="Match-day digital programmes. Create one per home fixture, complete the checklist, then publish."
      actions={<LinkButton to="/admin/programmes/new">+ New programme</LinkButton>}
    >
      {/* ── Prep schedule ── */}
      {schedule.length > 0 && (
        <div className="mb-8">
          <div className="text-[10px] uppercase tracking-[0.24em] text-mute mb-3">Upcoming home fixtures</div>
          <div className="space-y-2">
            {schedule.map(({ fixture, programme: prog }) => {
              const days = daysUntil(fixture.kickoff);
              const kickoffDate = new Date(fixture.kickoff).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
              const kickoffTime = new Date(fixture.kickoff).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
              const urgency = days <= 3 ? "red" : days <= 10 ? "amber" : "green";
              const urgencyClass = urgency === "red" ? "bg-red-50 border-red-200" : urgency === "amber" ? "bg-amber-50 border-amber-200" : "bg-paper border-line";
              const dotClass = urgency === "red" ? "bg-red-500" : urgency === "amber" ? "bg-amber-400" : "bg-emerald-400";
              const { items, done, total } = prog ? checklist(prog) : { items: [
                { label: "Cover image", done: false },
                { label: "Manager's notes", done: false },
                { label: "Featured player", done: false },
                { label: "Opposition profile", done: false },
              ], done: 0, total: 4 };
              return (
                <div key={fixture.id} className={`border rounded px-4 py-3 flex items-center gap-4 ${urgencyClass}`}>
                  <div className={`shrink-0 w-2 h-2 rounded-full ${dotClass}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-navy text-sm">DCFC vs {fixture.opponent}</div>
                    <div className="text-xs text-mute mt-0.5">{kickoffDate} · {kickoffTime} · {fixture.competition}</div>
                    {prog && (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                        {items.map((item) => (
                          <span key={item.label} className={`text-[10px] ${item.done ? "text-emerald-600" : urgency === "red" ? "text-red-600 font-semibold" : "text-amber-700"}`}>
                            {item.done ? "✓" : "✗"} {item.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                    <span className={`text-xs font-semibold tabular-nums ${urgency === "red" ? "text-red-600" : urgency === "amber" ? "text-amber-700" : "text-mute"}`}>
                      {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`}
                    </span>
                    {prog ? (
                      <Link to={`/admin/programmes/${prog.id}/edit`} className="text-[11px] uppercase tracking-[0.18em] text-navy border border-navy px-2.5 py-1 hover:bg-navy hover:text-white transition-colors">
                        {done === total ? "Review" : "Complete"}
                      </Link>
                    ) : (
                      <Form method="post" action="/admin/programmes/new">
                        <input type="hidden" name="fixtureId" value={fixture.id} />
                        <button type="submit" className="text-[11px] uppercase tracking-[0.18em] bg-navy text-white px-2.5 py-1 hover:bg-navy/80 transition-colors">
                          Create
                        </button>
                      </Form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="h-px bg-line mt-6 mb-2" />
        </div>
      )}
      {rows.length === 0 ? (
        <div className="bg-paper border border-line p-12 text-center">
          <div className="font-serif text-2xl text-navy">No programmes yet.</div>
          <p className="mt-2 text-mute text-sm">Create your first match-day programme.</p>
          <div className="mt-5">
            <LinkButton to="/admin/programmes/new">Create programme</LinkButton>
          </div>
        </div>
      ) : (
        <Table
          head={
            <>
              <Th className="w-full">Match</Th>
              <Th>Progress</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </>
          }
        >
          {rows.map((p) => {
            const { done, total } = checklist(p);
            const kickoff = p.fixtureKickoff
              ? new Date(p.fixtureKickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
              : null;
            return (
              <tr key={p.id} className="hover:bg-paper-warm/40">
                <Td>
                  <Link to={`/admin/programmes/${p.id}/edit`} className="font-medium text-navy hover:text-sky-bright">
                    {p.fixtureOpponent
                      ? `DCFC vs ${p.fixtureOpponent} (${p.fixtureHomeAway === "home" ? "H" : "A"})`
                      : "Untitled programme"}
                  </Link>
                  {kickoff && <div className="text-xs text-mute mt-0.5">{kickoff} · {p.fixtureCompetition}</div>}
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 bg-line rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-deep rounded-full"
                        style={{ width: `${(done / total) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-mute tabular-nums">{done}/{total}</span>
                  </div>
                </Td>
                <Td>
                  {p.status === "published"
                    ? <StatusPill status="ok" label="Published" />
                    : <StatusPill status="muted" label="Draft" />}
                </Td>
                <Td>
                  <div className="flex justify-end gap-3 items-center">
                    <Link to={`/admin/programmes/${p.id}/edit`} className="text-xs uppercase tracking-[0.18em] text-navy hover:text-sky-bright">
                      Edit
                    </Link>
                    <Form method="post">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={p.id} />
                      <DangerButton
                        type="submit"
                        onClick={(e) => { if (!confirm("Delete this programme?")) e.preventDefault(); }}
                      >
                        Delete
                      </DangerButton>
                    </Form>
                  </div>
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
    </AdminPage>
  );
}
