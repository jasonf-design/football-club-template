import { useCallback, useEffect, useRef, useState } from "react";
import { eq, asc, inArray } from "drizzle-orm";
import { Form, Link, useActionData } from "react-router";
import type { Route } from "./+types/programme";
import { db } from "~/db.server";
import { fixtures, media, players, programmeInterest, programmes, sponsors } from "../../db/schema";
import { variantUrl } from "~/lib/uploads";
import { readLeagueTable } from "~/lib/fwp.server";
import { sendProgrammeInterestNotification } from "~/lib/email.server";
import { requireAdmin } from "~/lib/session.server";
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

export async function loader({ request, params }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const isPreview = url.searchParams.get("preview") === "1";

  if (isPreview) {
    await requireAdmin(request);
  }

  const [prog] = await db.select().from(programmes).where(eq(programmes.id, params.id)).limit(1);
  if (!prog || (!isPreview && prog.status !== "published")) throw new Response("Not found", { status: 404 });

  const [fixture] = prog.fixtureId
    ? await db.select().from(fixtures).where(eq(fixtures.id, prog.fixtureId)).limit(1)
    : [null];

  const kickoff = fixture ? new Date(fixture.kickoff) : null;
  const freeFrom = kickoff ? new Date(kickoff.getTime() + 48 * 60 * 60 * 1000) : null;
  const isLocked = !isPreview && freeFrom ? Date.now() < freeFrom.getTime() : false;

  const [coverImage] = prog.coverImageMediaId
    ? await db.select({ filename: media.filename }).from(media).where(eq(media.id, prog.coverImageMediaId)).limit(1)
    : [null];

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

  const firstTeamPlayers = await db
    .select({
      id: players.id, name: players.name, position: players.position,
      shirtNumber: players.shirtNumber, photoFilename: media.filename,
      bio: players.bio,
      sponsor1Name: players.sponsor1Name, sponsor1Url: players.sponsor1Url,
      sponsor1LogoMediaId: players.sponsor1LogoMediaId,
    })
    .from(players)
    .leftJoin(media, eq(media.id, players.photoMediaId))
    .where(eq(players.active, true))
    .orderBy(asc(players.sortOrder), asc(players.name));

  const sponsorLogoIds = firstTeamPlayers
    .map((p) => p.sponsor1LogoMediaId).filter(Boolean) as string[];
  const sponsorLogoMap = new Map<string, string>();
  if (sponsorLogoIds.length) {
    const logos = await db.select({ id: media.id, filename: media.filename })
      .from(media).where(inArray(media.id, sponsorLogoIds));
    logos.forEach((l) => sponsorLogoMap.set(l.id, l.filename));
  }

  const allFixtures = await db
    .select({ id: fixtures.id, opponent: fixtures.opponent, homeAway: fixtures.homeAway, kickoff: fixtures.kickoff, competition: fixtures.competition, status: fixtures.status, homeScore: fixtures.homeScore, awayScore: fixtures.awayScore })
    .from(fixtures).orderBy(asc(fixtures.kickoff));

  const leagueSnapshot = await readLeagueTable();

  const isNcelGame = fixture
    ? fixture.competition.toLowerCase().includes("northern counties") || fixture.competition.toLowerCase().includes("ncel")
    : false;
  const isLeagueCup = fixture
    ? fixture.competition.toLowerCase().includes("cup")
    : false;

  return {
    prog, fixture, kickoff, freeFrom, isLocked, coverImage, coverSponsor: coverSponsor ?? null,
    featuredSponsor: featuredSponsor ?? null, featuredPlayer: featuredPlayer ?? null,
    platinumSponsors, goldSponsors, silverSponsors,
    firstTeamPlayers: firstTeamPlayers.map((p) => ({
      ...p,
      sponsor1LogoFilename: p.sponsor1LogoMediaId ? (sponsorLogoMap.get(p.sponsor1LogoMediaId) ?? null) : null,
    })),
    allFixtures, leagueSnapshot, isNcelGame, isLeagueCup, isPreview,
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

// ── Shared helpers ─────────────────────────────────────────────────────────────

type Sponsor = { id: string; name: string; url: string | null; logoFilename: string | null };

function SponsorLogo({ sponsor, className = "" }: { sponsor: Sponsor; className?: string }) {
  return sponsor.logoFilename
    ? <img src={variantUrl(sponsor.logoFilename, 400, "jpeg")} alt={sponsor.name} className={`object-contain ${className}`} />
    : <span className="font-semibold text-navy tracking-wide">{sponsor.name}</span>;
}

function FixtureRow({ f, isCurrent }: {
  f: { id: string; opponent: string; homeAway: "home" | "away"; kickoff: Date; status: string; homeScore: number | null; awayScore: number | null };
  isCurrent?: boolean;
}) {
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
        {result
          ? <span className={win ? "text-green-700 font-semibold" : "text-red-600 font-semibold"}>{result}</span>
          : <span className="text-mute">{date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>}
      </td>
    </tr>
  );
}

function NcelAdPage({ src, alt, dark = false }: { src: string; alt: string; dark?: boolean }) {
  return (
    <div className={`h-full flex flex-col items-center justify-center px-8 py-16 ${dark ? "bg-navy" : "bg-paper"}`}>
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-[72vh] object-contain mx-auto"
        onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
      />
    </div>
  );
}

// ── Page layout primitives ─────────────────────────────────────────────────────

// Viewport-filling page — no internal scroll
function PageFull({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`h-full relative overflow-hidden flex flex-col ${className}`}>{children}</div>;
}

// Scrollable page — for content that may exceed viewport
function PageScroll({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`min-h-full ${className}`}>{children}</div>;
}

// Section heading with horizontal rule
function SectionHeader({
  eyebrow, title, light = false, className = "",
}: { eyebrow: string; title: string; light?: boolean; className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-3 mb-3 sm:mb-4">
        <span className={`text-[9px] uppercase tracking-[0.3em] font-semibold shrink-0 ${light ? "text-sky" : "text-sky-deep"}`}>
          {eyebrow}
        </span>
        <div className={`flex-1 h-px ${light ? "bg-paper/20" : "bg-line"}`} />
      </div>
      <h2 className={`font-serif leading-tight text-3xl sm:text-[2.5rem] ${light ? "text-paper" : "text-navy"}`}>
        {title}
      </h2>
    </div>
  );
}

// ── BrochureLayout ─────────────────────────────────────────────────────────────

function BrochureLayout({
  pages,
  isPreview,
  progId,
}: {
  pages: { id: string; el: React.ReactNode }[];
  isPreview?: boolean;
  progId?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);

  const goTo = useCallback(
    (n: number) => {
      const el = scrollRef.current;
      if (!el || n < 0 || n >= pages.length) return;
      el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
    },
    [pages.length],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setPage(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") goTo(page + 1);
      if (e.key === "ArrowLeft") goTo(page - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, goTo]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const showDots = pages.length <= 20;

  return (
    // Dark charcoal background — pages appear as magazine "leaves" on top of it
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#181818" }}>
      {isPreview && progId && (
        <div className="flex-shrink-0 bg-amber-500 text-white flex items-center justify-between px-4 py-2 z-10">
          <span className="text-xs font-semibold tracking-wide uppercase">Preview — not published</span>
          <Link to={`/admin/programmes/${progId}/edit`} className="text-xs underline font-semibold hover:text-white/80">
            ← Back to edit
          </Link>
        </div>
      )}

      {/* Main area: scroll track + floating desktop arrows */}
      <div className="flex-1 relative min-h-0">

        {/* Desktop: side navigation arrows floating over dark background */}
        <button
          onClick={() => goTo(page - 1)}
          disabled={page === 0}
          className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20
                     w-10 h-10 items-center justify-center rounded-full
                     bg-white/6 hover:bg-white/12 text-white/50 hover:text-white
                     disabled:opacity-15 transition-all text-base"
          aria-label="Previous page"
        >
          ←
        </button>
        <button
          onClick={() => goTo(page + 1)}
          disabled={page === pages.length - 1}
          className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-20
                     w-10 h-10 items-center justify-center rounded-full
                     bg-white/6 hover:bg-white/12 text-white/50 hover:text-white
                     disabled:opacity-15 transition-all text-base"
          aria-label="Next page"
        >
          →
        </button>

        {/* Horizontal scroll track */}
        <div
          ref={scrollRef}
          className="h-full flex overflow-x-auto overflow-y-hidden [scroll-snap-type:x_mandatory]"
          style={{ scrollbarWidth: "none" }}
        >
          {pages.map((p) => (
            // Page slot — full-viewport on mobile, centering container on desktop
            <div
              key={p.id}
              className="min-w-full h-full shrink-0 [scroll-snap-align:start] overflow-y-auto
                         md:overflow-y-hidden md:flex md:items-center md:justify-center md:px-16 md:py-4"
            >
              {/*
                The "magazine page" — on desktop this is a portrait rectangle with a
                dramatic shadow, floating on the dark background like a PDF viewer page.
                On mobile it fills the screen.
              */}
              <div
                className="w-full h-full bg-paper
                           md:h-[min(100%,780px)] md:w-auto md:aspect-[3/4]
                           md:overflow-y-auto
                           md:shadow-[0_24px_80px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.04)]"
              >
                {p.el}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom nav strip */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-3 py-2"
        style={{ background: "#181818", borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        {/* Mobile-only arrows */}
        <button
          onClick={() => goTo(page - 1)}
          disabled={page === 0}
          className="md:hidden w-8 h-6 flex items-center justify-center text-white/40 hover:text-white disabled:opacity-20 transition-colors"
        >
          ←
        </button>

        <div className="flex-1 flex items-center justify-center gap-1.5 flex-wrap py-0.5">
          {showDots && pages.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={[
                "rounded-full transition-all duration-200 shrink-0",
                i === page ? "bg-sky w-5 h-1.5" : "bg-white/20 w-1.5 h-1.5 hover:bg-white/45",
              ].join(" ")}
              aria-label={`Go to page ${i + 1}`}
            />
          ))}
        </div>

        <span className="text-[9px] text-white/25 tabular-nums shrink-0">{page + 1} / {pages.length}</span>

        <button
          onClick={() => goTo(page + 1)}
          disabled={page === pages.length - 1}
          className="md:hidden w-8 h-6 flex items-center justify-center text-white/40 hover:text-white disabled:opacity-20 transition-colors"
        >
          →
        </button>
      </div>
    </div>
  );
}

// ── Public component ───────────────────────────────────────────────────────────

export default function ProgrammeViewer({ loaderData }: Route.ComponentProps) {
  const {
    prog, fixture, kickoff, freeFrom, isLocked, coverImage, coverSponsor,
    featuredSponsor, featuredPlayer, platinumSponsors, goldSponsors, silverSponsors,
    firstTeamPlayers, allFixtures, leagueSnapshot, isNcelGame, isLeagueCup, isPreview,
  } = loaderData;

  const actionData = useActionData<typeof action>();
  const interestSubmitted = actionData != null && "ok" in actionData;
  const interestError = actionData != null && "error" in actionData ? (actionData as { error: string }).error : null;

  const matchTitle = fixture ? `DCFC vs ${fixture.opponent}` : "Doncaster City FC";
  const matchDate = kickoff
    ? kickoff.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : null;

  const oppositionLines = (prog.oppositionLineup ?? "")
    .split("\n").map((l) => l.trim()).filter(Boolean);

  // ── Locked ────────────────────────────────────────────────────────────────
  if (isLocked) {
    return (
      <div className="relative min-h-[60vh] bg-navy flex flex-col items-center justify-center text-center overflow-hidden">
        {coverImage && (
          <img src={variantUrl(coverImage.filename, 1200, "jpeg")} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: 0.5 }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/70 to-navy/40" />
        <div className="relative z-10 px-6 py-16 max-w-xl mx-auto">
          <Crest className="h-14 w-14 text-paper mx-auto mb-6 opacity-70" />
          <div className="text-[10px] uppercase tracking-[0.3em] text-sky mb-3">{fixture?.competition}</div>
          <h1 className="font-serif text-4xl sm:text-5xl text-paper mb-2">{matchTitle}</h1>
          {matchDate && <div className="text-paper/50 text-sm mb-8">{matchDate}</div>}
          <div className="bg-paper/8 border border-paper/15 p-6 mb-6">
            <div className="font-serif text-xl text-paper mb-2">Programme available from</div>
            <div className="text-sky text-lg font-semibold">
              {freeFrom
                ? freeFrom.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) + " at " + freeFrom.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                : "48 hours after kick-off"}
            </div>
            <p className="text-paper/40 text-xs mt-2">Register your interest and we'll let you know when it goes free.</p>
          </div>
          {interestSubmitted ? (
            <div className="bg-sky/15 border border-sky/30 px-6 py-4 text-paper">
              <div className="font-serif text-lg">Thanks — we'll be in touch!</div>
              <p className="text-paper/60 text-sm mt-1">Free from {freeFrom?.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.</p>
            </div>
          ) : (
            <Form method="post" className="space-y-3">
              {interestError && <div className="text-red-300 text-sm">{interestError}</div>}
              <input type="text" name="name" required placeholder="Your name" className="w-full bg-paper/8 border border-paper/15 text-paper placeholder:text-paper/30 px-4 py-3 outline-none focus:border-sky" />
              <input type="email" name="email" required placeholder="Email address" className="w-full bg-paper/8 border border-paper/15 text-paper placeholder:text-paper/30 px-4 py-3 outline-none focus:border-sky" />
              <button type="submit" className="w-full bg-sky-deep text-paper py-3 font-semibold uppercase tracking-wide text-sm hover:bg-sky transition-colors">
                Register interest →
              </button>
            </Form>
          )}
        </div>
      </div>
    );
  }

  // ── Build pages ────────────────────────────────────────────────────────────

  const pages: { id: string; el: React.ReactNode }[] = [];

  // ── 1. Cover ─────────────────────────────────────────────────────────────────
  pages.push({
    id: "cover",
    el: (
      <PageFull className="bg-navy">
        {/* Ghost crest for no-image fallback */}
        {!coverImage && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
            <Crest className="w-[70%] max-w-sm h-auto text-paper/[0.035]" />
          </div>
        )}

        {/* Cover photo — high opacity, full bleed */}
        {coverImage && (
          <img
            src={variantUrl(coverImage.filename, 1200, "jpeg")}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
            style={{ opacity: 0.82 }}
          />
        )}

        {/* Gradient layers: strong at very bottom, vignette at top */}
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/25 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-navy/65 to-transparent" />

        {/* Header strip */}
        <div className="relative z-10 flex items-center justify-between px-5 pt-5 sm:px-8 sm:pt-7 shrink-0">
          <div className="flex items-center gap-2.5">
            <Crest className="h-9 w-9 sm:h-11 sm:w-11 text-paper drop-shadow-lg" />
            <div>
              <div className="text-paper font-semibold text-[10px] sm:text-xs tracking-[0.18em] uppercase leading-none">Doncaster City</div>
              <div className="text-paper/45 text-[8px] sm:text-[9px] tracking-[0.15em] uppercase mt-0.5">Football Club</div>
            </div>
          </div>
          {isNcelGame && (
            <div className="flex items-center gap-3">
              <img src="/ncel/ncefl%20logo.png" alt="NCEL" className="h-6 sm:h-7 w-auto object-contain brightness-0 invert opacity-55" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <img src="/ncel/MacronLogoPos.png" alt="Macron" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert opacity-50" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              {isLeagueCup && (
                <img src="/ncel/jcpconstruction_logo_whitebg.jpg" alt="JCP Construction" className="h-6 w-auto object-contain p-0.5" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
            </div>
          )}
        </div>

        {/* Spacer pushes match info to bottom */}
        <div className="flex-1" />

        {/* Match info — bottom-anchored editorial layout */}
        <div className="relative z-10 px-5 pb-4 sm:px-8 sm:pb-5 shrink-0">
          {fixture?.competition && (
            <div className="mb-3 sm:mb-4">
              <span className="inline-block bg-sky text-navy-deep text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.25em] px-2.5 py-1">
                {fixture.competition}
              </span>
            </div>
          )}

          {fixture ? (
            <h1 className="font-serif text-paper leading-[0.88] mb-3 sm:mb-4">
              <span className="block" style={{ fontSize: "clamp(2.4rem, 9vw, 6.5rem)" }}>DCFC</span>
              <span
                className="block text-paper/32 font-light"
                style={{ fontSize: "clamp(1rem, 3vw, 1.75rem)", letterSpacing: "0.08em", margin: "0.25em 0" }}
              >
                versus
              </span>
              <span className="block" style={{ fontSize: "clamp(2.4rem, 9vw, 6.5rem)" }}>{fixture.opponent}</span>
            </h1>
          ) : (
            <h1 className="font-serif text-paper leading-[0.9] mb-3" style={{ fontSize: "clamp(2.5rem, 8vw, 5.5rem)" }}>
              Doncaster City FC
            </h1>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-paper/50 text-xs sm:text-sm">
            {matchDate && <span>{matchDate}</span>}
            {kickoff && (
              <>
                <span className="text-paper/18">·</span>
                <span>Kick-off {kickoff.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
              </>
            )}
            {fixture && (
              <>
                <span className="text-paper/18">·</span>
                <span className="text-paper/32">{fixture.venue ?? (fixture.homeAway === "home" ? "Marra Falcons Stadium" : "Away")}</span>
              </>
            )}
          </div>
        </div>

        {/* Cover sponsor strip */}
        {coverSponsor && (
          <div className="relative z-10 border-t border-paper/10 px-5 py-3 sm:px-8 flex items-center gap-3 shrink-0 bg-navy/55 backdrop-blur-sm">
            <span className="text-[8px] uppercase tracking-[0.25em] text-paper/32 shrink-0">In association with</span>
            {coverSponsor.logoFilename
              ? <img src={variantUrl(coverSponsor.logoFilename, 240, "jpeg")} alt={coverSponsor.name} className="h-7 w-auto max-w-[90px] object-contain brightness-0 invert opacity-60" />
              : <span className="text-paper/55 text-xs font-semibold">{coverSponsor.name}</span>}
          </div>
        )}

        {/* Programme label bar */}
        <div className="relative z-10 bg-navy/80 px-5 py-1.5 sm:px-8 shrink-0 flex items-center justify-between">
          <span className="text-[7px] sm:text-[8px] uppercase tracking-[0.28em] text-paper/22">Official Digital Programme</span>
          <span className="text-[7px] sm:text-[8px] text-paper/18">doncastercity-fc.com</span>
        </div>
      </PageFull>
    ),
  });

  // ── 2. Manager's Notes ────────────────────────────────────────────────────────
  if (prog.managersNotes) {
    pages.push({
      id: "notes",
      el: (
        <PageScroll className="bg-paper px-6 py-10 sm:px-12 sm:py-14">
          <div className="max-w-2xl mx-auto">
            <SectionHeader eyebrow="From the manager" title="Manager's notes." className="mb-8" />

            {/* Decorative large quote mark */}
            <div
              className="font-serif text-paper-warm/60 leading-none select-none -mb-6 sm:-mb-8"
              style={{ fontSize: "clamp(5rem, 14vw, 9rem)" }}
              aria-hidden="true"
            >
              "
            </div>

            <div className="space-y-4 sm:space-y-5">
              {prog.managersNotes.split("\n\n").map((para, i) => (
                <p
                  key={i}
                  className={`text-ink leading-relaxed ${i === 0 ? "text-base sm:text-lg font-medium text-navy" : "text-sm sm:text-base"}`}
                >
                  {para}
                </p>
              ))}
            </div>

            <div className="mt-10 pt-6 border-t border-line flex items-center gap-3">
              <Crest className="h-5 w-5 text-navy/30 shrink-0" />
              <div className="text-[9px] uppercase tracking-[0.25em] text-mute">Doncaster City FC Management</div>
            </div>
          </div>
        </PageScroll>
      ),
    });
  }

  // ── 3. Platinum / principal sponsors ─────────────────────────────────────────
  platinumSponsors.forEach((s) => {
    pages.push({
      id: `platinum-${s.id}`,
      el: (
        <PageFull className="bg-navy items-center justify-center text-center px-8 py-10">
          {/* Corner frame accents */}
          <div className="absolute top-5 left-5 w-7 h-7 border-t border-l border-paper/18 pointer-events-none" />
          <div className="absolute top-5 right-5 w-7 h-7 border-t border-r border-paper/18 pointer-events-none" />
          <div className="absolute bottom-14 left-5 w-7 h-7 border-b border-l border-paper/18 pointer-events-none" />
          <div className="absolute bottom-14 right-5 w-7 h-7 border-b border-r border-paper/18 pointer-events-none" />

          <div className="text-[9px] uppercase tracking-[0.35em] text-sky mb-6 sm:mb-8">Principal Partner</div>

          {s.logoFilename && (
            <div className="bg-paper px-10 py-7 sm:px-14 sm:py-9 mb-7 sm:mb-9 inline-flex items-center justify-center max-w-[260px] sm:max-w-xs w-full shadow-2xl">
              <img src={variantUrl(s.logoFilename, 600, "jpeg")} alt={s.name} className="max-h-20 sm:max-h-24 max-w-full object-contain" />
            </div>
          )}

          <h2
            className="font-serif text-paper mb-4"
            style={{ fontSize: "clamp(2rem, 6vw, 4rem)" }}
          >
            {s.name}
          </h2>

          <p className="text-paper/45 max-w-xs sm:max-w-sm leading-relaxed text-xs sm:text-sm mb-7 sm:mb-9 mx-auto">
            Proud principal partner of Doncaster City FC — supporting the club, our players, and the local community.
          </p>

          {s.url && (
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-paper/25 text-paper px-6 py-3 text-[10px] sm:text-xs font-semibold uppercase tracking-widest hover:bg-paper/10 transition-colors"
            >
              Visit {s.name} ↗
            </a>
          )}

          {/* Footer attribution */}
          <div className="absolute bottom-5 inset-x-0 flex items-center justify-center gap-3">
            <div className="h-px w-10 bg-paper/15" />
            <Crest className="h-4 w-4 text-paper/20" />
            <div className="h-px w-10 bg-paper/15" />
          </div>
        </PageFull>
      ),
    });
  });

  // ── 4. Fixtures ───────────────────────────────────────────────────────────────
  pages.push({
    id: "fixtures",
    el: (
      <PageScroll className="bg-paper-warm px-6 py-10 sm:px-10 sm:py-12">
        <SectionHeader eyebrow="2025/26 Season" title="Fixtures & results." className="mb-7" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-10">
          <div>
            <div className="text-[9px] uppercase tracking-[0.22em] text-mute font-semibold mb-3">Recent results</div>
            <table className="w-full">
              <tbody>
                {allFixtures.filter((f) => f.status === "completed").slice(-12).reverse()
                  .map((f) => <FixtureRow key={f.id} f={{ ...f, kickoff: new Date(f.kickoff) }} isCurrent={f.id === fixture?.id} />)}
              </tbody>
            </table>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.22em] text-mute font-semibold mb-3">Coming up</div>
            <table className="w-full">
              <tbody>
                {allFixtures.filter((f) => f.status === "scheduled").slice(0, 12)
                  .map((f) => <FixtureRow key={f.id} f={{ ...f, kickoff: new Date(f.kickoff) }} isCurrent={f.id === fixture?.id} />)}
              </tbody>
            </table>
          </div>
        </div>
      </PageScroll>
    ),
  });

  // ── 5. League table ───────────────────────────────────────────────────────────
  if (leagueSnapshot) {
    pages.push({
      id: "table",
      el: (
        <PageScroll className="bg-paper-warm px-6 py-10 sm:px-10 sm:py-12">
          <SectionHeader eyebrow={leagueSnapshot.data.competition?.name ?? "League"} title="League table." className="mb-7" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-navy text-paper text-[9px] uppercase tracking-[0.18em]">
                  <th className="px-2 py-2.5 text-left w-8">Pos</th>
                  <th className="px-2 py-2.5 text-left">Club</th>
                  <th className="px-2 py-2.5 text-center w-8">P</th>
                  <th className="px-2 py-2.5 text-center w-8 hidden sm:table-cell">W</th>
                  <th className="px-2 py-2.5 text-center w-8 hidden sm:table-cell">D</th>
                  <th className="px-2 py-2.5 text-center w-8 hidden sm:table-cell">L</th>
                  <th className="px-2 py-2.5 text-center w-10 hidden sm:table-cell">GD</th>
                  <th className="px-2 py-2.5 text-center w-10">Pts</th>
                </tr>
              </thead>
              <tbody>
                {leagueSnapshot.data.teams.map((team, i) => {
                  const isDcfc = team.name.toLowerCase().includes("doncaster city");
                  return (
                    <tr key={team.id} className={["border-b border-line text-xs", isDcfc ? "bg-sky/10 font-semibold" : i % 2 === 0 ? "bg-paper" : "bg-paper-warm/25"].join(" ")}>
                      <td className="px-2 py-2 text-mute tabular-nums">{team.position}</td>
                      <td className="px-2 py-2">
                        <span className={isDcfc ? "text-navy font-semibold" : "text-ink"}>{team.name}</span>
                        {isDcfc && <span className="ml-1.5 text-[8px] uppercase tracking-wide text-sky-deep bg-sky/20 px-1 py-0.5">Us</span>}
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
        </PageScroll>
      ),
    });
  }

  // ── 6. Gold / official sponsors (2 per page) ──────────────────────────────────
  for (let gi = 0; gi < goldSponsors.length; gi += 2) {
    const pair = goldSponsors.slice(gi, gi + 2);
    pages.push({
      id: `gold-${gi}`,
      el: (
        <PageFull className="bg-paper px-6 py-8 sm:px-10 sm:py-10">
          {gi === 0 && (
            <SectionHeader eyebrow="Official partners" title="Our sponsors." className="mb-6 sm:mb-7 shrink-0" />
          )}
          {gi > 0 && (
            <div className="flex items-center gap-3 mb-6 shrink-0">
              <span className="text-[9px] uppercase tracking-[0.3em] text-sky-deep font-semibold shrink-0">Official partners</span>
              <div className="flex-1 h-px bg-line" />
            </div>
          )}
          <div className={`flex-1 grid min-h-0 gap-4 sm:gap-6 ${pair.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
            {pair.map((s) => (
              <div key={s.id} className="border border-line flex flex-col items-center justify-center text-center gap-4 sm:gap-5 p-7 sm:p-10 min-h-0">
                {s.logoFilename ? (
                  <div className="h-20 sm:h-24 flex items-center justify-center">
                    <img src={variantUrl(s.logoFilename, 400, "jpeg")} alt={s.name} className="max-h-full max-w-[180px] sm:max-w-[220px] object-contain" />
                  </div>
                ) : null}
                <div>
                  <div className="font-serif text-xl sm:text-2xl text-navy mb-1">{s.name}</div>
                  <div className="text-[9px] uppercase tracking-[0.2em] text-mute">Official Partner · Doncaster City FC</div>
                </div>
                {s.url && (
                  <a href={s.url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-sky-deep underline underline-offset-4 hover:text-navy transition-colors">
                    {s.url.replace(/^https?:\/\/(www\.)?/, "")}
                  </a>
                )}
              </div>
            ))}
          </div>
        </PageFull>
      ),
    });
  }

  // ── 7. Featured player ────────────────────────────────────────────────────────
  if (featuredPlayer) {
    pages.push({
      id: "player",
      el: (
        <PageFull className="bg-navy-deep">
          {/* Full-bleed player photo */}
          {featuredPlayer.photoFilename && (
            <img
              src={variantUrl(featuredPlayer.photoFilename, 800, "jpeg")}
              alt={featuredPlayer.name}
              className="absolute inset-0 h-full w-full object-cover object-top"
              style={{ opacity: 0.55 }}
            />
          )}
          {!featuredPlayer.photoFilename && (
            <div className="absolute inset-0 flex items-center justify-end pr-8 pointer-events-none select-none">
              <Crest className="h-3/4 w-auto text-paper/[0.05]" />
            </div>
          )}

          {/* Left gradient so text is readable over image */}
          <div className="absolute inset-0 bg-gradient-to-r from-navy-deep via-navy-deep/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/60 via-transparent to-navy-deep/40" />

          {/* Content — left-aligned, vertically centered */}
          <div className="relative z-10 flex flex-col justify-center flex-1 px-6 py-10 sm:px-12 sm:py-14 max-w-lg">
            <div className="text-[9px] uppercase tracking-[0.3em] text-sky mb-2 font-semibold">Player spotlight</div>

            {featuredPlayer.shirtNumber && (
              <div
                className="font-serif text-paper/8 leading-none select-none -mb-4 sm:-mb-6"
                style={{ fontSize: "clamp(5rem, 18vw, 10rem)" }}
                aria-hidden="true"
              >
                {featuredPlayer.shirtNumber}
              </div>
            )}

            {(featuredPlayer.position || featuredPlayer.position2) && (
              <div className="text-sky/75 text-[10px] uppercase tracking-[0.2em] mb-2">
                {[featuredPlayer.position, featuredPlayer.position2].filter(Boolean).join(" · ")}
              </div>
            )}

            <h2
              className="font-serif text-paper leading-tight mb-5"
              style={{ fontSize: "clamp(2.2rem, 7vw, 4.5rem)" }}
            >
              {featuredPlayer.name}
            </h2>

            {featuredPlayer.bio && (
              <div className="space-y-3">
                {featuredPlayer.bio.split("\n\n").slice(0, 3).map((para, i) => (
                  <p key={i} className="text-paper/60 text-sm sm:text-base leading-relaxed">{para}</p>
                ))}
              </div>
            )}
          </div>
        </PageFull>
      ),
    });
  }

  // ── 8. Know Your Enemy ───────────────────────────────────────────────────────
  if (prog.oppositionProfile) {
    pages.push({
      id: "opposition",
      el: (
        <PageScroll className="bg-paper-warm/40 px-6 py-10 sm:px-12 sm:py-14">
          <div className="max-w-2xl mx-auto">
            <SectionHeader
              eyebrow="Today's opponents"
              title={fixture ? `${fixture.opponent}.` : "Know your enemy."}
              className="mb-8"
            />
            <div className="space-y-4 sm:space-y-5">
              {prog.oppositionProfile.split("\n\n").map((para, i) => (
                <p key={i} className={`leading-relaxed ${i === 0 ? "text-base sm:text-lg font-medium text-navy" : "text-sm sm:text-base text-ink"}`}>
                  {para}
                </p>
              ))}
            </div>
          </div>
        </PageScroll>
      ),
    });
  }

  // ── 9. Silver / partner sponsors ──────────────────────────────────────────────
  if (silverSponsors.length > 0) {
    pages.push({
      id: "silver",
      el: (
        <PageScroll className="bg-paper px-6 py-10 sm:px-10 sm:py-12">
          <SectionHeader eyebrow="Club partners" title="Partners &amp; supporters." className="mb-7" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {silverSponsors.map((s) => (
              <div key={s.id} className="border border-line p-5 sm:p-6 flex flex-col items-center text-center gap-3 justify-center min-h-[160px] sm:min-h-[180px]">
                {s.logoFilename ? (
                  <img src={variantUrl(s.logoFilename, 240, "jpeg")} alt={s.name} className="max-h-12 sm:max-h-14 max-w-full object-contain" />
                ) : (
                  <div className="font-serif text-base text-navy">{s.name}</div>
                )}
                {s.logoFilename && <div className="text-xs font-medium text-navy leading-tight">{s.name}</div>}
                <div className="text-[8px] uppercase tracking-[0.18em] text-mute">Club partner</div>
                {s.url && (
                  <a href={s.url} target="_blank" rel="noopener noreferrer"
                    className="text-[9px] text-sky-deep underline underline-offset-2 hover:text-navy truncate max-w-full">
                    {s.url.replace(/^https?:\/\/(www\.)?/, "")}
                  </a>
                )}
              </div>
            ))}
          </div>
        </PageScroll>
      ),
    });
  }

  // ── 10. Sponsor the Pitch ─────────────────────────────────────────────────────
  pages.push({
    id: "pitch",
    el: (
      <PageFull className="bg-navy px-6 py-10 sm:px-12 sm:py-14 justify-center">
        {/* Subtle ghost pattern */}
        <div className="absolute inset-0 flex items-center justify-end pr-6 sm:pr-12 pointer-events-none select-none opacity-30">
          <svg viewBox="0 0 200 140" className="w-1/2 max-w-sm text-paper/5" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="10" y="10" width="180" height="120" />
            <line x1="10" y1="70" x2="190" y2="70" />
            <circle cx="100" cy="70" r="25" />
            <line x1="10" y1="55" x2="10" y2="85" />
            <line x1="10" y1="55" x2="30" y2="55" />
            <line x1="10" y1="85" x2="30" y2="85" />
            <line x1="190" y1="55" x2="190" y2="85" />
            <line x1="190" y1="55" x2="170" y2="55" />
            <line x1="190" y1="85" x2="170" y2="85" />
          </svg>
        </div>

        <div className="relative z-10 max-w-lg">
          <SectionHeader eyebrow="Get involved" title="Sponsor a pitch square." light className="mb-6 sm:mb-8" />
          <p className="text-paper/55 leading-relaxed text-sm sm:text-base mb-7">
            Put your name — or your business — on the Marra Falcons Stadium pitch. Platinum, gold, and silver squares are available, placing your brand at the heart of every home match.
          </p>

          <a href="/pitch"
            className="inline-flex items-center gap-2 bg-sky text-navy-deep px-6 py-3 font-semibold text-xs sm:text-sm uppercase tracking-wide hover:bg-paper transition-colors mb-10">
            View available squares →
          </a>

          {pitchSponsors.length > 0 && (
            <>
              <div className="text-[9px] uppercase tracking-[0.22em] text-sky mb-4 font-semibold">Current pitch sponsors</div>
              <div className="space-y-2">
                {pitchSponsors.map((ps) => (
                  <div key={ps.id} className="flex items-center justify-between border border-paper/10 px-4 py-2.5 hover:border-paper/20 transition-colors">
                    <div>
                      <div className="text-paper text-sm font-medium">{ps.name}</div>
                      <div className="text-paper/35 text-[9px] uppercase tracking-wide mt-0.5">{ps.squares.length} square{ps.squares.length !== 1 ? "s" : ""}</div>
                    </div>
                    <div className={["text-[8px] uppercase tracking-wide px-2 py-0.5 font-semibold",
                      ps.tier === "platinum" ? "bg-yellow-500/15 text-yellow-300" :
                      ps.tier === "gold" ? "bg-amber-500/15 text-amber-300" :
                      "bg-paper/8 text-paper/45"].join(" ")}>
                      {ps.tier}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </PageFull>
    ),
  });

  // ── 11. Squad pages — two non-scrolling brochure pages ───────────────────────
  {
    const squadSorted = firstTeamPlayers
      .slice()
      .sort((a, b) => (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99));
    const half = Math.ceil(squadSorted.length / 2);

    const PlayerEntry = ({ p }: { p: typeof squadSorted[number] }) => (
      <div className="flex gap-2.5 px-3 py-2 border-b border-line/60 last:border-0">
        {/* Thumbnail */}
        <div className="w-9 h-[52px] shrink-0 relative overflow-hidden bg-navy/8">
          {p.photoFilename ? (
            <img
              src={variantUrl(p.photoFilename, 120, "jpeg")}
              alt={p.name}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-navy to-navy-deep flex items-center justify-center">
              {p.shirtNumber && (
                <span style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem" }} className="text-paper/15 leading-none">
                  {p.shirtNumber}
                </span>
              )}
            </div>
          )}
        </div>
        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            {p.shirtNumber != null && (
              <span
                style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem" }}
                className="text-navy/20 tabular-nums shrink-0 leading-none"
              >
                {p.shirtNumber}
              </span>
            )}
            <span className="text-[11px] font-semibold text-navy leading-tight truncate">{p.name}</span>
          </div>
          {p.position && (
            <div className="text-[8px] uppercase tracking-[0.14em] text-mute mt-0.5 leading-none">{p.position}</div>
          )}
          {p.bio && (
            <p className="text-[9px] text-ink/60 leading-snug mt-0.5 line-clamp-2">{p.bio}</p>
          )}
          {p.sponsor1Name && (
            p.sponsor1Url ? (
              <a
                href={p.sponsor1Url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[8px] text-sky-deep underline underline-offset-2 truncate block mt-0.5 leading-tight"
              >
                Spon: {p.sponsor1Name} ↗
              </a>
            ) : (
              <span className="text-[8px] text-mute/70 truncate block mt-0.5 leading-tight">
                Spon: {p.sponsor1Name}
              </span>
            )
          )}
        </div>
      </div>
    );

    const SquadPageHeader = ({ label }: { label: string }) => (
      <div className="shrink-0 px-5 pt-5 pb-3 border-b border-line flex items-end justify-between">
        <div>
          <div className="text-[8px] uppercase tracking-[0.3em] text-sky-deep font-semibold mb-0.5">Doncaster City FC</div>
          <div className="font-serif text-navy text-lg leading-tight">The Squad</div>
        </div>
        <div className="text-[8px] uppercase tracking-[0.2em] text-mute">{label}</div>
      </div>
    );

    const makeCols = (group: typeof squadSorted) => {
      const mid = Math.ceil(group.length / 2);
      return [group.slice(0, mid), group.slice(mid)];
    };

    const [p1a, p1b] = makeCols(squadSorted.slice(0, half));
    const [p2a, p2b] = makeCols(squadSorted.slice(half));

    pages.push({
      id: "squad-1",
      el: (
        <PageFull className="bg-paper">
          <SquadPageHeader label="Page 1 of 2" />
          <div className="flex-1 grid grid-cols-2 divide-x divide-line min-h-0 overflow-hidden">
            <div className="overflow-hidden">{p1a.map((p) => <PlayerEntry key={p.id} p={p} />)}</div>
            <div className="overflow-hidden">{p1b.map((p) => <PlayerEntry key={p.id} p={p} />)}</div>
          </div>
          <div className="shrink-0 bg-navy/4 border-t border-line px-4 py-2 flex items-center justify-between">
            <Crest className="h-3.5 w-3.5 text-navy/20" />
            <span className="text-[7px] uppercase tracking-[0.2em] text-mute/60">doncastercity-fc.com</span>
          </div>
        </PageFull>
      ),
    });

    pages.push({
      id: "squad-2",
      el: (
        <PageFull className="bg-paper">
          <SquadPageHeader label="Page 2 of 2" />
          <div className="flex-1 grid grid-cols-2 divide-x divide-line min-h-0 overflow-hidden">
            <div className="overflow-hidden">{p2a.map((p) => <PlayerEntry key={p.id} p={p} />)}</div>
            <div className="overflow-hidden">{p2b.map((p) => <PlayerEntry key={p.id} p={p} />)}</div>
          </div>
          <div className="shrink-0 bg-navy/4 border-t border-line px-4 py-2 flex items-center justify-between">
            <Crest className="h-3.5 w-3.5 text-navy/20" />
            <span className="text-[7px] uppercase tracking-[0.2em] text-mute/60">doncastercity-fc.com</span>
          </div>
        </PageFull>
      ),
    });
  }

  // ── 12. Team sheet ────────────────────────────────────────────────────────────
  pages.push({
    id: "teamsheet",
    el: (
      <PageScroll className="bg-paper">

        {/* Match header — full-width dark band */}
        <div className="bg-navy px-5 py-5 text-center">
          <div className="text-[8px] uppercase tracking-[0.35em] text-sky mb-2 font-semibold">Team Sheet</div>
          <div className="font-serif text-paper leading-tight" style={{ fontSize: "clamp(1.1rem, 4vw, 1.6rem)" }}>
            Doncaster City FC
            <span className="text-paper/35 font-light mx-2 text-base">v</span>
            {fixture?.opponent ?? "Opposition"}
          </div>
          {matchDate && (
            <div className="text-paper/40 text-[10px] mt-1.5 tracking-wide">{matchDate}</div>
          )}
        </div>

        {/* Team columns */}
        <div className="grid grid-cols-2 divide-x divide-line min-h-0">

          {/* ── DCFC ── */}
          <div>
            {/* Column header */}
            <div className="flex items-center gap-2.5 px-3 py-3 bg-navy/5 border-b border-line">
              <Crest className="h-7 w-7 text-navy shrink-0" />
              <div>
                <div className="font-semibold text-navy text-xs leading-tight">Doncaster City FC</div>
                <div className="text-[8px] uppercase tracking-[0.18em] text-sky-deep mt-0.5">Home</div>
              </div>
            </div>
            {/* Players */}
            {firstTeamPlayers
              .slice()
              .sort((a, b) => (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99))
              .map((p) => (
                <div key={p.id} className="flex items-center border-b border-line/70 px-3 py-1.5 gap-2.5">
                  <span
                    className="text-navy/25 tabular-nums shrink-0 text-right leading-none select-none"
                    style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", width: "1.5rem" }}
                  >
                    {p.shirtNumber ?? "—"}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-navy leading-tight truncate">{p.name}</div>
                    {p.position && (
                      <div className="text-[8px] uppercase tracking-[0.14em] text-mute leading-none mt-0.5">{p.position}</div>
                    )}
                  </div>
                </div>
              ))}
          </div>

          {/* ── Opposition ── */}
          <div>
            {/* Column header */}
            <div className="flex items-center gap-2.5 px-3 py-3 bg-navy/5 border-b border-line">
              <div className="h-7 w-7 border border-line/80 bg-paper-warm flex items-center justify-center shrink-0">
                <span className="text-[6px] uppercase tracking-wide text-mute/50 text-center leading-tight">Away<br/>Crest</span>
              </div>
              <div>
                <div className="font-semibold text-navy text-xs leading-tight">{fixture?.opponent ?? "Opposition"}</div>
                <div className="text-[8px] uppercase tracking-[0.18em] text-mute mt-0.5">Away</div>
              </div>
            </div>
            {/* Players */}
            {oppositionLines.length > 0 ? (
              oppositionLines.map((line, i) => {
                const m = line.match(/^(\d+)\s+(.+)$/);
                return (
                  <div key={i} className="flex items-center border-b border-line/70 px-3 py-1.5 gap-2.5">
                    <span
                      className="text-navy/25 tabular-nums shrink-0 text-right leading-none select-none"
                      style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", width: "1.5rem" }}
                    >
                      {m ? m[1] : i + 1}
                    </span>
                    <div className="text-[11px] font-semibold text-navy leading-tight truncate">{m ? m[2] : line}</div>
                  </div>
                );
              })
            ) : (
              Array.from({ length: 16 }, (_, i) => (
                <div key={i} className="flex items-center border-b border-line/70 px-3 py-1.5 gap-2.5">
                  <span
                    className="text-navy/20 tabular-nums shrink-0 text-right leading-none select-none"
                    style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", width: "1.5rem" }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 h-px bg-line/40" />
                </div>
              ))
            )}
          </div>

        </div>

        {/* Bottom credit strip */}
        <div className="bg-navy/5 border-t border-line px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crest className="h-4 w-4 text-navy/30" />
            <span className="text-[8px] uppercase tracking-[0.2em] text-mute">Doncaster City FC</span>
          </div>
          <span className="text-[8px] text-mute/60">doncastercity-fc.com</span>
        </div>

      </PageScroll>
    ),
  });

  // ── 13. NCEL mandatory ads ────────────────────────────────────────────────────
  if (isNcelGame) {
    pages.push({ id: "ncel-macron", el: <NcelAdPage src="/macron-banner.png" alt="Macron Sports Hub Wakefield — Official Kit Supplier" dark /> });
    pages.push({ id: "ncel-rcuk", el: <NcelAdPage src="/ncel/resuscitationcounciluklogo.jpg" alt="Resuscitation Council UK" /> });
    pages.push({ id: "ncel-pst", el: <NcelAdPage src="/ncel/pstsport.png" alt="PST Sport" /> });
  }

  // ── 14. Featured sponsor spotlight ───────────────────────────────────────────
  if (featuredSponsor) {
    pages.push({
      id: "sponsor-spotlight",
      el: (
        <PageFull className="bg-navy items-center justify-center px-8 py-12">
          <div className="absolute top-5 left-5 w-7 h-7 border-t border-l border-paper/15 pointer-events-none" />
          <div className="absolute top-5 right-5 w-7 h-7 border-t border-r border-paper/15 pointer-events-none" />
          <div className="absolute bottom-5 left-5 w-7 h-7 border-b border-l border-paper/15 pointer-events-none" />
          <div className="absolute bottom-5 right-5 w-7 h-7 border-b border-r border-paper/15 pointer-events-none" />

          <div className="text-[9px] uppercase tracking-[0.35em] text-sky mb-6 text-center">Proud Partner</div>

          {featuredSponsor.logoFilename && (
            <div className="bg-paper px-10 py-7 mb-7 inline-flex items-center justify-center w-64 shadow-2xl">
              <img src={variantUrl(featuredSponsor.logoFilename, 400, "jpeg")} alt={featuredSponsor.name} className="max-h-20 max-w-full object-contain" />
            </div>
          )}

          <h3
            className="font-serif text-paper text-center mb-4"
            style={{ fontSize: "clamp(1.75rem, 5vw, 3rem)" }}
          >
            {featuredSponsor.name}
          </h3>
          <p className="text-paper/45 text-center max-w-xs text-xs sm:text-sm leading-relaxed mb-7">
            Proud partner of Doncaster City FC, supporting the club and the local community.
          </p>
          {featuredSponsor.url && (
            <a href={featuredSponsor.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-paper/25 text-paper px-6 py-2.5 text-[10px] font-semibold uppercase tracking-widest hover:bg-paper/10 transition-colors">
              Visit {featuredSponsor.name} ↗
            </a>
          )}

          <div className="absolute bottom-5 inset-x-0 flex items-center justify-center gap-3">
            <div className="h-px w-10 bg-paper/12" />
            <Crest className="h-4 w-4 text-paper/18" />
            <div className="h-px w-10 bg-paper/12" />
          </div>
        </PageFull>
      ),
    });
  }

  // ── 15. Back cover ────────────────────────────────────────────────────────────
  pages.push({
    id: "back",
    el: (
      <PageFull className="bg-navy items-center justify-center text-center px-8">
        {/* Large ghost crest */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <Crest className="w-3/4 max-w-xs h-auto text-paper/[0.04]" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-4">
          <Crest className="h-14 w-14 sm:h-16 sm:w-16 text-paper opacity-55" />
          <div className="h-px w-12 bg-paper/15" />
          <div className="font-serif text-paper text-2xl sm:text-3xl">Doncaster City FC</div>
          <div className="text-[9px] uppercase tracking-[0.3em] text-paper/30">Official Digital Programme</div>
          <div className="text-paper/20 text-xs mt-1">doncastercity-fc.com</div>
        </div>
      </PageFull>
    ),
  });

  return <BrochureLayout pages={pages} isPreview={isPreview} progId={prog.id} />;
}
