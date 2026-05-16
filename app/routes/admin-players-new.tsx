import { redirect, useActionData } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/admin-players-new";
import { db } from "~/db.server";
import { players } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";
import { AdminBreadcrumbs, AdminPage } from "~/components/admin/AdminShell";
import { PlayerForm } from "~/components/admin/PlayerForm";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Add player · Admin" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  return null;
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

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
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
  await db.insert(players).values({
    name: parsed.data.name,
    position: parsed.data.position ?? null,
    shirtNumber: Number.isFinite(shirtNumber) ? shirtNumber : null,
    bio: parsed.data.bio ?? null,
    photoMediaId: parsed.data.photoMediaId || null,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    active: parsed.data.active === "on",
  });
  throw redirect("/admin/players");
}

export default function AdminPlayersNew() {
  const data = useActionData<typeof action>();
  return (
    <AdminPage eyebrow="Squad" title="Add player">
      <AdminBreadcrumbs
        items={[{ label: "Squad", to: "/admin/players" }, { label: "New" }]}
      />
      <PlayerForm errors={data?.errors} submitLabel="Add player" />
    </AdminPage>
  );
}
