import { eq } from "drizzle-orm";
import { data, Link } from "react-router";
import type { Route } from "./+types/fixture-detail";
import { db } from "~/db.server";
import { fixtures } from "../../db/schema";
import { Container } from "~/components/Container";
import {
  fetchAndCacheMatchDetail,
  type MatchDetail,
  type MatchGoal,
  type MatchLineupEntry,
} from "~/lib/fwp.server";

export function meta({ data }: Route.MetaArgs) {
  if (!data?.fixture) {
    return [{ title: "Match not found · Doncaster City FC" }];
  }
  const { fixture } = data;
  const us = fixture.homeAway === "home" ? fixture.homeScore : fixture.awayScore;
  const them =
    fixture.homeAway === "home" ? fixture.awayScore : fixture.homeScore;
  const score = us != null && them != null ? `${us}–${them} ` : "";
  const verb = fixture.homeAway === "home" ? "vs" : "at";
  return [
    {
      title: `Doncaster City ${score}${verb} ${fixture.opponent} · ${fixture.competition}`,
    },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const [fixture] = await db
    .select()
    .from(fixtures)
    .where(eq(fixtures.id, params.id))
    .limit(1);
  if (!fixture) throw data("Not Found", { status: 404 });

  let detail: MatchDetail | null = null;
  let detailError: string | null = null;
  if (
    fixture.source === "fwp" &&
    fixture.externalId &&
    fixture.status === "completed"
  ) {
    try {
      detail = await fetchAndCacheMatchDetail(fixture.externalId);
    } catch (err) {
      detailError = err instanceof Error ? err.message : String(err);
    }
  }

  const ourTeamId = Number(process.env.FWP_TEAM_ID) || 0;
  return { fixture, detail, detailError, ourTeamId };
}

function goalLabel(g: MatchGoal): string {
  const player =
    g.player && (g.player["first-name"] || g.player["last-name"])
      ? `${g.player["first-name"] ?? ""} ${g.player["last-name"] ?? ""}`.trim()
      : // Fallback: pull the name out of the description ("Mason Barlow (64' pen)")
        g.description.replace(/\s*\(.*$/, "").trim();
  return player || g.description;
}

export default function FixtureDetail({ loaderData }: Route.ComponentProps) {
  const { fixture, detail, detailError, ourTeamId } = loaderData;

  const homeName =
    detail?.["home-team"].name ??
    (fixture.homeAway === "home" ? "Doncaster City" : fixture.opponent);
  const awayName =
    detail?.["away-team"].name ??
    (fixture.homeAway === "away" ? "Doncaster City" : fixture.opponent);
  const homeScore = detail?.["home-team"].score ?? fixture.homeScore;
  const awayScore = detail?.["away-team"].score ?? fixture.awayScore;
  const homeHT = detail?.["home-team"]["half-time-score"];
  const awayHT = detail?.["away-team"]["half-time-score"];

  // Chronological goal timeline (home + away interleaved by minute)
  type TimelineEvent = MatchGoal & { side: "home" | "away" };
  const timeline: TimelineEvent[] = [];
  for (const g of detail?.["home-team"].goals ?? [])
    timeline.push({ ...g, side: "home" });
  for (const g of detail?.["away-team"].goals ?? [])
    timeline.push({ ...g, side: "away" });
  timeline.sort((a, b) => a.minute - b.minute);

  return (
    <>
      <section className="bg-paper-warm border-b border-line">
        <Container size="wide" className="py-12 md:py-16">
          <Link
            to="/fixtures"
            className="text-[10px] uppercase tracking-[0.28em] text-sky-deep hover:text-navy"
          >
            ← Fixtures &amp; results
          </Link>
          <div className="text-[11px] uppercase tracking-[0.28em] text-mute mt-5">
            {fixture.competition} ·{" "}
            {fixture.kickoff.toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>

          <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-10">
            <TeamHeading
              name={homeName}
              ours={detail?.["home-team"].id === ourTeamId || (!detail && fixture.homeAway === "home")}
              align="right"
            />
            <div className="text-center">
              {homeScore != null && awayScore != null ? (
                <>
                  <div className="scoreboard text-6xl md:text-8xl text-navy leading-none flex items-baseline justify-center gap-3">
                    <span>{homeScore}</span>
                    <span className="text-mute/40">·</span>
                    <span>{awayScore}</span>
                  </div>
                  {homeHT != null && awayHT != null && (
                    <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-mute">
                      HT {homeHT}–{awayHT}
                    </div>
                  )}
                </>
              ) : (
                <div className="scoreboard text-4xl md:text-5xl text-navy leading-none">
                  {fixture.kickoff.toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              )}
            </div>
            <TeamHeading
              name={awayName}
              ours={detail?.["away-team"].id === ourTeamId || (!detail && fixture.homeAway === "away")}
              align="left"
            />
          </div>

          <MatchMeta
            venue={detail?.venue ?? fixture.venue}
            referee={detail?.referee ?? null}
            attendance={detail?.attendance ?? null}
            status={detail?.status.full ?? null}
          />
        </Container>
      </section>

      <Container size="wide" className="py-16">
        {detailError && (
          <div className="mb-10 border border-line bg-paper-warm/50 p-4 text-sm text-mute">
            Live match detail unavailable: {detailError}
          </div>
        )}

        {timeline.length > 0 && (
          <section className="mb-16">
            <SectionHeading label="Goals" />
            <ol className="border-y border-line divide-y divide-line">
              {timeline.map((g, i) => (
                <GoalRow key={i} goal={g} />
              ))}
            </ol>
          </section>
        )}

        {detail && (
          <section>
            <SectionHeading label="Line-ups" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
              <LineupColumn
                team={homeName}
                ours={detail["home-team"].id === ourTeamId}
                lineup={detail["home-team"]["line-up"] ?? []}
              />
              <LineupColumn
                team={awayName}
                ours={detail["away-team"].id === ourTeamId}
                lineup={detail["away-team"]["line-up"] ?? []}
              />
            </div>
          </section>
        )}

        {!detail && !detailError && (
          <div className="border border-dashed border-line p-10 text-center">
            <div className="font-serif text-xl text-navy">
              Full match detail will appear here once available.
            </div>
            <p className="text-sm text-mute mt-2">
              {fixture.status === "completed"
                ? "Manually-entered fixture — no extended detail to pull."
                : "Kick-off hasn't happened yet."}
            </p>
          </div>
        )}
      </Container>
    </>
  );
}

function TeamHeading({
  name,
  ours,
  align,
}: {
  name: string;
  ours: boolean;
  align: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div className="font-serif text-2xl md:text-4xl text-navy leading-tight text-balance">
        {name}
      </div>
      {ours && (
        <div className="text-[10px] uppercase tracking-[0.22em] text-sky-deep mt-2">
          Doncaster City
        </div>
      )}
    </div>
  );
}

function MatchMeta({
  venue,
  referee,
  attendance,
  status,
}: {
  venue: string | null;
  referee: string | null;
  attendance: number | null;
  status: string | null;
}) {
  const items = [
    status && { label: "Status", value: status },
    venue && { label: "Venue", value: venue },
    referee && { label: "Referee", value: referee },
    attendance != null && {
      label: "Attendance",
      value: attendance.toLocaleString("en-GB"),
    },
  ].filter(Boolean) as Array<{ label: string; value: string }>;
  if (items.length === 0) return null;
  return (
    <dl className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 border-t border-line pt-6">
      {items.map((it) => (
        <div key={it.label}>
          <dt className="text-[10px] uppercase tracking-[0.22em] text-mute">
            {it.label}
          </dt>
          <dd className="mt-1 text-sm text-ink">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SectionHeading({ label }: { label: string }) {
  return (
    <h2 className="font-display text-2xl tracking-wider text-navy mb-6">
      {label.toUpperCase()}
    </h2>
  );
}

function GoalRow({ goal }: { goal: MatchGoal & { side: "home" | "away" } }) {
  const name = goalLabel(goal);
  return (
    <li className="py-3 grid grid-cols-[3rem_1fr_3rem] items-center gap-4">
      <div
        className={[
          "scoreboard text-lg",
          goal.side === "home" ? "text-navy text-right" : "text-mute/30 text-right",
        ].join(" ")}
      >
        {goal.side === "home" ? `${goal.minute}'` : ""}
      </div>
      <div className="text-center">
        <span className={goal.side === "home" ? "text-navy" : "text-ink"}>
          {name}
        </span>
        {goal.penalty && (
          <span className="ml-2 text-[10px] uppercase tracking-[0.22em] text-mute">
            pen
          </span>
        )}
      </div>
      <div
        className={[
          "scoreboard text-lg",
          goal.side === "away" ? "text-navy text-left" : "text-mute/30 text-left",
        ].join(" ")}
      >
        {goal.side === "away" ? `${goal.minute}'` : ""}
      </div>
    </li>
  );
}

function LineupColumn({
  team,
  ours,
  lineup,
}: {
  team: string;
  ours: boolean;
  lineup: MatchLineupEntry[];
}) {
  const sorted = [...lineup].sort((a, b) => a.sort - b.sort);
  // Convention: first 11 are starters, the rest are subs.
  const starters = sorted.slice(0, 11);
  const subs = sorted.slice(11);
  return (
    <div>
      <h3 className="font-serif text-xl text-navy mb-1">{team}</h3>
      {ours && (
        <div className="text-[10px] uppercase tracking-[0.22em] text-sky-deep mb-4">
          Doncaster City
        </div>
      )}
      {!ours && <div className="mb-4" />}
      {starters.length > 0 && (
        <ul className="border-y border-line divide-y divide-line">
          {starters.map((p, i) => (
            <LineupRow key={p.player.id ?? i} entry={p} />
          ))}
        </ul>
      )}
      {subs.length > 0 && (
        <>
          <div className="text-[10px] uppercase tracking-[0.22em] text-mute mt-6 mb-2">
            Substitutes
          </div>
          <ul className="border-y border-line divide-y divide-line">
            {subs.map((p, i) => (
              <LineupRow key={p.player.id ?? i} entry={p} />
            ))}
          </ul>
        </>
      )}
      {sorted.length === 0 && (
        <div className="text-sm text-mute">Line-up not available.</div>
      )}
    </div>
  );
}

function LineupRow({ entry }: { entry: MatchLineupEntry }) {
  const name = `${entry.player["first-name"] ?? ""} ${entry.player["last-name"] ?? ""}`.trim();
  return (
    <li className="py-2 flex items-baseline gap-4">
      <span className="scoreboard text-mute w-8 shrink-0 text-right">
        {entry.shirt ?? "—"}
      </span>
      <span className="text-ink">{name || "Unknown"}</span>
    </li>
  );
}
