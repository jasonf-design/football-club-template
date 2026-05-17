import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import type { Route } from "./+types/fixtures";
import { db } from "~/db.server";
import { fixtures } from "../../db/schema";
import { Container } from "~/components/Container";
import { PageHeader } from "~/components/PageHeader";
import { ResultCard } from "~/components/ResultCard";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Fixtures & Results · Doncaster City FC" },
    {
      name: "description",
      content:
        "Upcoming fixtures and recent results for Doncaster City Football Club.",
    },
  ];
}

export async function loader() {
  const now = new Date();
  const [upcoming, recent] = await Promise.all([
    db
      .select()
      .from(fixtures)
      .where(gte(fixtures.kickoff, now))
      .orderBy(asc(fixtures.kickoff)),
    db
      .select()
      .from(fixtures)
      .where(and(lt(fixtures.kickoff, now), eq(fixtures.status, "completed")))
      .orderBy(desc(fixtures.kickoff))
      .limit(20),
  ]);
  return { upcoming, recent };
}

export default function Fixtures({ loaderData }: Route.ComponentProps) {
  const { upcoming, recent } = loaderData;
  return (
    <>
      <PageHeader
        eyebrow="2025/26 Season"
        title="Fixtures & results."
        lede="Every match, every score, every step of the journey. Add it to your diary and we'll see you there."
      />
      <Container size="wide" className="py-16 grid grid-cols-1 lg:grid-cols-2 gap-16">
        <section>
          <SectionHeading label="Upcoming" />
          {upcoming.length === 0 ? (
            <EmptyState
              title="No matches scheduled."
              copy="Once fixtures are confirmed they'll appear here."
            />
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {upcoming.map((f) => (
                <UpcomingRow key={f.id} fixture={f} />
              ))}
            </ul>
          )}
        </section>
        <section>
          <SectionHeading label="Recent results" />
          {recent.length === 0 ? (
            <EmptyState
              title="No results yet."
              copy="The first whistle is yet to blow."
            />
          ) : (
            <div className="space-y-4">
              {recent.map((r) => (
                <ResultCard
                  key={r.id}
                  opponent={r.opponent}
                  homeAway={r.homeAway}
                  homeScore={r.homeScore}
                  awayScore={r.awayScore}
                  competition={r.competition}
                  date={r.kickoff}
                />
              ))}
            </div>
          )}
        </section>
      </Container>
    </>
  );
}

function SectionHeading({ label }: { label: string }) {
  return (
    <h2 className="font-display text-2xl tracking-wider text-navy mb-6">
      {label.toUpperCase()}
    </h2>
  );
}

function UpcomingRow({
  fixture,
}: {
  fixture: {
    competition: string;
    opponent: string;
    homeAway: "home" | "away";
    kickoff: Date;
    venue: string | null;
  };
}) {
  const k = fixture.kickoff;
  return (
    <li className="py-5 flex items-center gap-5">
      <div className="text-center w-14 shrink-0">
        <div className="scoreboard text-3xl leading-none text-navy">
          {k.toLocaleDateString("en-GB", { day: "2-digit" })}
        </div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-mute mt-1">
          {k.toLocaleDateString("en-GB", { month: "short" })}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-[0.22em] text-mute">
          {fixture.competition}
        </div>
        <div className="text-lg text-ink mt-0.5 truncate">
          <span className="text-mute mr-1.5">
            {fixture.homeAway === "home" ? "vs" : "at"}
          </span>
          {fixture.opponent}
        </div>
        {fixture.venue && (
          <div className="text-xs text-mute mt-0.5">{fixture.venue}</div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="scoreboard text-xl text-navy">
          {k.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-sky-deep mt-1">
          {fixture.homeAway === "home" ? "Home" : "Away"}
        </div>
      </div>
    </li>
  );
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="border border-dashed border-line p-10 text-center">
      <div className="font-serif text-xl text-navy">{title}</div>
      <p className="text-sm text-mute mt-2">{copy}</p>
    </div>
  );
}
