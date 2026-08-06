import { eq } from "drizzle-orm";
import { data, redirect, useActionData, useLoaderData } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/admin-fixtures-edit";
import { db } from "~/db.server";
import { fixtures } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";
import { makeFixtureSlug } from "~/lib/fixture-slug";
import { AdminBreadcrumbs, AdminPage } from "~/components/admin/AdminShell";
import { FixtureForm } from "~/components/admin/FixtureForm";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `Edit fixture · ${data?.fixture.opponent ?? ""} · Admin` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);
  const [fixture] = await db
    .select()
    .from(fixtures)
    .where(eq(fixtures.id, params.id))
    .limit(1);
  if (!fixture) throw data("Not Found", { status: 404 });
  return { fixture };
}

const schema = z.object({
  competition: z.string().min(2).max(120),
  opponent: z.string().min(2).max(120),
  homeAway: z.enum(["home", "away"]),
  kickoff: z.string().refine((v) => !isNaN(new Date(v).getTime()), "Invalid date"),
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

export async function action({ request, params }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  if (form.get("intent") === "delete") {
    await db.delete(fixtures).where(eq(fixtures.id, params.id));
    throw redirect("/admin/fixtures");
  }
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
  await db
    .update(fixtures)
    .set({
      competition: parsed.data.competition,
      opponent: parsed.data.opponent,
      homeAway: parsed.data.homeAway,
      kickoff: kickoffDate,
      venue: parsed.data.venue ?? null,
      status: parsed.data.status,
      homeScore: Number.isFinite(homeScore) ? homeScore : null,
      awayScore: Number.isFinite(awayScore) ? awayScore : null,
      notes: parsed.data.notes ?? null,
      slug: makeFixtureSlug(parsed.data.opponent, kickoffDate),
    })
    .where(eq(fixtures.id, params.id));
  throw redirect("/admin/fixtures");
}

export default function AdminFixturesEdit() {
  const { fixture } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  return (
    <AdminPage
      eyebrow="Schedule"
      title={`vs ${fixture.opponent}`}
      description={fixture.competition}
    >
      <AdminBreadcrumbs
        items={[
          { label: "Fixtures", to: "/admin/fixtures" },
          { label: `vs ${fixture.opponent}` },
        ]}
      />
      <FixtureForm
        initial={{
          competition: fixture.competition,
          opponent: fixture.opponent,
          homeAway: fixture.homeAway,
          kickoff: fixture.kickoff,
          venue: fixture.venue,
          status: fixture.status,
          homeScore: fixture.homeScore,
          awayScore: fixture.awayScore,
          notes: fixture.notes,
        }}
        errors={result?.errors}
        submitLabel="Save changes"
      />
    </AdminPage>
  );
}
