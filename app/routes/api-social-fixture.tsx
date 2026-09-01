import { and, asc, eq, gte } from "drizzle-orm";
import type { Route } from "./+types/api-social-fixture";
import { db } from "~/db.server";
import { fixtures } from "../../db/schema";
import { buildFixtureSvg, renderToPng } from "~/lib/social-image.server";
import { getAllSponsorUris } from "~/lib/social-sponsor.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url   = new URL(request.url);
  const id    = url.searchParams.get("id");
  const story = url.searchParams.get("format") === "story";
  const [w, h] = story ? [1080, 1920] : [1080, 1080];

  let fixture;
  if (id) {
    [fixture] = await db
      .select()
      .from(fixtures)
      .where(eq(fixtures.id, id))
      .limit(1);
  } else {
    [fixture] = await db
      .select()
      .from(fixtures)
      .where(and(eq(fixtures.status, "scheduled"), gte(fixtures.kickoff, new Date())))
      .orderBy(asc(fixtures.kickoff))
      .limit(1);
  }

  if (!fixture) {
    return new Response("No upcoming fixture found", { status: 404 });
  }

  const sponsors = await getAllSponsorUris();

  const svg = buildFixtureSvg(
    {
      opponent:    fixture.opponent,
      competition: fixture.competition,
      kickoff:     fixture.kickoff,
      homeAway:    fixture.homeAway,
      venue:       fixture.venue,
    },
    w,
    h,
    sponsors,
  );

  const png = await renderToPng(svg);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
