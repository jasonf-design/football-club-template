import { asc, eq } from "drizzle-orm";
import { Form, Link } from "react-router";
import type { Route } from "./+types/admin-sponsors";
import { db } from "~/db.server";
import { media, sponsors } from "../../db/schema";
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
  return [{ title: "Sponsors · Admin" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const rows = await db
    .select({
      id: sponsors.id,
      name: sponsors.name,
      url: sponsors.url,
      tier: sponsors.tier,
      active: sponsors.active,
      sortOrder: sponsors.sortOrder,
      logoFilename: media.filename,
    })
    .from(sponsors)
    .leftJoin(media, eq(media.id, sponsors.logoMediaId))
    .orderBy(asc(sponsors.sortOrder), asc(sponsors.name));
  return { sponsors: rows };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  const id = form.get("id");
  if (typeof id !== "string") return { ok: false };
  if (form.get("intent") === "delete") {
    await db.delete(sponsors).where(eq(sponsors.id, id));
  }
  return { ok: true };
}

const TIER_LABEL: Record<string, string> = {
  principal: "Principal",
  official: "Official",
  partner: "Partner",
};

export default function AdminSponsorsList({
  loaderData,
}: Route.ComponentProps) {
  const { sponsors } = loaderData;
  return (
    <AdminPage
      eyebrow="Partnerships"
      title="Sponsors"
      description="The roster of partners shown on the public sponsors page and homepage strip."
      actions={<LinkButton to="/admin/sponsors/new">+ Add sponsor</LinkButton>}
    >
      {sponsors.length === 0 ? (
        <div className="bg-paper border border-line p-12 text-center">
          <div className="font-serif text-2xl text-navy">No sponsors yet.</div>
          <p className="mt-2 text-mute text-sm">
            Add the first business backing the club.
          </p>
          <div className="mt-5">
            <LinkButton to="/admin/sponsors/new">Add a sponsor</LinkButton>
          </div>
        </div>
      ) : (
        <Table
          head={
            <>
              <Th className="w-full">Sponsor</Th>
              <Th>Tier</Th>
              <Th>Sort</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </>
          }
        >
          {sponsors.map((s) => (
            <tr key={s.id} className="hover:bg-paper-warm/40">
              <Td>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-16 bg-line shrink-0 overflow-hidden flex items-center justify-center">
                    {s.logoFilename && (
                      <img
                        src={uploadUrlFor(s.logoFilename) ?? ""}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    )}
                  </div>
                  <div>
                    <Link
                      to={`/admin/sponsors/${s.id}/edit`}
                      className="font-medium text-navy hover:text-sky-bright"
                    >
                      {s.name}
                    </Link>
                    {s.url && (
                      <div className="text-xs text-mute mt-0.5 truncate max-w-md">
                        {s.url}
                      </div>
                    )}
                  </div>
                </div>
              </Td>
              <Td className="text-xs text-mute">{TIER_LABEL[s.tier]}</Td>
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
                    to={`/admin/sponsors/${s.id}/edit`}
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
