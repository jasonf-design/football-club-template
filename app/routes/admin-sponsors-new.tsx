import { redirect, useActionData } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/admin-sponsors-new";
import { db } from "~/db.server";
import { sponsors } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";
import { AdminBreadcrumbs, AdminPage } from "~/components/admin/AdminShell";
import { SponsorForm } from "~/components/admin/SponsorForm";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Add sponsor · Admin" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  return null;
}

const schema = z.object({
  name: z.string().min(2).max(160),
  url: z.string().url().optional().or(z.literal("")),
  tier: z.enum(["principal", "official", "partner"]),
  logoMediaId: z.string().max(64).optional(),
  sortOrder: z.string().optional(),
  active: z.string().optional(),
});

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  const parsed = schema.safeParse({
    name: form.get("name"),
    url: form.get("url") || undefined,
    tier: form.get("tier") ?? "partner",
    logoMediaId: form.get("logoMediaId") || undefined,
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
  const sortOrder = parsed.data.sortOrder ? Number(parsed.data.sortOrder) : 0;
  await db.insert(sponsors).values({
    name: parsed.data.name,
    url: parsed.data.url || null,
    tier: parsed.data.tier,
    logoMediaId: parsed.data.logoMediaId || null,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    active: parsed.data.active === "on",
  });
  throw redirect("/admin/sponsors");
}

export default function AdminSponsorsNew() {
  const data = useActionData<typeof action>();
  return (
    <AdminPage eyebrow="Partnerships" title="Add sponsor">
      <AdminBreadcrumbs
        items={[
          { label: "Sponsors", to: "/admin/sponsors" },
          { label: "New" },
        ]}
      />
      <SponsorForm errors={data?.errors} submitLabel="Add sponsor" />
    </AdminPage>
  );
}
