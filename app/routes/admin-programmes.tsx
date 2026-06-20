import { desc, eq } from "drizzle-orm";
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
  const rows = await db
    .select({
      id: programmes.id,
      status: programmes.status,
      managersNotes: programmes.managersNotes,
      oppositionProfile: programmes.oppositionProfile,
      featuredPlayerId: programmes.featuredPlayerId,
      coverImageMediaId: programmes.coverImageMediaId,
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
  return { programmes: rows };
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
  const done = [
    !!p.coverImageMediaId,
    !!(p.managersNotes?.trim()),
    !!p.featuredPlayerId,
    !!(p.oppositionProfile?.trim()),
  ].filter(Boolean).length;
  return { done, total: 4 };
}

export default function AdminProgrammesList({ loaderData }: Route.ComponentProps) {
  const { programmes: rows } = loaderData;
  return (
    <AdminPage
      eyebrow="Content"
      title="Programmes"
      description="Match-day digital programmes. Create one per home fixture, complete the checklist, then publish."
      actions={<LinkButton to="/admin/programmes/new">+ New programme</LinkButton>}
    >
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
