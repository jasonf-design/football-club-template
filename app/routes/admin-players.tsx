import { asc, eq } from "drizzle-orm";
import { Form, Link } from "react-router";
import type { Route } from "./+types/admin-players";
import { db } from "~/db.server";
import { media, players } from "../../db/schema";
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

export function meta(_: Route.MetaArgs) {
  return [{ title: "Squad · Admin" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const rows = await db
    .select({
      id: players.id,
      name: players.name,
      position: players.position,
      shirtNumber: players.shirtNumber,
      sortOrder: players.sortOrder,
      active: players.active,
      photoFilename: media.filename,
    })
    .from(players)
    .leftJoin(media, eq(media.id, players.photoMediaId))
    .orderBy(asc(players.sortOrder), asc(players.name));
  return { players: rows };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  const id = form.get("id");
  if (typeof id !== "string") return { ok: false };
  if (form.get("intent") === "delete") {
    await db.delete(players).where(eq(players.id, id));
  }
  return { ok: true };
}

export default function AdminPlayersList({
  loaderData,
}: Route.ComponentProps) {
  const { players } = loaderData;
  return (
    <AdminPage
      eyebrow="Squad"
      title="First team"
      description="The roster shown on the public Team page. Sort order controls how players appear."
      actions={<LinkButton to="/admin/players/new">+ Add player</LinkButton>}
    >
      {players.length === 0 ? (
        <div className="bg-paper border border-line p-12 text-center">
          <div className="font-serif text-2xl text-navy">No players yet.</div>
          <p className="mt-2 text-mute text-sm">
            Add players to fill out the squad page.
          </p>
          <div className="mt-5">
            <LinkButton to="/admin/players/new">Add the first player</LinkButton>
          </div>
        </div>
      ) : (
        <Table
          head={
            <>
              <Th>#</Th>
              <Th className="w-full">Player</Th>
              <Th>Position</Th>
              <Th>Sort</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </>
          }
        >
          {players.map((p) => (
            <tr key={p.id} className="hover:bg-paper-warm/40">
              <Td>
                {p.shirtNumber != null ? (
                  <span className="scoreboard text-xl text-navy">
                    {p.shirtNumber}
                  </span>
                ) : (
                  <span className="text-mute">—</span>
                )}
              </Td>
              <Td>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-line shrink-0 overflow-hidden">
                    {p.photoFilename && (
                      <img
                        src={uploadUrlFor(p.photoFilename) ?? ""}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <Link
                    to={`/admin/players/${p.id}/edit`}
                    className="font-medium text-navy hover:text-sky-bright"
                  >
                    {p.name}
                  </Link>
                </div>
              </Td>
              <Td className="text-mute text-xs">{p.position ?? "—"}</Td>
              <Td className="text-mute text-xs">{p.sortOrder}</Td>
              <Td>
                {p.active ? (
                  <StatusPill status="ok" label="Active" />
                ) : (
                  <StatusPill status="muted" label="Hidden" />
                )}
              </Td>
              <Td>
                <div className="flex justify-end gap-3 items-center">
                  <Link
                    to={`/admin/players/${p.id}/edit`}
                    className="text-xs uppercase tracking-[0.18em] text-navy hover:text-sky-bright"
                  >
                    Edit
                  </Link>
                  <Form method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={p.id} />
                    <DangerButton
                      type="submit"
                      onClick={(e) => {
                        if (!confirm(`Delete ${p.name}?`)) {
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
