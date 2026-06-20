import { desc, eq } from "drizzle-orm";
import { Link } from "react-router";
import type { Route } from "./+types/programmes";
import { db } from "~/db.server";
import { fixtures, media, programmes } from "../../db/schema";
import { Container } from "~/components/Container";
import { PageHeader } from "~/components/PageHeader";
import { variantUrl } from "~/lib/uploads";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Match Programmes · Doncaster City FC" },
    { name: "description", content: "Digital match-day programmes for every Doncaster City FC home fixture. Read online or download free 48 hours after each match." },
  ];
}

export async function loader() {
  const rows = await db
    .select({
      id: programmes.id,
      fixtureOpponent: fixtures.opponent,
      fixtureHomeAway: fixtures.homeAway,
      fixtureKickoff: fixtures.kickoff,
      fixtureCompetition: fixtures.competition,
      coverFilename: media.filename,
    })
    .from(programmes)
    .leftJoin(fixtures, eq(fixtures.id, programmes.fixtureId))
    .leftJoin(media, eq(media.id, programmes.coverImageMediaId))
    .where(eq(programmes.status, "published"))
    .orderBy(desc(fixtures.kickoff));
  return { programmes: rows };
}

export default function ProgrammesIndex({ loaderData }: Route.ComponentProps) {
  const { programmes: rows } = loaderData;
  const now = Date.now();

  return (
    <>
      <PageHeader
        eyebrow="The Danum Blues"
        title="Match programmes."
        lede="Digital match-day programmes for every home fixture. Free to read 48 hours after each game."
      />
      <Container size="wide" className="py-16">
        {rows.length === 0 ? (
          <div className="border border-line bg-paper-warm/40 p-16 text-center max-w-xl mx-auto">
            <div className="font-serif text-3xl text-navy">Coming soon.</div>
            <p className="mt-3 text-mute">Our first digital programme will appear here before the next home match.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {rows.map((p) => {
              const kickoff = p.fixtureKickoff ? new Date(p.fixtureKickoff) : null;
              const freeFrom = kickoff ? new Date(kickoff.getTime() + 48 * 60 * 60 * 1000) : null;
              const isFree = !freeFrom || now >= freeFrom.getTime();
              return (
                <Link key={p.id} to={`/programmes/${p.id}`} className="group block">
                  <div className="aspect-[3/4] bg-navy relative overflow-hidden">
                    {p.coverFilename ? (
                      <img
                        src={variantUrl(p.coverFilename, 400, "jpeg")}
                        alt={p.fixtureOpponent ?? "Programme"}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-80"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy-deep to-sky/20" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/40 to-transparent" />
                    {!isFree && (
                      <div className="absolute top-3 right-3 bg-sky-deep text-paper text-[9px] uppercase tracking-[0.18em] px-2 py-1 font-semibold">
                        Available soon
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <div className="text-[9px] uppercase tracking-[0.2em] text-sky mb-1">{p.fixtureCompetition}</div>
                      <div className="font-serif text-paper text-base leading-tight">
                        vs {p.fixtureOpponent}
                      </div>
                      {kickoff && (
                        <div className="text-[10px] text-paper/60 mt-1">
                          {kickoff.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Container>
    </>
  );
}
