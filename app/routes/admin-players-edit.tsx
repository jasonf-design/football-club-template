import { eq } from "drizzle-orm";
import { data, redirect, useActionData, useLoaderData } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/admin-players-edit";
import { db } from "~/db.server";
import { media, players } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";
import { AdminBreadcrumbs, AdminPage } from "~/components/admin/AdminShell";
import { PlayerForm } from "~/components/admin/PlayerForm";
import { uploadUrlFor } from "~/lib/uploads";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `Edit · ${data?.player.name ?? "player"} · Admin` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);
  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.id, params.id))
    .limit(1);
  if (!player) throw data("Not Found", { status: 404 });
  let photoUrl: string | null = null;
  if (player.photoMediaId) {
    const [m] = await db
      .select({ filename: media.filename })
      .from(media)
      .where(eq(media.id, player.photoMediaId))
      .limit(1);
    photoUrl = uploadUrlFor(m?.filename);
  }
  return { player, photoUrl };
}

const schema = z.object({
  name: z.string().min(2).max(120),
  position: z.string().max(40).optional(),
  shirtNumber: z.string().optional(),
  bio: z.string().max(2000).optional(),
  photoMediaId: z.string().max(64).optional(),
  sortOrder: z.string().optional(),
  active: z.string().optional(),
});

export async function action({ request, params }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  if (form.get("intent") === "delete") {
    await db.delete(players).where(eq(players.id, params.id));
    throw redirect("/admin/players");
  }
  const parsed = schema.safeParse({
    name: form.get("name"),
    position: form.get("position") || undefined,
    shirtNumber: form.get("shirtNumber") || undefined,
    bio: form.get("bio") || undefined,
    photoMediaId: form.get("photoMediaId") || undefined,
    sortOrder: form.get("sortOrder") || undefined,
    active: form.get("active") || undefined,
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
    return { errors };
  }
  const shirtNumber = parsed.data.shirtNumber
    ? Number(parsed.data.shirtNumber)
    : null;
  const sortOrder = parsed.data.sortOrder ? Number(parsed.data.sortOrder) : 0;
  await db
    .update(players)
    .set({
      name: parsed.data.name,
      position: parsed.data.position ?? null,
      shirtNumber: Number.isFinite(shirtNumber) ? shirtNumber : null,
      bio: parsed.data.bio ?? null,
      photoMediaId: parsed.data.photoMediaId || null,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      active: parsed.data.active === "on",
    })
    .where(eq(players.id, params.id));
  throw redirect("/admin/players");
}

export default function AdminPlayersEdit() {
  const { player, photoUrl } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  return (
    <AdminPage eyebrow="Squad" title={player.name}>
      <AdminBreadcrumbs
        items={[
          { label: "Squad", to: "/admin/players" },
          { label: player.name },
        ]}
      />
      <PlayerForm
        initial={{
          name: player.name,
          position: player.position,
          shirtNumber: player.shirtNumber,
          bio: player.bio,
          photoMediaId: player.photoMediaId,
          photoUrl,
          sortOrder: player.sortOrder,
          active: player.active,
        }}
        errors={result?.errors}
        submitLabel="Save changes"
      />
    </AdminPage>
  );
}
