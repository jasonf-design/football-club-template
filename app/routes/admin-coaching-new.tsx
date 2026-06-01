import { redirect, useActionData, useLoaderData } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/admin-coaching-new";
import { db } from "~/db.server";
import { coachingStaff } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";
import { AdminBreadcrumbs, AdminPage } from "~/components/admin/AdminShell";
import { CoachingStaffForm } from "~/components/admin/CoachingStaffForm";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Add coaching staff · Admin" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const url = new URL(request.url);
  const team = (url.searchParams.get("team") ?? "first") as "first" | "u21" | "u18";
  return { team };
}

const schema = z.object({
  team: z.enum(["first", "u21", "u18"]),
  name: z.string().min(2).max(120),
  role: z.string().min(1).max(100),
  photoMediaId: z.string().max(64).optional(),
  sortOrder: z.string().optional(),
  active: z.string().optional(),
});

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
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
  await db.insert(coachingStaff).values({
    team: parsed.data.team,
    name: parsed.data.name,
    role: parsed.data.role,
    photoMediaId: parsed.data.photoMediaId || null,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    active: parsed.data.active === "on",
  });
  throw redirect(`/admin/coaching?team=${parsed.data.team}`);
}

const TEAM_LABEL = { first: "1st Team", u21: "Under 21s", u18: "Under 18s" };

export default function AdminCoachingNew() {
  const { team } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  return (
    <AdminPage eyebrow="Coaching Staff" title="Add staff member">
      <AdminBreadcrumbs
        items={[
          { label: TEAM_LABEL[team], to: `/admin/coaching?team=${team}` },
          { label: "New" },
        ]}
      />
      <CoachingStaffForm initial={{ team }} errors={result?.errors} submitLabel="Add staff member" />
    </AdminPage>
  );
}
