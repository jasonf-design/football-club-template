import { and, desc, eq, isNotNull } from "drizzle-orm";
import type { Route } from "./+types/api-social-result";
import { db } from "~/db.server";
import { fixtures } from "../../db/schema";
import { buildResultSvg, renderToPng } from "~/lib/social-image.server";
import { readMatchDetail, type MatchDetail } from "~/lib/fwp.server";
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
      .where(and(eq(fixtures.status, "completed"), isNotNull(fixtures.homeScore)))
      .orderBy(desc(fixtures.kickoff))
      .limit(1);
  }

  if (!fixture) {
    return new Response("No completed fixture found", { status: 404 });
  }
  if (fixture.homeScore == null || fixture.awayScore == null) {
    return new Response("Fixture has no score recorded", { status: 422 });
  }

  const isHome      = fixture.homeAway === "home";
  const dcfcScore   = isHome ? fixture.homeScore : fixture.awayScore;
  const opponentScore = isHome ? fixture.awayScore : fixture.homeScore;

  // Pull scorers from cached FWP match detail when available
  let scorers: string[] = [];
  if (fixture.externalId) {
    try {
      const snapshot = await readMatchDetail(fixture.externalId);
      if (snapshot) {
        const md: MatchDetail = snapshot.data;
        const ourSide = isHome ? md["home-team"] : md["away-team"];
        scorers = (ourSide.goals ?? [])
          .filter((g) => !g.description?.toLowerCase().includes("own goal"))
          .sort((a, b) => a.minute - b.minute)
          .map((g) => {
            const initial = g.player?.["first-name"]?.[0] ?? "";
            const last    = g.player?.["last-name"] ?? "";
            const name    = [initial ? initial + "." : "", last].filter(Boolean).join(" ") || "Goal";
            const pen     = g.penalty ? " (pen)" : "";
            return `${name} ${g.minute}'${pen}`;
          });
      }
    } catch {
      // FWP detail not cached — render without scorers
    }
  }

  const sponsors = await getAllSponsorUris();

  const svg = buildResultSvg(
    {
      opponent:      fixture.opponent,
      competition:   fixture.competition,
      kickoff:       fixture.kickoff,
      homeAway:      fixture.homeAway,
      dcfcScore,
      opponentScore,
      scorers,
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
