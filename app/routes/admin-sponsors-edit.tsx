import { eq } from "drizzle-orm";
import { data, redirect, useActionData, useLoaderData } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/admin-sponsors-edit";
import { db } from "~/db.server";
import { media, sponsors } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";
import { AdminBreadcrumbs, AdminPage } from "~/components/admin/AdminShell";
import { SponsorForm } from "~/components/admin/SponsorForm";
import { uploadUrlFor } from "~/lib/uploads";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `Edit · ${data?.sponsor.name ?? "sponsor"} · Admin` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);
  const [sponsor] = await db
    .select()
    .from(sponsors)
    .where(eq(sponsors.id, params.id))
    .limit(1);
  if (!sponsor) throw data("Not Found", { status: 404 });
  let logoUrl: string | null = null;
  if (sponsor.logoMediaId) {
    const [m] = await db
      .select({ filename: media.filename })
      .from(media)
      .where(eq(media.id, sponsor.logoMediaId))
      .limit(1);
    logoUrl = uploadUrlFor(m?.filename);
  }
  return { sponsor, logoUrl };
}

const schema = z.object({
  name: z.string().min(2).max(160),
  url: z.string().url().optional().or(z.literal("")),
  tier: z.enum(["principal", "official", "partner"]),
  logoMediaId: z.string().max(64).optional(),
  sortOrder: z.string().optional(),
  active: z.string().optional(),
});

export async function action({ request, params }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  if (form.get("intent") === "delete") {
    await db.delete(sponsors).where(eq(sponsors.id, params.id));
    throw redirect("/admin/sponsors");
  }
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
  await db
    .update(sponsors)
    .set({
      name: parsed.data.name,
      url: parsed.data.url || null,
      tier: parsed.data.tier,
      logoMediaId: parsed.data.logoMediaId || null,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      active: parsed.data.active === "on",
    })
    .where(eq(sponsors.id, params.id));
  throw redirect("/admin/sponsors");
}

export default function AdminSponsorsEdit() {
  const { sponsor, logoUrl } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  return (
    <AdminPage eyebrow="Partnerships" title={sponsor.name}>
      <AdminBreadcrumbs
        items={[
          { label: "Sponsors", to: "/admin/sponsors" },
          { label: sponsor.name },
        ]}
      />
      <SponsorForm
        initial={{
          name: sponsor.name,
          url: sponsor.url,
          tier: sponsor.tier,
          logoMediaId: sponsor.logoMediaId,
          logoUrl,
          active: sponsor.active,
          sortOrder: sponsor.sortOrder,
        }}
        errors={result?.errors}
        submitLabel="Save changes"
      />
    </AdminPage>
  );
}
