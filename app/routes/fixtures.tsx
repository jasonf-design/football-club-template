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
      {leagueTable && (
        <div className="border-b border-line bg-paper-warm">
          <Container size="wide" className="py-3">
            <a
              href="#table"
              className="inline-flex items-center gap-3 text-lg font-bold text-navy hover:text-sky-deep transition-colors"
            >
              <span>↓ Click here for the League Table</span>
            </a>
          </Container>
        </div>
      )}
      <Container size="wide" className="py-16 grid grid-cols-1 lg:grid-cols-2 gap-16">
        <section id="upcoming">
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
        <section id="results">
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
                  slug={r.slug}
                  opponent={r.opponent}
                  homeAway={r.homeAway}
                  homeScore={r.homeScore}
                  awayScore={r.awayScore}
                  competition={r.competition}
                  date={r.kickoff}
                  youtubeUrl={r.youtubeUrl}
                />
              ))}
            </div>
          )}
        </section>
      </Container>
      {leagueTable && (
        <section id="table">
          <Container size="wide" className="pb-20">
            <SectionHeading label={leagueTable.competition.name} />
            <LeagueTableView table={leagueTable} ourTeamId={ourTeamId} />
          </Container>
        </section>
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

function teamLogoSrc(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
  return `/League%20Table%20Logos/${slug}-logo.jpg`;
}

function LeagueTableView({
  table,
  ourTeamId,
}: {
  table: LeagueTable;
  ourTeamId: number;
}) {
  return (
    <div className="overflow-x-auto border border-line bg-paper">
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.18em] text-mute border-b border-line">
            <th className="px-3 py-2 text-left w-8 bg-paper-warm" rowSpan={2}>#</th>
            <th className="px-2 py-2 text-left w-6 bg-paper-warm" rowSpan={2} />
            <th className="px-3 py-2 text-left bg-paper-warm" rowSpan={2}>Team</th>
            <th className="px-2 py-1.5 text-center border-l border-line bg-paper-warm" colSpan={4}>Home</th>
            <th className="px-2 py-1.5 text-center border-l border-line bg-paper-warm" colSpan={4}>Away</th>
            <th className="px-2 py-1.5 text-center border-l border-line bg-paper-warm" colSpan={4}>Total</th>
            <th className="px-2 py-1.5 text-center border-l border-line w-10 bg-paper-warm" rowSpan={2}>GD</th>
            <th className="px-3 py-1.5 text-center border-l border-line w-10 bg-paper-warm" rowSpan={2}>Pts</th>
          </tr>
          <tr className="text-[10px] uppercase tracking-[0.18em] text-mute border-b border-line">
            {["P","W","D","L","P","W","D","L","P","W","D","L"].map((label, i) => (
              <th
                key={i}
                className={[
                  "px-2 py-1.5 text-center w-8 bg-paper-warm",
                  i % 4 === 0 ? "border-l border-line" : "",
                ].join(" ")}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.teams.map((t) => {
            const us = t.id === ourTeamId;
            const h = t["home-matches"];
            const a = t["away-matches"];
            const all = t["all-matches"];
            const gd = all["goal-difference"];
            return (
              <tr
                key={t.id}
                className={[
                  "border-t border-line",
                  us ? "bg-sky/10 font-semibold text-navy" : "text-ink",
                ].join(" ")}
              >
                <td className="px-3 py-2 text-mute scoreboard">{t.position}</td>
                <td className="px-2 py-1.5">
                  <img
                    src={teamLogoSrc(t.name)}
                    alt=""
                    aria-hidden="true"
                    className="h-5 w-5 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
                  />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{t.name}</td>
                {/* Home */}
                <td className="px-2 py-2 text-center tabular-nums border-l border-line text-mute">{h?.played ?? "–"}</td>
                <td className="px-2 py-2 text-center tabular-nums text-mute">{h?.won ?? "–"}</td>
                <td className="px-2 py-2 text-center tabular-nums text-mute">{h?.drawn ?? "–"}</td>
                <td className="px-2 py-2 text-center tabular-nums text-mute">{h?.lost ?? "–"}</td>
                {/* Away */}
                <td className="px-2 py-2 text-center tabular-nums border-l border-line text-mute">{a?.played ?? "–"}</td>
                <td className="px-2 py-2 text-center tabular-nums text-mute">{a?.won ?? "–"}</td>
                <td className="px-2 py-2 text-center tabular-nums text-mute">{a?.drawn ?? "–"}</td>
                <td className="px-2 py-2 text-center tabular-nums text-mute">{a?.lost ?? "–"}</td>
                {/* Total */}
                <td className="px-2 py-2 text-center tabular-nums border-l border-line text-mute">{all.played}</td>
                <td className="px-2 py-2 text-center tabular-nums text-mute">{all.won}</td>
                <td className="px-2 py-2 text-center tabular-nums text-mute">{all.drawn}</td>
                <td className="px-2 py-2 text-center tabular-nums text-mute">{all.lost}</td>
                {/* GD + Pts */}
                <td className="px-2 py-2 text-center tabular-nums border-l border-line text-mute">
                  {gd > 0 ? `+${gd}` : gd}
                </td>
                <td className="px-3 py-2 text-center scoreboard text-navy border-l border-line">
                  {t["total-points"]}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
    slug: string | null;
    competition: string;
    opponent: string;
    homeAway: "home" | "away";
    kickoff: Date;
    venue: string | null;
    youtubeUrl: string | null;
  };
}) {
  const k = fixture.kickoff;
  return (
    <li>
      <Link
        to={`/fixtures/${fixture.slug ?? fixture.id}`}
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
        <div className="flex items-center gap-3 shrink-0">
          {fixture.youtubeUrl && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] font-semibold bg-[#FF0000] text-white">
              ▶ Video
            </span>
          )}
          <div className="text-right">
            <div className="scoreboard text-xl text-navy">
              {k.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-sky-deep mt-1">
              {fixture.homeAway === "home" ? "Home" : "Away"}
            </div>
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
