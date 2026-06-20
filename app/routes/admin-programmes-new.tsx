import { asc, desc, eq } from "drizzle-orm";
import { Form, redirect } from "react-router";
import type { Route } from "./+types/admin-programmes-new";
import { db } from "~/db.server";
import { fixtures, programmes } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";
import { AdminBreadcrumbs, AdminPage, PrimaryButton } from "~/components/admin/AdminShell";

export function meta(_: Route.MetaArgs) {
  return [{ title: "New Programme · Admin" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const upcomingFixtures = await db
    .select({ id: fixtures.id, opponent: fixtures.opponent, homeAway: fixtures.homeAway, kickoff: fixtures.kickoff, competition: fixtures.competition })
    .from(fixtures)
    .orderBy(desc(fixtures.kickoff))
    .limit(30);
  return { fixtures: upcomingFixtures };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  const fixtureId = form.get("fixtureId");

  const [prog] = await db
    .insert(programmes)
    .values({ fixtureId: typeof fixtureId === "string" && fixtureId ? fixtureId : null })
    .returning({ id: programmes.id });

  throw redirect(`/admin/programmes/${prog.id}/edit`);
}

export default function AdminProgrammesNew({ loaderData }: Route.ComponentProps) {
  const { fixtures: fixtureList } = loaderData;
  return (
    <AdminPage eyebrow="Programmes" title="New programme">
      <AdminBreadcrumbs items={[{ label: "Programmes", to: "/admin/programmes" }, { label: "New" }]} />
      <Form method="post" className="max-w-lg mt-6 space-y-6">
        <div>
          <label className="block text-[10px] uppercase tracking-[0.24em] text-mute mb-2">
            Link to fixture
          </label>
          <select
            name="fixtureId"
            className="w-full bg-paper border border-line focus:border-navy focus:ring-0 outline-none px-4 py-3 text-base text-ink"
          >
            <option value="">— No fixture linked —</option>
            {fixtureList.map((f) => {
              const date = new Date(f.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
              return (
                <option key={f.id} value={f.id}>
                  {date} · {f.opponent} ({f.homeAway === "home" ? "H" : "A"}) · {f.competition}
                </option>
              );
            })}
          </select>
          <p className="mt-1.5 text-xs text-mute">The fixture determines when the programme becomes free (48 h after kickoff).</p>
        </div>
        <PrimaryButton type="submit">Create programme →</PrimaryButton>
      </Form>
    </AdminPage>
  );
}
