import { Outlet, useLoaderData } from "react-router";
import { and, gt, eq } from "drizzle-orm";
import { SiteHeader } from "~/components/SiteHeader";
import { SiteFooter } from "~/components/SiteFooter";
import { db } from "~/db.server";
import { fixtures } from "../../db/schema";

export async function loader() {
  const now = new Date();
  const [next] = await db
    .select()
    .from(fixtures)
    .where(and(eq(fixtures.status, "scheduled"), gt(fixtures.kickoff, now)))
    .orderBy(fixtures.kickoff)
    .limit(1);

  return {
    nextFixture: next
      ? {
          opponent: next.opponent,
          homeAway: next.homeAway,
          kickoff: next.kickoff,
          competition: next.competition,
        }
      : null,
  };
}

export default function PublicLayout() {
  const { nextFixture } = useLoaderData<typeof loader>();
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader nextFixture={nextFixture} />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
