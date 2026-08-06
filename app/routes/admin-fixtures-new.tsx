import { redirect, useActionData } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/admin-fixtures-new";
import { db } from "~/db.server";
import { fixtures } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";
import { makeFixtureSlug } from "~/lib/fixture-slug";
import { AdminBreadcrumbs, AdminPage } from "~/components/admin/AdminShell";
import { FixtureForm } from "~/components/admin/FixtureForm";

export function meta(_: Route.MetaArgs) {
  return [{ title: "New fixture · Admin" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  return null;
}

const schema = z.object({
  competition: z.string().min(2).max(120),
  opponent: z.string().min(2).max(120),
  homeAway: z.enum(["home", "away"]),
  kickoff: z
    .string()
    .min(1, "Pick a date and time")
    .refine((v) => !isNaN(new Date(v).getTime()), "Invalid date"),
  venue: z.string().max(160).optional(),
  status: z.enum([
    "scheduled",
    "in_progress",
    "completed",
    "postponed",
    "cancelled",
  ]),
  homeScore: z.string().optional(),
  awayScore: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  const parsed = schema.safeParse({
    competition: form.get("competition"),
    opponent: form.get("opponent"),
    homeAway: form.get("homeAway"),
    kickoff: form.get("kickoff"),
    venue: form.get("venue") || undefined,
    status: form.get("status") ?? "scheduled",
    homeScore: form.get("homeScore") ?? undefined,
    awayScore: form.get("awayScore") ?? undefined,
    notes: form.get("notes") || undefined,
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
    return { errors };
  }
  const homeScore = parsed.data.homeScore ? Number(parsed.data.homeScore) : null;
  const awayScore = parsed.data.awayScore ? Number(parsed.data.awayScore) : null;
  const kickoffDate = new Date(parsed.data.kickoff);
  await db.insert(fixtures).values({
    competition: parsed.data.competition,
    opponent: parsed.data.opponent,
    homeAway: parsed.data.homeAway,
    kickoff: kickoffDate,
    venue: parsed.data.venue ?? null,
    status: parsed.data.status,
    homeScore: Number.isFinite(homeScore) ? homeScore : null,
    awayScore: Number.isFinite(awayScore) ? awayScore : null,
    notes: parsed.data.notes ?? null,
    source: "manual",
    slug: makeFixtureSlug(parsed.data.opponent, kickoffDate),
  });
  throw redirect("/admin/fixtures");
}

export default function AdminFixturesNew() {
  const data = useActionData<typeof action>();
  return (
    <AdminPage eyebrow="Schedule" title="Add fixture">
      <AdminBreadcrumbs
        items={[
          { label: "Fixtures", to: "/admin/fixtures" },
          { label: "New" },
        ]}
      />
      <FixtureForm errors={data?.errors} submitLabel="Add fixture" />
    </AdminPage>
  );
}
