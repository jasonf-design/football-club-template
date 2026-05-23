import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { Link } from "react-router";
import type { Route } from "./+types/fixtures";
import { db } from "~/db.server";
import { fixtures } from "../../db/schema";
import { Container } from "~/components/Container";
import { PageHeader } from "~/components/PageHeader";
import { ResultCard } from "~/components/ResultCard";
import { readLeagueTable, type LeagueTable } from "~/lib/fwp.server";

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
  const ourTeamId = Number(process.env.FWP_TEAM_ID) || 0;
  const now = new Date();
  const [upcoming, recent, form, leagueTable] = await Promise.all([
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
    db
      .select({
        homeAway: fixtures.homeAway,
        homeScore: fixtures.homeScore,
        awayScore: fixtures.awayScore,
      })
      .from(fixtures)
      .where(and(lt(fixtures.kickoff, now), eq(fixtures.status, "completed")))
      .orderBy(desc(fixtures.kickoff))
      .limit(5),
    readLeagueTable(),
  ]);
  // Form is shown oldest → newest, left to right.
  const formStrip = form
    .map((f) => {
      const us = f.homeAway === "home" ? f.homeScore : f.awayScore;
      const them = f.homeAway === "home" ? f.awayScore : f.homeScore;
      if (us == null || them == null) return null;
      return us > them ? "W" : us < them ? "L" : "D";
    })
    .filter((v): v is "W" | "D" | "L" => v !== null)
    .reverse();
  return {
    upcoming,
    recent,
    formStrip,
    leagueTable: leagueTable?.data ?? null,
    ourTeamId,
  };
}

export default function Fixtures({ loaderData }: Route.ComponentProps) {
  const { upcoming, recent, formStrip, leagueTable, ourTeamId } = loaderData;
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
          {formStrip.length > 0 && <FormStrip results={formStrip} />}
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
                  id={r.id}
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
      {leagueTable && (
        <Container size="wide" className="pb-20">
          <SectionHeading label={leagueTable.competition.name} />
          <LeagueTableView table={leagueTable} ourTeamId={ourTeamId} />
        </Container>
      )}
    </>
  );
}

function FormStrip({ results }: { results: Array<"W" | "D" | "L"> }) {
  const cls: Record<"W" | "D" | "L", string> = {
    W: "bg-green text-paper",
    D: "bg-mute text-paper",
    L: "bg-red text-paper",
  };
  return (
    <div className="flex items-center gap-2 mb-6">
      <span className="text-[10px] uppercase tracking-[0.22em] text-mute mr-1">
        Form
      </span>
      {results.map((r, i) => (
        <span
          key={i}
          className={[
            "inline-flex items-center justify-center h-6 w-6 text-[11px] font-bold",
            cls[r],
          ].join(" ")}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

function LeagueTableView({
  table,
  ourTeamId,
}: {
  table: LeagueTable;
  ourTeamId: number;
}) {
  return (
    <>
      {/* Mobile: stacked card per team */}
      <ul className="sm:hidden border border-line bg-paper">
        {table.teams.map((t) => {
          const us = t.id === ourTeamId;
          const s = t["all-matches"];
          const status = t.outcome ?? t.zone;
          const gd = s["goal-difference"];
          return (
            <li
              key={t.id}
              className={[
                "border-t border-line first:border-t-0 px-3 py-3",
                us ? "bg-sky/10" : "",
              ].join(" ")}
            >
              <div className="flex items-baseline gap-3">
                <span className="scoreboard text-mute w-6 shrink-0">
                  {t.position}
                </span>
                <div
                  className={[
                    "min-w-0 flex-1 truncate",
                    us ? "font-semibold text-navy" : "text-ink",
                  ].join(" ")}
                >
                  {t.name}
                </div>
              </div>
              <div className="mt-1.5 ml-9 flex items-baseline justify-between gap-3">
                <span
                  className={[
                    "text-[10px] uppercase tracking-[0.18em] truncate",
                    !status && "invisible",
                    t.outcome ? "text-sky-deep" : "text-mute",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {status ?? "—"}
                </span>
                <div className="flex items-baseline gap-3 text-xs tabular-nums text-mute shrink-0">
                  <span>P{s.played}</span>
                  <span>W{s.won}</span>
                  <span>D{s.drawn}</span>
                  <span>L{s.lost}</span>
                  <span>{gd > 0 ? `+${gd}` : gd}</span>
                  <span className="scoreboard text-base text-navy ml-1">
                    {t["total-points"]}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Desktop: full 8-col table */}
      <div className="hidden sm:block border border-line bg-paper">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.18em] text-mute">
              {[
                { label: "#", cls: "px-3 py-3 text-left w-10" },
                { label: "Team", cls: "px-3 py-3 text-left" },
                { label: "P", cls: "px-2 py-3 text-right w-10" },
                { label: "W", cls: "px-2 py-3 text-right w-10" },
                { label: "D", cls: "px-2 py-3 text-right w-10" },
                { label: "L", cls: "px-2 py-3 text-right w-10" },
                { label: "GD", cls: "px-2 py-3 text-right w-12" },
                { label: "Pts", cls: "px-3 py-3 text-right w-12" },
              ].map((h) => (
                <th
                  key={h.label}
                  className={`sticky top-0 z-10 bg-paper-warm shadow-[inset_0_-1px_0_rgb(0_0_0/0.08)] ${h.cls}`}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.teams.map((t) => {
              const us = t.id === ourTeamId;
              const s = t["all-matches"];
              const status = t.outcome ?? t.zone;
              return (
                <tr
                  key={t.id}
                  className={[
                    "border-t border-line",
                    us ? "bg-sky/10 font-semibold text-navy" : "text-ink",
                  ].join(" ")}
                >
                  <td className="px-3 py-2.5 text-mute scoreboard">
                    {t.position}
                  </td>
                  <td className="px-3 py-2.5">
                    {t.name}
                    {status && (
                      <span
                        className={[
                          "ml-2 text-[10px] uppercase tracking-[0.18em]",
                          t.outcome ? "text-sky-deep" : "text-mute",
                        ].join(" ")}
                      >
                        {status}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {s.played}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{s.won}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {s.drawn}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {s.lost}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {s["goal-difference"] > 0
                      ? `+${s["goal-difference"]}`
                      : s["goal-difference"]}
                  </td>
                  <td className="px-3 py-2.5 text-right scoreboard text-navy">
                    {t["total-points"]}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
    id: string;
    competition: string;
    opponent: string;
    homeAway: "home" | "away";
    kickoff: Date;
    venue: string | null;
  };
}) {
  const k = fixture.kickoff;
  return (
    <li>
      <Link
        to={`/fixtures/${fixture.id}`}
        className="py-5 flex items-center gap-5 hover:bg-paper-warm/60 transition-colors -mx-3 px-3"
      >
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
      </Link>
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
