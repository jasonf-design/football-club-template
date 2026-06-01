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

  const getFilename = async (id: string | null) => id
    ? (await db.select({ filename: media.filename }).from(media).where(eq(media.id, id)).limit(1))[0]?.filename ?? null
    : null;

  const [photoFilename, sp1Filename, sp2Filename] = await Promise.all([
    getFilename(player.photoMediaId),
    getFilename(player.sponsor1LogoMediaId),
    getFilename(player.sponsor2LogoMediaId),
  ]);
  return {
    player,
    photoUrl: uploadUrlFor(photoFilename),
    sponsor1LogoUrl: uploadUrlFor(sp1Filename),
    sponsor2LogoUrl: uploadUrlFor(sp2Filename),
  };
}

const schema = z.object({
  name: z.string().min(2).max(120),
  position: z.string().max(40).optional(),
  position2: z.string().max(40).optional(),
  bio: z.string().max(2000).optional(),
  photoMediaId: z.string().max(64).optional(),
  sortOrder: z.string().optional(),
  active: z.string().optional(),
  sponsor1Name: z.string().max(120).optional(),
  sponsor1Url: z.string().max(500).optional(),
  sponsor1LogoMediaId: z.string().max(64).optional(),
  sponsor2Name: z.string().max(120).optional(),
  sponsor2Url: z.string().max(500).optional(),
  sponsor2LogoMediaId: z.string().max(64).optional(),
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
    position2: form.get("position2") || undefined,
    bio: form.get("bio") || undefined,
    photoMediaId: form.get("photoMediaId") || undefined,
    sortOrder: form.get("sortOrder") || undefined,
    active: form.get("active") || undefined,
    sponsor1Name: form.get("sponsor1Name") || undefined,
    sponsor1Url: form.get("sponsor1Url") || undefined,
    sponsor1LogoMediaId: form.get("sponsor1LogoMediaId") || undefined,
    sponsor2Name: form.get("sponsor2Name") || undefined,
    sponsor2Url: form.get("sponsor2Url") || undefined,
    sponsor2LogoMediaId: form.get("sponsor2LogoMediaId") || undefined,
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
    return { errors };
  }
  const sortOrder = parsed.data.sortOrder ? Number(parsed.data.sortOrder) : 0;
  await db
    .update(players)
    .set({
      name: parsed.data.name,
      position: parsed.data.position ?? null,
      position2: parsed.data.position2 ?? null,
      bio: parsed.data.bio ?? null,
      photoMediaId: parsed.data.photoMediaId || null,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      active: parsed.data.active === "on",
      sponsor1Name: parsed.data.sponsor1Name ?? null,
      sponsor1Url: parsed.data.sponsor1Url ?? null,
      sponsor1LogoMediaId: parsed.data.sponsor1LogoMediaId || null,
      sponsor2Name: parsed.data.sponsor2Name ?? null,
      sponsor2Url: parsed.data.sponsor2Url ?? null,
      sponsor2LogoMediaId: parsed.data.sponsor2LogoMediaId || null,
    })
    .where(eq(players.id, params.id));
  throw redirect("/admin/players");
}

export default function AdminPlayersEdit() {
  const { player, photoUrl, sponsor1LogoUrl, sponsor2LogoUrl } = useLoaderData<typeof loader>();
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
          position2: player.position2,
          bio: player.bio,
          photoMediaId: player.photoMediaId,
          photoUrl,
          sortOrder: player.sortOrder,
          active: player.active,
          sponsor1Name: player.sponsor1Name,
          sponsor1Url: player.sponsor1Url,
          sponsor1LogoMediaId: player.sponsor1LogoMediaId,
          sponsor1LogoUrl,
          sponsor2Name: player.sponsor2Name,
          sponsor2Url: player.sponsor2Url,
          sponsor2LogoMediaId: player.sponsor2LogoMediaId,
          sponsor2LogoUrl,
        }}
        errors={result?.errors}
        submitLabel="Save changes"
      />
    </AdminPage>
  );
}
