import { eq, ne, and, asc, desc } from "drizzle-orm";
import { Form, useActionData, useLoaderData } from "react-router";
import type { Route } from "./+types/programme";
import { db } from "~/db.server";
import { fixtures, media, players, programmeInterest, programmes, sponsors } from "../../db/schema";
import { Container } from "~/components/Container";
import { variantUrl } from "~/lib/uploads";
import { readLeagueTable } from "~/lib/fwp.server";
import { sendProgrammeInterestNotification } from "~/lib/email.server";
import { Crest } from "~/components/Crest";
import { z } from "zod";

export function meta({ data }: Route.MetaArgs) {
  if (!data) return [{ title: "Programme · Doncaster City FC" }];
  const { prog, fixture } = data as Awaited<ReturnType<typeof loader>>;
  const title = fixture ? `vs ${fixture.opponent} — DCFC Match Programme` : "Match Programme · Doncaster City FC";
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

  const [coverSponsor] = prog.coverSponsorId
    ? await db.select({ id: sponsors.id, name: sponsors.name, url: sponsors.url, logoFilename: media.filename })
        .from(sponsors).leftJoin(media, eq(media.id, sponsors.logoMediaId))
        .where(eq(sponsors.id, prog.coverSponsorId)).limit(1)
    : [null];

  const [featuredSponsorRow] = prog.featuredSponsorId
    ? await db.select({ id: sponsors.id, name: sponsors.name, url: sponsors.url, logoFilename: media.filename })
        .from(sponsors).leftJoin(media, eq(media.id, sponsors.logoMediaId))
        .where(eq(sponsors.id, prog.featuredSponsorId)).limit(1)
    : [null];

  const [featuredPlayer] = prog.featuredPlayerId
    ? await db.select({
        id: players.id, name: players.name, position: players.position,
        position2: players.position2, bio: players.bio, photoFilename: media.filename,
      })
        .from(players).leftJoin(media, eq(media.id, players.photoMediaId))
        .where(eq(players.id, prog.featuredPlayerId)).limit(1)
    : [null];

  // All active sponsors for rotating ad strips
  const allActiveSponsors = await db
    .select({ id: sponsors.id, name: sponsors.name, url: sponsors.url, tier: sponsors.tier, logoFilename: media.filename })
    .from(sponsors)
    .leftJoin(media, eq(media.id, sponsors.logoMediaId))
    .where(eq(sponsors.active, true))
    .orderBy(asc(sponsors.sortOrder), asc(sponsors.name));

  // Season fixtures from DB
  const allFixtures = await db
    .select({ id: fixtures.id, opponent: fixtures.opponent, homeAway: fixtures.homeAway, kickoff: fixtures.kickoff, competition: fixtures.competition, status: fixtures.status, homeScore: fixtures.homeScore, awayScore: fixtures.awayScore })
    .from(fixtures)
    .orderBy(asc(fixtures.kickoff));

  const leagueSnapshot = await readLeagueTable();

  // Auto-pick featured sponsor if not set
  const featuredSponsor = featuredSponsorRow
    ?? allActiveSponsors.find((s) => s.id !== coverSponsor?.id)
    ?? null;

  // Mid-programme ad sponsors: exclude cover + featured
  const adSponsors = allActiveSponsors.filter(
    (s) => s.id !== coverSponsor?.id && s.id !== featuredSponsor?.id,
  );

  return { prog, fixture, kickoff, freeFrom, isLocked, coverImage, coverSponsor, featuredSponsor, featuredPlayer, allFixtures, leagueSnapshot, adSponsors };
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
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const [fixture] = prog.fixtureId
    ? await db.select({ opponent: fixtures.opponent, kickoff: fixtures.kickoff }).from(fixtures).where(eq(fixtures.id, prog.fixtureId)).limit(1)
    : [null];
  const title = fixture ? `DCFC vs ${fixture.opponent}` : "DCFC Programme";

  await db.insert(programmeInterest).values({ programmeId: prog.id, name: parsed.data.name, email: parsed.data.email });
  await sendProgrammeInterestNotification({ name: parsed.data.name, email: parsed.data.email, programmeTitle: title });

  return { ok: true as const };
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function SponsorStrip({ sponsors }: { sponsors: Array<{ id: string; name: string; url: string | null; logoFilename: string | null }> }) {
  if (!sponsors.length) return null;
  return (
    <div className="bg-paper-warm border-y border-line py-6">
      <Container size="wide">
        <div className="flex flex-wrap items-center justify-center gap-8">
          {sponsors.slice(0, 4).map((s) => {
            const inner = s.logoFilename
              ? <img src={variantUrl(s.logoFilename, 240, "jpeg")} alt={s.name} className="h-10 w-auto max-w-[120px] object-contain opacity-80 hover:opacity-100 transition-opacity" />
              : <span className="text-sm font-semibold text-mute uppercase tracking-wide">{s.name}</span>;
            return s.url
              ? <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer">{inner}</a>
              : <div key={s.id}>{inner}</div>;
          })}
        </div>
      </Container>
    </div>
  );
}

function FixtureRow({ f, isCurrent }: { f: { opponent: string; homeAway: "home" | "away"; kickoff: Date; competition: string; status: string; homeScore: number | null; awayScore: number | null }; isCurrent?: boolean }) {
  const date = new Date(f.kickoff);
  const isCompleted = f.status === "completed";
  const result = isCompleted && f.homeScore !== null && f.awayScore !== null
    ? `${f.homeScore}–${f.awayScore}`
    : null;
  const win = result && f.homeAway === "home" ? f.homeScore! > f.awayScore! : result ? f.awayScore! < f.homeScore! : false;

  return (
    <tr className={["border-b border-line", isCurrent ? "bg-navy/5" : ""].join(" ")}>
      <td className="py-2 pr-3 text-xs text-mute whitespace-nowrap">
        {date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
      </td>
      <td className="py-2 pr-3">
        <span className={["text-[9px] font-bold px-1.5 py-0.5 mr-2 uppercase tracking-wide", f.homeAway === "home" ? "bg-navy text-paper" : "border border-line text-mute"].join(" ")}>
          {f.homeAway === "home" ? "H" : "A"}
        </span>
        <span className={["text-sm", isCurrent ? "font-semibold text-navy" : "text-ink"].join(" ")}>{f.opponent}</span>
      </td>
      <td className="py-2 text-right">
        {result ? (
          <span className={["text-sm font-semibold tabular-nums", win ? "text-green-700" : "text-red-600"].join(" ")}>{result}</span>
        ) : (
          <span className="text-xs text-mute">{date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
        )}
      </td>
    </tr>
  );
}

export default function ProgrammeViewer({ loaderData }: Route.ComponentProps) {
  const { prog, fixture, kickoff, freeFrom, isLocked, coverImage, coverSponsor, featuredSponsor, featuredPlayer, allFixtures, leagueSnapshot, adSponsors } = loaderData;
  const actionData = useActionData<typeof action>();
  const interestSubmitted = actionData != null && "ok" in actionData;
  const interestError = actionData != null && "error" in actionData ? (actionData as { error: string }).error : null;

  const matchTitle = fixture ? `DCFC vs ${fixture.opponent}` : "Doncaster City FC";
  const matchDate = kickoff ? kickoff.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : null;

  // Split ad sponsors across 3 strips
  const adStrip1 = adSponsors.slice(0, 3);
  const adStrip2 = adSponsors.slice(3, 6);
  const adStrip3 = adSponsors.slice(6, 9);

  if (isLocked) {
    return (
      <>
        {/* Locked cover */}
        <div className="relative min-h-[60vh] bg-navy flex flex-col items-center justify-center text-center overflow-hidden">
          {coverImage && (
            <img
              src={variantUrl(coverImage.filename, 1200, "jpeg")}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-30"
            />
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
                <p className="text-paper/70 text-sm mt-1">The programme will be free to read after {freeFrom?.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.</p>
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
      </>
    );
  }

  // Full programme
  return (
    <div className="bg-paper">
      {/* ── 1. Cover ── */}
      <div className="relative min-h-[70vh] sm:min-h-[80vh] bg-navy flex flex-col overflow-hidden">
        {coverImage && (
          <img
            src={variantUrl(coverImage.filename, 1200, "jpeg")}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-navy/40 via-navy/60 to-navy" />

        <div className="relative z-10 flex flex-col flex-1 items-center justify-center text-center px-6 py-16">
          <Crest className="h-20 w-20 text-paper mb-6 opacity-90" />
          <div className="text-[10px] uppercase tracking-[0.3em] text-sky mb-3">{fixture?.competition ?? "Doncaster City FC"}</div>
          <h1 className="font-serif text-5xl sm:text-7xl text-paper leading-none mb-3">{matchTitle}</h1>
          {matchDate && <div className="text-paper/60 mb-1">{matchDate}</div>}
          {fixture && (
            <div className="text-paper/50 text-sm">
              Kick-off: {kickoff!.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · {fixture.venue ?? (fixture.homeAway === "home" ? "Marra Falcons Stadium" : "Away")}
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

      {/* ── 2. Manager's notes ── */}
      {prog.managersNotes && (
        <section className="py-16">
          <Container size="narrow">
            <div className="text-[10px] uppercase tracking-[0.28em] text-sky-deep mb-2">From the gaffer</div>
            <h2 className="font-serif text-3xl text-navy mb-8">Manager's notes.</h2>
            <div className="prose prose-navy max-w-none">
              {prog.managersNotes.split("\n\n").map((para, i) => (
                <p key={i} className="text-ink leading-relaxed mb-4">{para}</p>
              ))}
            </div>
            <div className="mt-8 pt-6 border-t border-line">
              <div className="text-[10px] uppercase tracking-[0.22em] text-mute">Doncaster City FC Management</div>
            </div>
          </Container>
        </section>
      )}

      {/* ── 3. Sponsor strip ── */}
      <SponsorStrip sponsors={adStrip1} />

      {/* ── 4. Season fixtures & results ── */}
      <section className="py-16 bg-paper-warm/30">
        <Container size="wide">
          <div className="text-[10px] uppercase tracking-[0.28em] text-sky-deep mb-2">2025/26 Season</div>
          <h2 className="font-serif text-3xl text-navy mb-8">Fixtures &amp; results.</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-mute mb-3">Results</div>
              <table className="w-full">
                <tbody>
                  {allFixtures
                    .filter((f) => f.status === "completed")
                    .slice(-10)
                    .reverse()
                    .map((f) => (
                      <FixtureRow key={f.id} f={{ ...f, kickoff: new Date(f.kickoff) }} isCurrent={f.id === fixture?.id} />
                    ))}
                </tbody>
              </table>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-mute mb-3">Upcoming</div>
              <table className="w-full">
                <tbody>
                  {allFixtures
                    .filter((f) => f.status === "scheduled")
                    .slice(0, 10)
                    .map((f) => (
                      <FixtureRow key={f.id} f={{ ...f, kickoff: new Date(f.kickoff) }} isCurrent={f.id === fixture?.id} />
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </Container>
      </section>

      {/* ── 5. League table ── */}
      {leagueSnapshot && (
        <section className="py-16">
          <Container size="wide">
            <div className="text-[10px] uppercase tracking-[0.28em] text-sky-deep mb-2">{leagueSnapshot.data.competition?.name}</div>
            <h2 className="font-serif text-3xl text-navy mb-8">League table.</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-navy text-paper text-[10px] uppercase tracking-[0.16em]">
                    <th className="px-3 py-3 text-left font-medium w-8">Pos</th>
                    <th className="px-3 py-3 text-left font-medium">Club</th>
                    <th className="px-3 py-3 text-center font-medium w-10">P</th>
                    <th className="px-3 py-3 text-center font-medium w-10">W</th>
                    <th className="px-3 py-3 text-center font-medium w-10">D</th>
                    <th className="px-3 py-3 text-center font-medium w-10">L</th>
                    <th className="px-3 py-3 text-center font-medium w-12 hidden sm:table-cell">GD</th>
                    <th className="px-3 py-3 text-center font-medium w-12">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {leagueSnapshot.data.teams.map((team, i) => {
                    const isDcfc = team.name.toLowerCase().includes("doncaster city");
                    return (
                      <tr key={team.id} className={["border-b border-line", isDcfc ? "bg-sky/10 font-semibold" : i % 2 === 0 ? "bg-paper" : "bg-paper-warm/30"].join(" ")}>
                        <td className="px-3 py-2.5 text-mute tabular-nums">{team.position}</td>
                        <td className="px-3 py-2.5">
                          <span className={isDcfc ? "text-navy font-semibold" : "text-ink"}>{team.name}</span>
                          {isDcfc && <span className="ml-2 text-[9px] uppercase tracking-wide text-sky-deep bg-sky/20 px-1.5 py-0.5">Us</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-mute">{team["all-matches"].played}</td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-mute">{team["all-matches"].won}</td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-mute">{team["all-matches"].drawn}</td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-mute">{team["all-matches"].lost}</td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-mute hidden sm:table-cell">{team["all-matches"]["goal-difference"] > 0 ? "+" : ""}{team["all-matches"]["goal-difference"]}</td>
                        <td className="px-3 py-2.5 text-center tabular-nums font-semibold text-navy">{team["total-points"]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Container>
        </section>
      )}

      {/* ── 6. Sponsor strip ── */}
      <SponsorStrip sponsors={adStrip2} />

      {/* ── 7. Featured player ── */}
      {featuredPlayer && (
        <section className="py-16 bg-navy">
          <Container size="wide">
            <div className="text-[10px] uppercase tracking-[0.28em] text-sky mb-2">Player spotlight</div>
            <h2 className="font-serif text-3xl text-paper mb-8">In focus.</h2>
            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-10 items-start">
              <div className="aspect-[3/4] bg-navy-deep relative overflow-hidden">
                {featuredPlayer.photoFilename ? (
                  <img
                    src={variantUrl(featuredPlayer.photoFilename, 600, "jpeg")}
                    alt={featuredPlayer.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-navy-deep to-sky/10 flex items-center justify-center">
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
        </section>
      )}

      {/* ── 8. Sponsor strip ── */}
      <SponsorStrip sponsors={adStrip3} />

      {/* ── 9. Know your enemy ── */}
      {prog.oppositionProfile && (
        <section className="py-16 bg-paper-warm/30">
          <Container size="narrow">
            <div className="text-[10px] uppercase tracking-[0.28em] text-sky-deep mb-2">Today's opponents</div>
            <h2 className="font-serif text-3xl text-navy mb-8">
              Know your enemy{fixture ? ` — ${fixture.opponent}` : ""}.
            </h2>
            <div className="space-y-4">
              {prog.oppositionProfile.split("\n\n").map((para, i) => (
                <p key={i} className="text-ink leading-relaxed">{para}</p>
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* ── 10. Sponsor spotlight ── */}
      {featuredSponsor && (
        <section className="py-16 bg-navy">
          <Container size="wide">
            <div className="text-[10px] uppercase tracking-[0.28em] text-sky mb-2">Proud partner</div>
            <h2 className="font-serif text-3xl text-paper mb-8">Sponsor spotlight.</h2>
            <div className="border border-paper/10 p-8 sm:p-12 flex flex-col sm:flex-row items-center gap-8">
              {featuredSponsor.logoFilename && (
                <div className="flex-shrink-0 bg-paper p-6 flex items-center justify-center w-48 h-32">
                  <img
                    src={variantUrl(featuredSponsor.logoFilename, 400, "jpeg")}
                    alt={featuredSponsor.name}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}
              <div>
                <h3 className="font-serif text-2xl text-paper mb-3">{featuredSponsor.name}</h3>
                <p className="text-paper/60 leading-relaxed mb-4">
                  Proud partner of Doncaster City FC, supporting the club and the community.
                </p>
                {featuredSponsor.url && (
                  <a
                    href={featuredSponsor.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-sky-deep text-paper px-5 py-2.5 text-xs font-semibold uppercase tracking-wide hover:bg-sky transition-colors"
                  >
                    Visit {featuredSponsor.name} ↗
                  </a>
                )}
              </div>
            </div>
          </Container>
        </section>
      )}

      {/* ── Footer strip ── */}
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
