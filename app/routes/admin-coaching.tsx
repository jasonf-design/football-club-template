import { and, asc, eq } from "drizzle-orm";
import { Form, Link, redirect } from "react-router";
import type { Route } from "./+types/admin-coaching";
import { db } from "~/db.server";
import { coachingStaff, media } from "../../db/schema";
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
import { uploadUrlFor } from "~/lib/uploads";

const TEAM_META = {
  first: { label: "1st Team", title: "1st Team coaching staff" },
  u23:   { label: "Under 23s", title: "Under 23s coaching staff" },
  u18:   { label: "Under 18s", title: "Under 18s coaching staff" },
} as const;

export function meta(_: Route.MetaArgs) {
  return [{ title: "Coaching Staff · Admin" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const url = new URL(request.url);
  const rawTeam = url.searchParams.get("team");
  if (rawTeam === "u21") throw redirect("/admin/coaching?team=u23");
  const team = (rawTeam ?? "first") as "first" | "u23" | "u18";
  const rows = await db
    .select({
      id: coachingStaff.id,
      name: coachingStaff.name,
      role: coachingStaff.role,
      sortOrder: coachingStaff.sortOrder,
      active: coachingStaff.active,
      photoFilename: media.filename,
    })
    .from(coachingStaff)
    .leftJoin(media, eq(media.id, coachingStaff.photoMediaId))
    .where(eq(coachingStaff.team, team))
    .orderBy(asc(coachingStaff.sortOrder), asc(coachingStaff.name));
  return { staff: rows, team };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  const id = form.get("id");
  if (typeof id !== "string") return { ok: false };
  if (form.get("intent") === "delete") {
    await db.delete(coachingStaff).where(eq(coachingStaff.id, id));
  }
  return { ok: true };
}

export default function AdminCoaching({ loaderData }: Route.ComponentProps) {
  const { staff, team } = loaderData;
  const meta = TEAM_META[team];
  return (
    <AdminPage
      eyebrow="Coaching Staff"
      title={meta.title}
      actions={
        <LinkButton to={`/admin/coaching/new?team=${team}`}>+ Add staff member</LinkButton>
      }
    >
      {staff.length === 0 ? (
        <div className="bg-paper border border-line p-12 text-center">
          <div className="font-serif text-2xl text-navy">No coaching staff yet.</div>
          <p className="mt-2 text-mute text-sm">Add the {meta.label} coaching and management team.</p>
          <div className="mt-5">
            <LinkButton to={`/admin/coaching/new?team=${team}`}>Add the first member</LinkButton>
          </div>
        </div>
      ) : (
        <Table
          head={
            <>
              <Th className="w-full">Name</Th>
              <Th>Role</Th>
              <Th>Sort</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </>
          }
        >
          {staff.map((s) => (
            <tr key={s.id} className="hover:bg-paper-warm/40">
              <Td>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-navy/10 overflow-hidden shrink-0 flex items-center justify-center">
                    {s.photoFilename ? (
                      <img
                        src={uploadUrlFor(s.photoFilename) ?? ""}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-navy/40 text-xs font-semibold">
                        {s.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <Link
                    to={`/admin/coaching/${s.id}/edit`}
                    className="font-medium text-navy hover:text-sky-bright"
                  >
                    {s.name}
                  </Link>
                </div>
              </Td>
              <Td className="text-mute text-xs">{s.role}</Td>
              <Td className="text-mute text-xs">{s.sortOrder}</Td>
              <Td>
                {s.active ? (
                  <StatusPill status="ok" label="Active" />
                ) : (
                  <StatusPill status="muted" label="Hidden" />
                )}
              </Td>
              <Td>
                <div className="flex justify-end gap-3 items-center">
                  <Link
                    to={`/admin/coaching/${s.id}/edit`}
                    className="text-xs uppercase tracking-[0.18em] text-navy hover:text-sky-bright"
                  >
                    Edit
                  </Link>
                  <Form method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={s.id} />
                    <DangerButton
                      type="submit"
                      onClick={(e) => {
                        if (!confirm(`Delete ${s.name}?`)) e.preventDefault();
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
