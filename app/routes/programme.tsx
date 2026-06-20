import { eq, asc, inArray } from "drizzle-orm";
import { Form, useActionData, useLoaderData } from "react-router";
import type { Route } from "./+types/programme";
import { db } from "~/db.server";
import { fixtures, media, players, programmeInterest, programmes, sponsors } from "../../db/schema";
import { Container } from "~/components/Container";
import { variantUrl } from "~/lib/uploads";
import { readLeagueTable } from "~/lib/fwp.server";
import { sendProgrammeInterestNotification } from "~/lib/email.server";
import { Crest } from "~/components/Crest";
import { pitchSponsors } from "~/lib/pitchSponsors";
import { z } from "zod";

export function meta({ data }: Route.MetaArgs) {
  if (!data) return [{ title: "Programme · Doncaster City FC" }];
  const { fixture } = data as Awaited<ReturnType<typeof loader>>;
  const title = fixture ? `vs ${fixture.opponent} — DCFC Match Programme` : "Match Programme";
  return [
    { title: `${title} · Doncaster City FC` },
    { name: "description", content: `Official Doncaster City FC digital match programme${fixture ? ` for the fixture against ${fixture.opponent}` : ""}.` },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const [prog] = await db.select().from(programmes).where(eq(programmes.id, params.id)).limit(1);
  if (!prog || prog.status !== "published") throw new Response("Not found", { status: 404 });

  const [fixture] = prog.fixtureId
    ? await db.select().from(fixtures).where(eq(fixtures.id, prog.fixtureId)).limit(1)
    : [null];

  const kickoff = fixture ? new Date(fixture.kickoff) : null;
  const freeFrom = kickoff ? new Date(kickoff.getTime() + 48 * 60 * 60 * 1000) : null;
  const isLocked = freeFrom ? Date.now() < freeFrom.getTime() : false;

  const [coverImage] = prog.coverImageMediaId
    ? await db.select({ filename: media.filename }).from(media).where(eq(media.id, prog.coverImageMediaId)).limit(1)
    : [null];

  // All active sponsors with logo filenames, split by tier
  const allSponsors = await db
    .select({ id: sponsors.id, name: sponsors.name, url: sponsors.url, tier: sponsors.tier, logoFilename: media.filename })
    .from(sponsors)
    .leftJoin(media, eq(media.id, sponsors.logoMediaId))
    .where(eq(sponsors.active, true))
    .orderBy(asc(sponsors.sortOrder), asc(sponsors.name));

  const platinumSponsors = allSponsors.filter((s) => s.tier === "principal");
  const goldSponsors = allSponsors.filter((s) => s.tier === "official");
  const silverSponsors = allSponsors.filter((s) => s.tier === "partner");

  const [coverSponsor] = prog.coverSponsorId
    ? allSponsors.filter((s) => s.id === prog.coverSponsorId)
    : platinumSponsors;

  const featuredSponsorId = prog.featuredSponsorId;
  const featuredSponsor = featuredSponsorId
    ? allSponsors.find((s) => s.id === featuredSponsorId)
    : goldSponsors[0] ?? allSponsors[0] ?? null;

  const [featuredPlayer] = prog.featuredPlayerId
    ? await db.select({
        id: players.id, name: players.name, position: players.position,
        position2: players.position2, bio: players.bio, shirtNumber: players.shirtNumber,
        photoFilename: media.filename,
      })
        .from(players).leftJoin(media, eq(media.id, players.photoMediaId))
        .where(eq(players.id, prog.featuredPlayerId)).limit(1)
    : [null];

  // All first-team players for team sheet + player sponsor grid
  const firstTeamPlayers = await db
    .select({
      id: players.id, name: players.name, position: players.position,
      shirtNumber: players.shirtNumber, photoFilename: media.filename,
      sponsor1Name: players.sponsor1Name, sponsor1Url: players.sponsor1Url,
      sponsor1LogoMediaId: players.sponsor1LogoMediaId,
    })
    .from(players)
    .leftJoin(media, eq(media.id, players.photoMediaId))
    .where(eq(players.active, true))
    .orderBy(asc(players.sortOrder), asc(players.name));

  // Fetch sponsor logo filenames for player sponsor badges
  const sponsorLogoIds = firstTeamPlayers
    .map((p) => p.sponsor1LogoMediaId).filter(Boolean) as string[];
  const sponsorLogoMap = new Map<string, string>();
  if (sponsorLogoIds.length) {
    const logos = await db.select({ id: media.id, filename: media.filename })
      .from(media).where(inArray(media.id, sponsorLogoIds));
    logos.forEach((l) => sponsorLogoMap.set(l.id, l.filename));
  }

  // Season fixtures
  const allFixtures = await db
    .select({ id: fixtures.id, opponent: fixtures.opponent, homeAway: fixtures.homeAway, kickoff: fixtures.kickoff, competition: fixtures.competition, status: fixtures.status, homeScore: fixtures.homeScore, awayScore: fixtures.awayScore })
    .from(fixtures).orderBy(asc(fixtures.kickoff));

  const leagueSnapshot = await readLeagueTable();

  return {
    prog, fixture, kickoff, freeFrom, isLocked, coverImage, coverSponsor: coverSponsor ?? null,
    featuredSponsor: featuredSponsor ?? null, featuredPlayer: featuredPlayer ?? null,
    platinumSponsors, goldSponsors, silverSponsors,
    firstTeamPlayers: firstTeamPlayers.map((p) => ({
      ...p,
      sponsor1LogoFilename: p.sponsor1LogoMediaId ? (sponsorLogoMap.get(p.sponsor1LogoMediaId) ?? null) : null,
    })),
    allFixtures, leagueSnapshot,
  };
}

const interestSchema = z.object({
  name: z.string().min(1, "Please enter your name."),
  email: z.string().email("Please enter a valid email address."),
});

export async function action({ request, params }: Route.ActionArgs) {
  const [prog] = await db.select({ id: programmes.id, fixtureId: programmes.fixtureId })
    .from(programmes).where(eq(programmes.id, params.id)).limit(1);
  if (!prog) throw new Response("Not found", { status: 404 });

  const form = await request.formData();
  const parsed = interestSchema.safeParse({ name: form.get("name"), email: form.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check your details." };

  const [fixture] = prog.fixtureId
    ? await db.select({ opponent: fixtures.opponent }).from(fixtures).where(eq(fixtures.id, prog.fixtureId)).limit(1)
    : [null];

  await db.insert(programmeInterest).values({ programmeId: prog.id, name: parsed.data.name, email: parsed.data.email });
  await sendProgrammeInterestNotification({ name: parsed.data.name, email: parsed.data.email, programmeTitle: fixture ? `DCFC vs ${fixture.opponent}` : "DCFC Programme" });
  return { ok: true as const };
}

// ── Shared helpers ────────────────────────────────────────────────────────────

type Sponsor = { id: string; name: string; url: string | null; logoFilename: string | null };

function SponsorLogo({ sponsor, className = "" }: { sponsor: Sponsor; className?: string }) {
  return sponsor.logoFilename
    ? <img src={variantUrl(sponsor.logoFilename, 400, "jpeg")} alt={sponsor.name} className={`object-contain ${className}`} />
    : <span className="font-semibold text-navy tracking-wide">{sponsor.name}</span>;
}

function FixtureRow({ f, isCurrent }: { f: { id: string; opponent: string; homeAway: "home" | "away"; kickoff: Date; status: string; homeScore: number | null; awayScore: number | null }; isCurrent?: boolean }) {
  const date = new Date(f.kickoff);
  const isCompleted = f.status === "completed";
  const homeScore = f.homeScore ?? 0;
  const awayScore = f.awayScore ?? 0;
  const result = isCompleted && f.homeScore !== null ? `${homeScore}–${awayScore}` : null;
  const win = result ? (f.homeAway === "home" ? homeScore > awayScore : awayScore < homeScore) : false;
  return (
    <tr className={["border-b border-line", isCurrent ? "bg-sky/5 font-semibold" : ""].join(" ")}>
      <td className="py-2 pr-3 text-xs text-mute whitespace-nowrap">{date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</td>
      <td className="py-2 pr-2">
        <span className={["text-[9px] font-bold px-1 py-0.5 mr-1.5 uppercase", f.homeAway === "home" ? "bg-navy text-paper" : "border border-line text-mute"].join(" ")}>
          {f.homeAway === "home" ? "H" : "A"}
        </span>
        <span className="text-sm text-ink">{f.opponent}</span>
      </td>
      <td className="py-2 text-right text-sm tabular-nums">
        {result ? <span className={win ? "text-green-700 font-semibold" : "text-red-600 font-semibold"}>{result}</span>
          : <span className="text-mute">{date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>}
      </td>
    </tr>
  );
}

// ── Section wrappers ──────────────────────────────────────────────────────────

function SectionLight({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`py-16 ${className}`}>{children}</section>;
}
function SectionDark({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`py-16 bg-navy ${className}`}>{children}</section>;
}
function SectionWarm({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`py-16 bg-paper-warm/40 ${className}`}>{children}</section>;
}

function SectionLabel({ eyebrow, title, light = false }: { eyebrow: string; title: string; light?: boolean }) {
  return (
    <div className="mb-8">
      <div className={`text-[10px] uppercase tracking-[0.28em] mb-2 ${light ? "text-sky" : "text-sky-deep"}`}>{eyebrow}</div>
      <h2 className={`font-serif text-3xl ${light ? "text-paper" : "text-navy"}`}>{title}</h2>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export default function ProgrammeViewer({ loaderData }: Route.ComponentProps) {
  const {
    prog, fixture, kickoff, freeFrom, isLocked, coverImage, coverSponsor,
    featuredSponsor, featuredPlayer, platinumSponsors, goldSponsors, silverSponsors,
    firstTeamPlayers, allFixtures, leagueSnapshot,
  } = loaderData;

  const actionData = useActionData<typeof action>();
  const interestSubmitted = actionData != null && "ok" in actionData;
  const interestError = actionData != null && "error" in actionData ? (actionData as { error: string }).error : null;

  const matchTitle = fixture ? `DCFC vs ${fixture.opponent}` : "Doncaster City FC";
  const matchDate = kickoff
    ? kickoff.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : null;

  // Parse opposition lineup
  const oppositionLines = (prog.oppositionLineup ?? "")
    .split("\n").map((l) => l.trim()).filter(Boolean);

  // ── Locked / interest capture ──────────────────────────────────────────────
  if (isLocked) {
    return (
      <div className="relative min-h-[60vh] bg-navy flex flex-col items-center justify-center text-center overflow-hidden">
        {coverImage && (
          <img src={variantUrl(coverImage.filename, 1200, "jpeg")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-navy/60 via-navy/80 to-navy" />
        <div className="relative z-10 px-6 py-16 max-w-xl mx-auto">
          <Crest className="h-16 w-16 text-paper mx-auto mb-6 opacity-80" />
          <div className="text-[10px] uppercase tracking-[0.3em] text-sky mb-3">{fixture?.competition}</div>
          <h1 className="font-serif text-4xl sm:text-5xl text-paper mb-2">{matchTitle}</h1>
          {matchDate && <div className="text-paper/60 text-sm mb-8">{matchDate}</div>}
          <div className="bg-paper/10 border border-paper/20 p-6 mb-6">
            <div className="font-serif text-xl text-paper mb-2">Programme available from</div>
            <div className="text-sky text-lg font-semibold">
              {freeFrom ? freeFrom.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) + " at " + freeFrom.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "48 hours after kick-off"}
            </div>
            <p className="text-paper/50 text-xs mt-2">Register your interest and we'll let you know when it goes free.</p>
          </div>
          {interestSubmitted ? (
            <div className="bg-sky/20 border border-sky/40 px-6 py-4 text-paper">
              <div className="font-serif text-lg">Thanks — we'll be in touch!</div>
              <p className="text-paper/70 text-sm mt-1">Free from {freeFrom?.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.</p>
            </div>
          ) : (
            <Form method="post" className="space-y-3">
              {interestError && <div className="text-red-300 text-sm">{interestError}</div>}
              <input type="text" name="name" required placeholder="Your name" className="w-full bg-paper/10 border border-paper/20 text-paper placeholder:text-paper/40 px-4 py-3 outline-none focus:border-sky" />
              <input type="email" name="email" required placeholder="Email address" className="w-full bg-paper/10 border border-paper/20 text-paper placeholder:text-paper/40 px-4 py-3 outline-none focus:border-sky" />
              <button type="submit" className="w-full bg-sky-deep text-paper py-3 font-semibold uppercase tracking-wide text-sm hover:bg-sky transition-colors">
                Register interest →
              </button>
            </Form>
          )}
        </div>
      </div>
    );
  }

  // ── Full programme ─────────────────────────────────────────────────────────
  return (
    <div className="bg-paper">

      {/* ── 1. COVER ── */}
      <div className="relative min-h-[80vh] bg-navy flex flex-col overflow-hidden">
        {coverImage && (
          <img src={variantUrl(coverImage.filename, 1200, "jpeg")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-navy/40 via-navy/60 to-navy" />
        <div className="relative z-10 flex flex-col flex-1 items-center justify-center text-center px-6 py-16">
          <Crest className="h-20 w-20 text-paper mb-6 opacity-90" />
          <div className="text-[10px] uppercase tracking-[0.3em] text-sky mb-3">{fixture?.competition ?? "Doncaster City FC"}</div>
          <h1 className="font-serif text-5xl sm:text-7xl text-paper leading-none mb-3">{matchTitle}</h1>
          {matchDate && <div className="text-paper/60 mb-1">{matchDate}</div>}
          {fixture && kickoff && (
            <div className="text-paper/50 text-sm">
              Kick-off: {kickoff.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · {fixture.venue ?? (fixture.homeAway === "home" ? "Marra Falcons Stadium" : "Away")}
            </div>
          )}
        </div>
        {coverSponsor && (
          <div className="relative z-10 border-t border-paper/10 px-6 py-4 flex items-center justify-center gap-3">
            <span className="text-[9px] uppercase tracking-[0.22em] text-paper/40">In association with</span>
            {coverSponsor.logoFilename
              ? <img src={variantUrl(coverSponsor.logoFilename, 240, "jpeg")} alt={coverSponsor.name} className="h-8 w-auto max-w-[100px] object-contain brightness-0 invert opacity-70" />
              : <span className="text-paper/60 text-sm font-semibold">{coverSponsor.name}</span>}
          </div>
        )}
      </div>

      {/* ── 2. MANAGER'S NOTES ── */}
      {prog.managersNotes && (
        <SectionLight>
          <Container size="narrow">
            <SectionLabel eyebrow="From the gaffer" title="Manager's notes." />
            <div className="space-y-4">
              {prog.managersNotes.split("\n\n").map((para, i) => (
                <p key={i} className="text-ink leading-relaxed">{para}</p>
              ))}
            </div>
            <div className="mt-8 pt-6 border-t border-line text-[10px] uppercase tracking-[0.22em] text-mute">
              Doncaster City FC Management
            </div>
          </Container>
        </SectionLight>
      )}

      {/* ── 3. PLATINUM / PRINCIPAL SPONSOR — FULL PAGE ── */}
      {platinumSponsors.map((s) => (
        <SectionDark key={s.id}>
          <Container size="wide">
            <div className="text-[10px] uppercase tracking-[0.28em] text-sky mb-2">Platinum partner</div>
            <div className="border border-paper/10 p-10 sm:p-16 flex flex-col items-center text-center gap-8">
              {s.logoFilename ? (
                <div className="bg-paper p-8 inline-flex items-center justify-center w-64 h-40">
                  <img src={variantUrl(s.logoFilename, 600, "jpeg")} alt={s.name} className="max-h-full max-w-full object-contain" />
                </div>
              ) : (
                <div className="font-serif text-5xl text-paper">{s.name}</div>
              )}
              <div>
                <h2 className="font-serif text-4xl text-paper mb-4">{s.name}</h2>
                <p className="text-paper/60 max-w-lg leading-relaxed">
                  Proud platinum partner of Doncaster City FC — supporting the club, the players, and the community.
                </p>
              </div>
              {s.url && (
                <a href={s.url} target="_blank" rel="noopener noreferrer"
                  className="inline-block bg-sky-deep text-paper px-8 py-3 font-semibold uppercase tracking-wide text-sm hover:bg-sky transition-colors">
                  Visit {s.name} ↗
                </a>
              )}
            </div>
          </Container>
        </SectionDark>
      ))}

      {/* ── 4. FIXTURES & RESULTS + LEAGUE TABLE ── */}
      <SectionWarm>
        <Container size="wide">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <SectionLabel eyebrow="2025/26 Season" title="Fixtures &amp; results." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-mute mb-3">Results</div>
                  <table className="w-full">
                    <tbody>
                      {allFixtures.filter((f) => f.status === "completed").slice(-8).reverse()
                        .map((f) => <FixtureRow key={f.id} f={{ ...f, kickoff: new Date(f.kickoff) }} isCurrent={f.id === fixture?.id} />)}
                    </tbody>
                  </table>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-mute mb-3">Upcoming</div>
                  <table className="w-full">
                    <tbody>
                      {allFixtures.filter((f) => f.status === "scheduled").slice(0, 8)
                        .map((f) => <FixtureRow key={f.id} f={{ ...f, kickoff: new Date(f.kickoff) }} isCurrent={f.id === fixture?.id} />)}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {leagueSnapshot && (
              <div>
                <SectionLabel eyebrow={leagueSnapshot.data.competition?.name} title="League table." />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-navy text-paper text-[10px] uppercase tracking-[0.16em]">
                        <th className="px-2 py-2 text-left w-8">Pos</th>
                        <th className="px-2 py-2 text-left">Club</th>
                        <th className="px-2 py-2 text-center w-8">P</th>
                        <th className="px-2 py-2 text-center w-8 hidden sm:table-cell">W</th>
                        <th className="px-2 py-2 text-center w-8 hidden sm:table-cell">D</th>
                        <th className="px-2 py-2 text-center w-8 hidden sm:table-cell">L</th>
                        <th className="px-2 py-2 text-center w-10 hidden sm:table-cell">GD</th>
                        <th className="px-2 py-2 text-center w-10">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leagueSnapshot.data.teams.map((team, i) => {
                        const isDcfc = team.name.toLowerCase().includes("doncaster city");
                        return (
                          <tr key={team.id} className={["border-b border-line text-xs", isDcfc ? "bg-sky/10 font-semibold" : i % 2 === 0 ? "bg-paper" : "bg-paper-warm/30"].join(" ")}>
                            <td className="px-2 py-2 text-mute tabular-nums">{team.position}</td>
                            <td className="px-2 py-2">
                              <span className={isDcfc ? "text-navy font-semibold" : "text-ink"}>{team.name}</span>
                              {isDcfc && <span className="ml-1 text-[8px] uppercase tracking-wide text-sky-deep bg-sky/20 px-1 py-0.5">Us</span>}
                            </td>
                            <td className="px-2 py-2 text-center tabular-nums text-mute">{team["all-matches"].played}</td>
                            <td className="px-2 py-2 text-center tabular-nums text-mute hidden sm:table-cell">{team["all-matches"].won}</td>
                            <td className="px-2 py-2 text-center tabular-nums text-mute hidden sm:table-cell">{team["all-matches"].drawn}</td>
                            <td className="px-2 py-2 text-center tabular-nums text-mute hidden sm:table-cell">{team["all-matches"].lost}</td>
                            <td className="px-2 py-2 text-center tabular-nums text-mute hidden sm:table-cell">
                              {team["all-matches"]["goal-difference"] > 0 ? "+" : ""}{team["all-matches"]["goal-difference"]}
                            </td>
                            <td className="px-2 py-2 text-center tabular-nums font-semibold text-navy">{team["total-points"]}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Container>
      </SectionWarm>

      {/* ── 5. GOLD / OFFICIAL SPONSORS — HALF PAGES ── */}
      {goldSponsors.length > 0 && (
        <SectionLight>
          <Container size="wide">
            <SectionLabel eyebrow="Gold partners" title="Our sponsors." />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {goldSponsors.map((s) => (
                <div key={s.id} className="border border-line p-8 flex flex-col items-center text-center gap-5 min-h-[260px] justify-center">
                  {s.logoFilename ? (
                    <div className="h-20 flex items-center">
                      <img src={variantUrl(s.logoFilename, 400, "jpeg")} alt={s.name} className="max-h-full max-w-[180px] object-contain" />
                    </div>
                  ) : (
                    <div className="font-serif text-2xl text-navy">{s.name}</div>
                  )}
                  {s.logoFilename && <div className="font-semibold text-navy">{s.name}</div>}
                  <div className="text-[9px] uppercase tracking-[0.2em] text-mute">Gold partner · Doncaster City FC</div>
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-sky-deep underline underline-offset-4 hover:text-navy">
                      {s.url.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </Container>
        </SectionLight>
      )}

      {/* ── 6. FEATURED PLAYER ── */}
      {featuredPlayer && (
        <SectionDark>
          <Container size="wide">
            <SectionLabel eyebrow="Player spotlight" title="In focus." light />
            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-10 items-start">
              <div className="aspect-[3/4] bg-navy-deep relative overflow-hidden">
                {featuredPlayer.photoFilename ? (
                  <img src={variantUrl(featuredPlayer.photoFilename, 600, "jpeg")} alt={featuredPlayer.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Crest className="h-24 w-24 text-paper/20" />
                  </div>
                )}
              </div>
              <div className="text-paper">
                {(featuredPlayer.position || featuredPlayer.position2) && (
                  <div className="text-[10px] uppercase tracking-[0.22em] text-sky mb-2">
                    {[featuredPlayer.position, featuredPlayer.position2].filter(Boolean).join(" · ")}
                  </div>
                )}
                {featuredPlayer.shirtNumber && (
                  <div className="font-serif text-8xl text-paper/10 leading-none -mt-4 mb-2 select-none">
                    {featuredPlayer.shirtNumber}
                  </div>
                )}
                <h3 className="font-serif text-4xl sm:text-5xl leading-none mb-6">{featuredPlayer.name}</h3>
                {featuredPlayer.bio && (
                  <div className="space-y-4">
                    {featuredPlayer.bio.split("\n\n").map((para, i) => (
                      <p key={i} className="text-paper/70 leading-relaxed">{para}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Container>
        </SectionDark>
      )}

      {/* ── 7. SILVER / PARTNER SPONSORS — QUARTER PAGES ── */}
      {silverSponsors.length > 0 && (
        <SectionLight>
          <Container size="wide">
            <SectionLabel eyebrow="Silver partners" title="Club partners." />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {silverSponsors.map((s) => (
                <div key={s.id} className="border border-line p-6 flex flex-col items-center text-center gap-4 min-h-[180px] justify-center">
                  {s.logoFilename ? (
                    <img src={variantUrl(s.logoFilename, 240, "jpeg")} alt={s.name} className="max-h-14 max-w-full object-contain" />
                  ) : (
                    <div className="font-semibold text-navy text-sm">{s.name}</div>
                  )}
                  {s.logoFilename && <div className="text-xs font-medium text-navy">{s.name}</div>}
                  <div className="text-[9px] uppercase tracking-[0.18em] text-mute">Silver partner</div>
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-sky-deep underline underline-offset-2 hover:text-navy truncate max-w-full">
                      {s.url.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </Container>
        </SectionLight>
      )}

      {/* ── 8. KNOW YOUR ENEMY ── */}
      {prog.oppositionProfile && (
        <SectionWarm>
          <Container size="narrow">
            <SectionLabel eyebrow="Today's opponents" title={`Know your enemy${fixture ? ` — ${fixture.opponent}` : ""}.`} />
            <div className="space-y-4">
              {prog.oppositionProfile.split("\n\n").map((para, i) => (
                <p key={i} className="text-ink leading-relaxed">{para}</p>
              ))}
            </div>
          </Container>
        </SectionWarm>
      )}

      {/* ── 9. SPONSOR THE PITCH ── */}
      <SectionDark>
        <Container size="wide">
          <SectionLabel eyebrow="Get involved" title="Sponsor a pitch square." light />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div>
              <p className="text-paper/70 leading-relaxed mb-6">
                Put your name — or your business — on the Marra Falcons Stadium pitch. Platinum, gold, and silver squares are available, placing your brand at the heart of every home match.
              </p>
              <a href="/pitch" className="inline-block bg-sky-deep text-paper px-6 py-3 font-semibold uppercase tracking-wide text-sm hover:bg-sky transition-colors">
                View available squares →
              </a>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-sky mb-4">Current pitch sponsors</div>
              <div className="space-y-2">
                {pitchSponsors.map((ps) => (
                  <div key={ps.id} className="flex items-center justify-between border border-paper/10 px-4 py-3">
                    <div>
                      <div className="text-paper text-sm font-medium">{ps.name}</div>
                      <div className="text-paper/40 text-[10px] uppercase tracking-wide mt-0.5">{ps.squares.length} square{ps.squares.length !== 1 ? "s" : ""}</div>
                    </div>
                    <div className={["text-[9px] uppercase tracking-wide px-2 py-1 font-semibold",
                      ps.tier === "platinum" ? "bg-yellow-500/20 text-yellow-300" :
                      ps.tier === "gold" ? "bg-amber-500/20 text-amber-300" :
                      "bg-paper/10 text-paper/60"].join(" ")}>
                      {ps.tier}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </SectionDark>

      {/* ── 10. PLAYER SPONSORS GRID ── */}
      <SectionLight>
        <Container size="wide">
          <SectionLabel eyebrow="Sponsor a player" title="Player sponsors." />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {firstTeamPlayers.map((p) => (
              <div key={p.id} className="border border-line overflow-hidden flex flex-col">
                <div className="aspect-[3/4] bg-navy/5 relative overflow-hidden">
                  {p.photoFilename ? (
                    <img src={variantUrl(p.photoFilename, 400, "jpeg")} alt={p.name}
                      loading="lazy" decoding="async"
                      className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-navy to-navy-deep flex items-center justify-center">
                      {p.shirtNumber && <span className="font-serif text-5xl text-paper/20">{p.shirtNumber}</span>}
                    </div>
                  )}
                  {p.shirtNumber && (
                    <div className="absolute top-2 left-2 bg-navy text-paper text-[10px] font-bold px-1.5 py-0.5 tabular-nums">
                      {p.shirtNumber}
                    </div>
                  )}
                </div>
                <div className="p-3 flex flex-col gap-2 flex-1">
                  <div>
                    <div className="font-serif text-sm text-navy leading-tight">{p.name}</div>
                    {p.position && <div className="text-[9px] uppercase tracking-[0.16em] text-mute mt-0.5">{p.position}</div>}
                  </div>
                  {p.sponsor1Name ? (
                    <div className="mt-auto">
                      <div className="text-[8px] uppercase tracking-[0.16em] text-mute mb-1">Sponsored by</div>
                      {p.sponsor1Url ? (
                        <a href={p.sponsor1Url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 border border-line bg-paper-warm/30 px-2 py-1 hover:border-sky-deep/40 hover:bg-sky/5 transition-colors">
                          {p.sponsor1LogoFilename && (
                            <img src={variantUrl(p.sponsor1LogoFilename, 120, "jpeg")} alt={p.sponsor1Name}
                              className="h-4 w-auto max-w-[32px] object-contain flex-shrink-0" />
                          )}
                          <span className="text-[9px] uppercase tracking-[0.12em] text-navy/70 font-semibold truncate">{p.sponsor1Name}</span>
                        </a>
                      ) : (
                        <div className="flex items-center gap-1.5 border border-line bg-paper-warm/30 px-2 py-1">
                          {p.sponsor1LogoFilename && (
                            <img src={variantUrl(p.sponsor1LogoFilename, 120, "jpeg")} alt={p.sponsor1Name}
                              className="h-4 w-auto max-w-[32px] object-contain flex-shrink-0" />
                          )}
                          <span className="text-[9px] uppercase tracking-[0.12em] text-navy/70 font-semibold truncate">{p.sponsor1Name}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <a href={`/sponsor/${p.id}`} className="mt-auto block text-[8px] uppercase tracking-[0.16em] text-sky-deep border border-dashed border-sky-deep/30 px-2 py-1.5 text-center hover:bg-sky/5 transition-colors">
                      Available to sponsor
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Container>
      </SectionLight>

      {/* ── 11. TEAM SHEET — BACK PAGE ── */}
      <SectionWarm>
        <Container size="wide">
          <SectionLabel eyebrow="Today's match" title="Team sheet." />
          <div className="grid grid-cols-2 gap-8 sm:gap-16">
            {/* DCFC */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Crest className="h-10 w-10 text-navy" />
                <div>
                  <div className="font-serif text-lg text-navy leading-tight">Doncaster City FC</div>
                  <div className="text-[9px] uppercase tracking-[0.2em] text-mute">Home</div>
                </div>
              </div>
              <table className="w-full">
                <tbody>
                  {firstTeamPlayers
                    .slice()
                    .sort((a, b) => (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99))
                    .map((p) => (
                      <tr key={p.id} className="border-b border-line">
                        <td className="py-2 pr-4 tabular-nums text-mute text-sm w-8">
                          {p.shirtNumber ?? "—"}
                        </td>
                        <td className="py-2 text-sm font-medium text-navy">{p.name}</td>
                        <td className="py-2 text-right text-[10px] uppercase tracking-wide text-mute hidden sm:table-cell">
                          {p.position ?? ""}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Opposition */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 border border-line flex items-center justify-center bg-paper flex-shrink-0">
                  <span className="text-[9px] uppercase tracking-wide text-mute">Crest</span>
                </div>
                <div>
                  <div className="font-serif text-lg text-navy leading-tight">{fixture?.opponent ?? "Opposition"}</div>
                  <div className="text-[9px] uppercase tracking-[0.2em] text-mute">Away</div>
                </div>
              </div>
              {oppositionLines.length > 0 ? (
                <table className="w-full">
                  <tbody>
                    {oppositionLines.map((line, i) => {
                      const match = line.match(/^(\d+)\s+(.+)$/);
                      return (
                        <tr key={i} className="border-b border-line">
                          <td className="py-2 pr-4 tabular-nums text-mute text-sm w-8">{match ? match[1] : i + 1}</td>
                          <td className="py-2 text-sm font-medium text-navy">{match ? match[2] : line}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="space-y-0">
                  {Array.from({ length: 16 }, (_, i) => (
                    <div key={i} className="flex items-center gap-4 border-b border-line py-2">
                      <span className="text-mute text-sm tabular-nums w-8">{i + 1}</span>
                      <div className="flex-1 h-px bg-line/60" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Container>
      </SectionWarm>

      {/* ── 12. SPONSOR SPOTLIGHT ── */}
      {featuredSponsor && (
        <SectionDark>
          <Container size="wide">
            <SectionLabel eyebrow="Proud partner" title="Sponsor spotlight." light />
            <div className="border border-paper/10 p-8 sm:p-12 flex flex-col sm:flex-row items-center gap-8">
              {featuredSponsor.logoFilename && (
                <div className="flex-shrink-0 bg-paper p-6 flex items-center justify-center w-48 h-32">
                  <img src={variantUrl(featuredSponsor.logoFilename, 400, "jpeg")} alt={featuredSponsor.name} className="max-h-full max-w-full object-contain" />
                </div>
              )}
              <div>
                <h3 className="font-serif text-2xl text-paper mb-3">{featuredSponsor.name}</h3>
                <p className="text-paper/60 leading-relaxed mb-4">Proud partner of Doncaster City FC, supporting the club and the community.</p>
                {featuredSponsor.url && (
                  <a href={featuredSponsor.url} target="_blank" rel="noopener noreferrer"
                    className="inline-block bg-sky-deep text-paper px-5 py-2.5 text-xs font-semibold uppercase tracking-wide hover:bg-sky transition-colors">
                    Visit {featuredSponsor.name} ↗
                  </a>
                )}
              </div>
            </div>
          </Container>
        </SectionDark>
      )}

      {/* ── Footer ── */}
      <div className="bg-paper border-t border-line py-8">
        <Container size="wide">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-mute">
            <div className="flex items-center gap-3">
              <Crest className="h-6 w-6 text-navy" />
              <span>Doncaster City FC — Official Digital Programme</span>
            </div>
            <span>doncastercity-fc.com</span>
          </div>
        </Container>
      </div>
    </div>
  );
}
