import { eq } from "drizzle-orm";
import { data, redirect, useActionData, useLoaderData } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/admin-coaching-edit";
import { db } from "~/db.server";
import { coachingStaff, media } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";
import { AdminBreadcrumbs, AdminPage } from "~/components/admin/AdminShell";
import { CoachingStaffForm } from "~/components/admin/CoachingStaffForm";
import { uploadUrlFor } from "~/lib/uploads";

export function meta({ data: d }: Route.MetaArgs) {
  return [{ title: `Edit · ${d?.member.name ?? "staff"} · Admin` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);
  const [member] = await db
    .select()
    .from(coachingStaff)
    .where(eq(coachingStaff.id, params.id))
    .limit(1);
  if (!member) throw data("Not Found", { status: 404 });

  const photoFilename = member.photoMediaId
    ? (await db.select({ filename: media.filename }).from(media).where(eq(media.id, member.photoMediaId)).limit(1))[0]?.filename ?? null
    : null;

  return { member, photoUrl: uploadUrlFor(photoFilename) };
}

const schema = z.object({
  team: z.enum(["first", "u21", "u18"]),
  name: z.string().min(2).max(120),
  role: z.string().min(1).max(100),
  photoMediaId: z.string().max(64).optional(),
  sortOrder: z.string().optional(),
  active: z.string().optional(),
});

export async function action({ request, params }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  if (form.get("intent") === "delete") {
    await db.delete(coachingStaff).where(eq(coachingStaff.id, params.id));
    throw redirect("/admin/coaching");
  }
  const parsed = schema.safeParse({
    team: form.get("team") ?? "first",
    name: form.get("name"),
    role: form.get("role"),
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
  const sortOrder = Number(parsed.data.sortOrder ?? "0");
  await db
    .update(coachingStaff)
    .set({
      team: parsed.data.team,
      name: parsed.data.name,
      role: parsed.data.role,
      photoMediaId: parsed.data.photoMediaId || null,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      active: parsed.data.active === "on",
    })
    .where(eq(coachingStaff.id, params.id));
  throw redirect(`/admin/coaching?team=${parsed.data.team}`);
}

const TEAM_LABEL = { first: "1st Team", u21: "Under 21s", u18: "Under 18s" };

export default function AdminCoachingEdit() {
  const { member, photoUrl } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  return (
    <AdminPage eyebrow="Coaching Staff" title={member.name}>
      <AdminBreadcrumbs
        items={[
          { label: TEAM_LABEL[member.team], to: `/admin/coaching?team=${member.team}` },
          { label: member.name },
        ]}
      />
      <CoachingStaffForm
        initial={{
          team: member.team,
          name: member.name,
          role: member.role,
          photoMediaId: member.photoMediaId,
          photoUrl,
          sortOrder: member.sortOrder,
          active: member.active,
        }}
        errors={result?.errors}
        submitLabel="Save changes"
      />
    </AdminPage>
  );
}
