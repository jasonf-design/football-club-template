import { useCallback, useEffect, useRef, useState } from "react";
import { eq, asc, inArray, and } from "drizzle-orm";
import { Form, Link, useActionData } from "react-router";
import type { Route } from "./+types/programme";
import { db } from "~/db.server";
import { fixtures, media, players, coachingStaff, programmeInterest, programmes, sponsors } from "../../db/schema";
import { variantUrl, fallbackFormatFor } from "~/lib/uploads";
import { readLeagueTable } from "~/lib/fwp.server";
import { sendProgrammeInterestNotification } from "~/lib/email.server";
import { Crest } from "~/components/Crest";
import { pitchSponsors, getSponsorAt } from "~/lib/pitchSponsors";
import { z } from "zod";
import { club } from "~/club.config";

export function meta({ data }: Route.MetaArgs) {
  if (!data) return [{ title: `Programme · ${club.name.short}` }];
  const { fixture } = data as Awaited<ReturnType<typeof loader>>;
  const title = fixture ? `vs ${fixture.opponent} — DCFC Match Programme` : "Match Programme";
  return [
    { title: `${title} · ${club.name.short}` },
    { name: "description", content: `Official Doncaster City FC digital match programme${fixture ? ` for the fixture against ${fixture.opponent}` : ""}.` },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const isPreview = url.searchParams.get("preview") === "1";

  const [prog] = await db.select().from(programmes).where(eq(programmes.id, params.id)).limit(1);
  if (!prog || (!isPreview && prog.status !== "published")) throw new Response("Not found", { status: 404 });

  const [fixture] = prog.fixtureId
    ? await db.select().from(fixtures).where(eq(fixtures.id, prog.fixtureId)).limit(1)
    : [null];

  const kickoff = fixture ? new Date(fixture.kickoff) : null;
  const isLocked = false;

  const [coverImage] = prog.coverImageMediaId
    ? await db.select({ filename: media.filename, focalX: media.focalX, focalY: media.focalY }).from(media).where(eq(media.id, prog.coverImageMediaId)).limit(1)
    : [null];

  const [chairmansNotesImage] = prog.chairmansNotesImageMediaId
    ? await db.select({ filename: media.filename, focalX: media.focalX, focalY: media.focalY }).from(media).where(eq(media.id, prog.chairmansNotesImageMediaId)).limit(1)
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

  const [featuredPlayerRow] = prog.featuredPlayerId
    ? await db.select({
        id: players.id, name: players.name, position: players.position,
        position2: players.position2, bio: players.bio, shirtNumber: players.shirtNumber,
        photoFilename: media.filename, photoFocalX: media.focalX, photoFocalY: media.focalY,
        spotlightPhotoMediaId: players.spotlightPhotoMediaId,
        spotlightFocalX: players.spotlightFocalX,
        spotlightFocalY: players.spotlightFocalY,
        sponsor1Name: players.sponsor1Name, sponsor1Url: players.sponsor1Url,
        sponsor1Description: players.sponsor1Description,
        sponsor1LogoMediaId: players.sponsor1LogoMediaId,
        sponsor2Name: players.sponsor2Name, sponsor2Url: players.sponsor2Url,
        sponsor2Description: players.sponsor2Description,
        sponsor2LogoMediaId: players.sponsor2LogoMediaId,
      })
        .from(players).leftJoin(media, eq(media.id, players.photoMediaId))
        .where(eq(players.id, prog.featuredPlayerId)).limit(1)
    : [null];

  const [spotlightPhotoRow] = featuredPlayerRow?.spotlightPhotoMediaId
    ? await db.select({ filename: media.filename })
        .from(media).where(eq(media.id, featuredPlayerRow.spotlightPhotoMediaId)).limit(1)
    : [null];

  const firstTeamPlayers = await db
    .select({
      id: players.id, name: players.name, position: players.position,
      shirtNumber: players.shirtNumber, photoFilename: media.filename,
      photoFocalX: media.focalX, photoFocalY: media.focalY,
      bio: players.bio,
      sponsor1Name: players.sponsor1Name, sponsor1Url: players.sponsor1Url,
      sponsor1LogoMediaId: players.sponsor1LogoMediaId,
      sponsor2Name: players.sponsor2Name, sponsor2Url: players.sponsor2Url,
      sponsor2LogoMediaId: players.sponsor2LogoMediaId,
    })
    .from(players)
    .leftJoin(media, eq(media.id, players.photoMediaId))
    .where(and(eq(players.active, true), eq(players.team, "first")))
    .orderBy(asc(players.sortOrder), asc(players.name));

  const allSponsorLogoIds = [
    ...firstTeamPlayers.flatMap((p) => [p.sponsor1LogoMediaId, p.sponsor2LogoMediaId]),
    featuredPlayerRow?.sponsor1LogoMediaId,
    featuredPlayerRow?.sponsor2LogoMediaId,
  ].filter(Boolean) as string[];
  const sponsorLogoMap = new Map<string, string>();
  if (allSponsorLogoIds.length) {
    const logos = await db.select({ id: media.id, filename: media.filename })
      .from(media).where(inArray(media.id, allSponsorLogoIds));
    logos.forEach((l) => sponsorLogoMap.set(l.id, l.filename));
  }

  const allFixtures = await db
    .select({ id: fixtures.id, opponent: fixtures.opponent, homeAway: fixtures.homeAway, kickoff: fixtures.kickoff, competition: fixtures.competition, status: fixtures.status, homeScore: fixtures.homeScore, awayScore: fixtures.awayScore })
    .from(fixtures).orderBy(asc(fixtures.kickoff));

  const firstTeamStaffRaw = await db
    .select({ id: coachingStaff.id, name: coachingStaff.name, role: coachingStaff.role, photoMediaId: coachingStaff.photoMediaId })
    .from(coachingStaff)
    .where(eq(coachingStaff.team, "first"))
    .orderBy(asc(coachingStaff.sortOrder), asc(coachingStaff.name));

  const staffPhotoIds = firstTeamStaffRaw.map((s) => s.photoMediaId).filter(Boolean) as string[];
  const staffPhotoMap = new Map<string, string>();
  if (staffPhotoIds.length) {
    const staffPhotos = await db.select({ id: media.id, filename: media.filename })
      .from(media).where(inArray(media.id, staffPhotoIds));
    staffPhotos.forEach((p) => staffPhotoMap.set(p.id, p.filename));
  }
  const firstTeamStaff = firstTeamStaffRaw.map((s) => ({
    ...s,
    photoFilename: s.photoMediaId ? (staffPhotoMap.get(s.photoMediaId) ?? null) : null,
  }));

  const leagueSnapshot = await readLeagueTable();

  const isNcelGame = fixture
    ? fixture.competition.toLowerCase().includes("northern counties") || fixture.competition.toLowerCase().includes("ncel")
    : false;
  const isLeagueCup = fixture
    ? fixture.competition.toLowerCase().includes("cup")
    : false;

  return {
    prog, fixture, kickoff, isLocked, coverImage, chairmansNotesImage: chairmansNotesImage ?? null, coverSponsor: coverSponsor ?? null,
    featuredSponsor: featuredSponsor ?? null,
    featuredPlayer: featuredPlayerRow ? {
      ...featuredPlayerRow,
      // Spotlight page uses custom photo if set, otherwise falls back to the regular player photo
      spotlightFilename: spotlightPhotoRow?.filename ?? featuredPlayerRow.photoFilename,
      sponsor1LogoFilename: featuredPlayerRow.sponsor1LogoMediaId ? (sponsorLogoMap.get(featuredPlayerRow.sponsor1LogoMediaId) ?? null) : null,
      sponsor2LogoFilename: featuredPlayerRow.sponsor2LogoMediaId ? (sponsorLogoMap.get(featuredPlayerRow.sponsor2LogoMediaId) ?? null) : null,
    } : null,
    platinumSponsors, goldSponsors, silverSponsors,
    firstTeamPlayers: firstTeamPlayers.map((p) => ({
      ...p,
      sponsor1LogoFilename: p.sponsor1LogoMediaId ? (sponsorLogoMap.get(p.sponsor1LogoMediaId) ?? null) : null,
      sponsor2LogoFilename: p.sponsor2LogoMediaId ? (sponsorLogoMap.get(p.sponsor2LogoMediaId) ?? null) : null,
    })),
    firstTeamStaff,
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
    ? <img src={variantUrl(sponsor.logoFilename, 400, fallbackFormatFor(sponsor.logoFilename))} alt={sponsor.name} className={`object-contain ${className}`} />
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
  const dcfcScore = f.homeAway === "home" ? homeScore : awayScore;
  const oppScore  = f.homeAway === "home" ? awayScore : homeScore;
  const win  = result ? dcfcScore > oppScore : false;
  const draw = result ? dcfcScore === oppScore : false;
  const resultColour = win ? "text-green-700" : draw ? "text-[#6b7280]" : "text-red-600";
  return (
    <tr className={["border-b border-line/60", isCurrent ? "bg-sky/5 font-semibold" : ""].join(" ")}>
      <td className="py-1 pr-2 text-[9px] text-mute whitespace-nowrap tabular-nums">{date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</td>
      <td className="py-1 pr-2">
        <span className={["text-[7px] font-bold px-0.5 py-px mr-1 uppercase", f.homeAway === "home" ? "bg-navy text-paper" : "border border-line text-mute"].join(" ")}>
          {f.homeAway === "home" ? "H" : "A"}
        </span>
        <span className="text-[10px] text-ink">{f.opponent}</span>
      </td>
      <td className="py-1 text-right text-[10px] tabular-nums whitespace-nowrap">
        {result
          ? <span className={`${resultColour} font-semibold`}>{result}</span>
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
function PageFull({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`h-full relative overflow-hidden flex flex-col ${className}`} style={style}>{children}</div>;
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

// ── ScaledPage ─────────────────────────────────────────────────────────────────

const DESIGN_W = 585;
const DESIGN_H = 780;

function ScaledPage({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setScale(Math.min(w / DESIGN_W, h / DESIGN_H));
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden relative">
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: DESIGN_W,
          height: DESIGN_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center center",
        }}
        className="bg-paper shadow-[0_24px_80px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.04)]"
      >
        {children}
      </div>
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
            // Page slot — full viewport, ScaledPage renders at 585×780 and scales to fit
            <div
              key={p.id}
              className="min-w-full h-full shrink-0 [scroll-snap-align:start] overflow-hidden px-2 py-2 md:px-16 md:py-4"
            >
              <ScaledPage>{p.el}</ScaledPage>
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
    prog, fixture, kickoff, isLocked, coverImage, chairmansNotesImage, coverSponsor,
    featuredSponsor, featuredPlayer, platinumSponsors, goldSponsors, silverSponsors,
    firstTeamPlayers, firstTeamStaff, allFixtures, leagueSnapshot, isNcelGame, isLeagueCup, isPreview,
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
          <img src={variantUrl(coverImage.filename, 1200, "jpeg")} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: 0.5, objectPosition: `${(coverImage.focalX ?? 0.5) * 100}% ${(coverImage.focalY ?? 0.5) * 100}%` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/70 to-navy/40" />
        <div className="relative z-10 px-6 py-16 max-w-xl mx-auto">
          <Crest className="h-14 w-14 text-paper mx-auto mb-6 opacity-70" />
          <div className="text-[10px] uppercase tracking-[0.3em] text-sky mb-3">{fixture?.competition}</div>
          <h1 className="font-serif text-4xl sm:text-5xl text-paper mb-2">{matchTitle}</h1>
          {matchDate && <div className="text-paper/50 text-sm mb-8">{matchDate}</div>}
          <div className="bg-paper/8 border border-paper/15 p-6 mb-6">
            <div className="font-serif text-xl text-paper mb-2">Programme not yet available</div>
            <p className="text-paper/40 text-xs mt-2">Register your interest and we'll let you know when it goes live.</p>
          </div>
          {interestSubmitted ? (
            <div className="bg-sky/15 border border-sky/30 px-6 py-4 text-paper">
              <div className="font-serif text-lg">Thanks — we'll be in touch!</div>
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
  {
    const opponentSlug = fixture?.opponent?.toLowerCase().replace(/\s+/g, "-") ?? "";
    pages.push({
      id: "cover",
      el: (
        <PageFull className="bg-navy">

          {/* ── Photo layer ── */}
          {coverImage ? (
            <img
              src={variantUrl(coverImage.filename, 1200, "jpeg")}
              alt=""
              className="absolute inset-y-0 right-0 h-full object-cover"
              style={{ opacity: 0.88, width: "86%", objectPosition: `${(coverImage.focalX ?? 0.5) * 100}% ${(coverImage.focalY ?? 0.5) * 100}%` }}
            />
          ) : (
            /* No photo: ghost crest on right */
            <div className="absolute inset-0 flex items-center justify-end pr-6 pointer-events-none select-none">
              <Crest className="h-3/4 w-auto text-paper/[0.04]" />
            </div>
          )}

          {/* Dark navy colour-cast (gives photo the deep blue tint) */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: "rgba(4,12,45,0.10)" }} />

          {/* Left-column gradient — photo fades into solid navy for vertical text */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "linear-gradient(to right, #04102e 0%, #04102e 14%, rgba(4,16,46,0.88) 26%, rgba(4,16,46,0.25) 48%, transparent 68%)",
          }} />

          {/* Bottom gradient — darkens lower section for readability */}
          <div className="absolute bottom-0 inset-x-0 pointer-events-none" style={{
            height: "52%",
            background: "linear-gradient(to top, rgba(3,9,26,0.82) 0%, rgba(3,9,26,0.45) 45%, transparent 100%)",
          }} />

          {/* ── Vertical club name — left strip ── */}
          <div className="absolute inset-y-0 left-0 z-10 flex items-center justify-center select-none pointer-events-none" style={{ width: "14%" }}>
            <div
              className="font-black uppercase"
              style={{
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
                fontSize: "clamp(2.2rem, 9vw, 5rem)",
                letterSpacing: "0.04em",
                lineHeight: 1,
              }}
              aria-hidden="true"
            >
              <span style={{ color: "rgba(140,165,220,0.90)" }}>DANUM </span>
              <span style={{ color: "rgba(100,195,240,0.95)" }}>BLUES</span>
            </div>
          </div>

          {/* ── Top-right: DCFC crest ── */}
          <div className="absolute top-4 right-4 z-10">
            <Crest className="h-10 w-10 sm:h-12 sm:w-12 text-paper opacity-75" />
          </div>

          {/* Competition label */}
          {fixture?.competition && (
            <div className="absolute z-10" style={{ top: "1rem", left: "16%" }}>
              <span className="bg-sky text-navy-deep text-[7px] font-bold uppercase tracking-[0.22em] px-2 py-0.5">
                {fixture.competition}
              </span>
            </div>
          )}

          {/* ── Bottom: badges + match info + sponsor logos ── */}
          <div className="absolute bottom-0 z-10 pb-3 pt-2 px-4" style={{ left: "14%", right: 0 }}>

            {/* Club badges row */}
            <div className="flex items-center gap-2.5 mb-2.5">
              <Crest className="h-11 w-11 sm:h-13 sm:w-13 text-paper shrink-0" />
              {fixture && (
                <div className="h-11 w-11 sm:h-13 sm:w-13 shrink-0 flex items-center justify-center">
                  <img
                    src={`/League Table Logos/${opponentSlug}-logo.jpg`}
                    alt={fixture.opponent}
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => { const img = e.target as HTMLImageElement; if (!img.dataset.tried) { img.dataset.tried = "1"; img.src = `/${opponentSlug}-logo.png`; } else { img.style.display = "none"; } }}
                  />
                </div>
              )}
            </div>

            {/* Match title */}
            {fixture ? (
              <div
                className="font-black text-paper uppercase leading-none mb-1"
                style={{ fontSize: "clamp(1rem, 3.8vw, 1.55rem)" }}
              >
                DCFC v {fixture.opponent}
              </div>
            ) : (
              <div className="font-black text-paper uppercase leading-none mb-1" style={{ fontSize: "clamp(1.4rem, 5vw, 2.2rem)" }}>
                Doncaster City FC
              </div>
            )}

            {/* Date + time */}
            <div className="text-paper/50 text-[9px] uppercase tracking-[0.14em] mb-2.5">
              {matchDate ?? "Official Digital Programme"}
              {kickoff ? ` · ${kickoff.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}
              {fixture && ` · ${fixture.venue ?? (fixture.homeAway === "home" ? "Marra Falcons Stadium" : "Away")}`}
            </div>

            {/* Sponsor row: cover sponsor + NCEL required logos */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Cover/principal sponsor */}
              {coverSponsor && (
                <>
                  {coverSponsor.logoFilename ? (
                    <img
                      src={variantUrl(coverSponsor.logoFilename, 240, fallbackFormatFor(coverSponsor.logoFilename))}
                      alt={coverSponsor.name}
                      className="h-5 w-auto max-w-[70px] object-contain opacity-80"
                      style={{ mixBlendMode: "screen" }}
                    />
                  ) : (
                    <span className="text-paper/50 text-[8px] font-semibold">{coverSponsor.name}</span>
                  )}
                  {isNcelGame && <div className="h-4 w-px bg-paper/15" />}
                </>
              )}
              {/* NCEL mandatory logos — small white-bg pills so coloured logos read on dark cover */}
              {isNcelGame && (
                <>
                  <span className="inline-flex items-center bg-white/90 rounded px-1.5 py-0.5">
                    <img src="/ncel/ncefl-logo.png" alt="NCEL" className="h-5 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} />
                  </span>
                  <span className="inline-flex items-center bg-white/90 rounded px-1.5 py-0.5">
                    <img src="/ncel/MacronLogoPos.png" alt="Macron" className="h-4 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} />
                  </span>
                  <span className="inline-flex items-center bg-white/90 rounded px-1.5 py-0.5">
                    <img src="/ncel/pstsport.png" alt="PST Sport" className="h-4 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} />
                  </span>
                  {isLeagueCup && (
                    <span className="inline-flex items-center bg-white/90 rounded px-1.5 py-0.5">
                      <img src="/ncel/jcpconstruction_logo_whitebg.jpg" alt="JCP Construction" className="h-5 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} />
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

        </PageFull>
      ),
    });
  }

  // ── 2. Gaffer's Thoughts ─────────────────────────────────────────────────────
  {
    const manager = firstTeamStaff.find((s) => s.role.toLowerCase().includes("manager") && !s.role.toLowerCase().includes("assistant"));
    const notes = prog.managersNotes ?? "We look forward to a great season ahead. Thank you for your continued support — it means everything to everyone at this club. Up the City!";
    pages.push({
      id: "notes",
      el: (
        <PageFull className="bg-paper flex flex-row">

          {/* ── LEFT: Full-height club information ── */}
          <div className="w-[40%] shrink-0 flex flex-col h-full overflow-hidden border-r border-line/30">

            {/* Header */}
            <div className="shrink-0 bg-navy px-3 py-2">
              <div className="text-[8px] font-black uppercase tracking-[0.2em] text-paper">Club Information</div>
            </div>

            {/* Content — full page height so text can be comfortable */}
            <div className="flex-1 min-h-0 overflow-hidden px-3 py-3 space-y-2.5 text-[7px] leading-[1.45] text-ink">

              <div>
                <div className="font-black text-[5.5px] uppercase tracking-[0.2em] text-sky-deep mb-1">Ground</div>
                <div className="text-ink/80">The Marra Falcons Stadium,<br />Church Street, Armthorpe,<br />Doncaster, DN3 3AG</div>
              </div>

              <div>
                <div className="font-black text-[5.5px] uppercase tracking-[0.2em] text-sky-deep mb-1">Club Entity</div>
                <div className="text-ink/80">Doncaster City FC Ltd. Company no. 14179792. Incorporated 17 June 2022. Affiliated to Sheffield &amp; Hallamshire County FA. Member of the Macron NCEFL Div. One.</div>
              </div>

              <div className="text-ink/70">
                <span className="font-bold text-ink">Founded:</span> 2022 &nbsp;·&nbsp;
                <span className="font-bold text-ink">Home:</span> Light Blue &amp; White &nbsp;·&nbsp;
                <span className="font-bold text-ink">Away:</span> Maroon &amp; White
              </div>

              <div>
                <div className="font-black text-[5.5px] uppercase tracking-[0.2em] text-sky-deep mb-1">Contact Details</div>
                <table className="w-full border-collapse">
                  <tbody>
                    {[
                      ["Website", "doncastercity-fc.com"],
                      ["X", "@DoncasterCityFC"],
                      ["Instagram", "@doncastercityfc"],
                      ["Facebook", "@doncastercityfc"],
                      ["TikTok", "@doncastercityfc"],
                      ["YouTube", "@DoncasterCity"],
                      ["Bluesky", "@doncastercityfc.bsky.social"],
                      ["Email", "mark@doncastercity-fc.com"],
                      ["Commercial", "jason.f@doncastercity-fc.com"],
                    ].map(([label, value]) => (
                      <tr key={label}>
                        <td className="pr-2 font-bold whitespace-nowrap align-top">{label}</td>
                        <td className="align-top text-ink/80">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <div className="font-black text-[5.5px] uppercase tracking-[0.2em] text-sky-deep mb-1">Club Officials / Staff</div>
                <table className="w-full border-collapse">
                  <tbody>
                    {[
                      ["Chairman", "Mark Chappell"],
                      ["Club Secretary", "Ian Jones"],
                      ["Match Secretary", "Lee Dickinson"],
                      ["Commercial Mgr", "Jason Fry"],
                    ].map(([label, value]) => (
                      <tr key={label}>
                        <td className="pr-2 font-bold whitespace-nowrap align-top">{label}</td>
                        <td className="align-top text-ink/80">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <div className="font-black text-[5.5px] uppercase tracking-[0.2em] text-sky-deep mb-1">Playing Staff</div>
                <table className="w-full border-collapse">
                  <tbody>
                    {[
                      ["Manager", "John Powney"],
                      ["Asst. Manager", "Josh Meade"],
                      ["1st Team Coach", "Cameron Rappit"],
                      ["Coach", "Stuart Ludlam"],
                      ["Fitness & S&C", "Jake Gregory"],
                      ["Physiotherapist", "Izzy Trevillion"],
                    ].map(([label, value]) => (
                      <tr key={label}>
                        <td className="pr-2 font-bold whitespace-nowrap align-top">{label}</td>
                        <td className="align-top text-ink/80">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>{/* closes space-y-2.5 content */}

            {/* Macron kit partner */}
            <div className="shrink-0 pt-2 border-t border-line/30 px-3 pb-2">
              <div className="font-black text-[5.5px] uppercase tracking-[0.2em] text-sky-deep mb-1.5">Official Kit Partner</div>
              <img src="/macron-sponsors.jpg" alt="Macron" className="w-full object-contain mb-1.5" />
              <p className="text-[6px] leading-[1.45] text-ink/65">At Macron, we believe sport is more than competition — it's a journey of passion and ambition. Our global reach and focus on bespoke, high-quality design differentiates us from every other sports brand. By blending professional-grade technical fabrics with refined Italian craftsmanship, we empower athletes at every stage of their journey.</p>
            </div>

          </div>{/* closes w-[40%] left column */}

          {/* ── RIGHT: Photo top, then huge heading + notes ── */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

            {/* Manager photo — confined to right column top */}
            <div className="relative shrink-0 overflow-hidden" style={{ height: "33%", background: "linear-gradient(160deg,#04102e 0%,#0a1d4a 100%)" }}>
              {manager?.photoFilename ? (
                <img
                  src={variantUrl(manager.photoFilename, 600, "jpeg")}
                  alt={manager.name ?? "Manager"}
                  className="absolute inset-0 h-full w-full object-cover object-center"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Crest className="h-24 w-24 text-paper/15" />
                </div>
              )}
              {/* Fade bottom into paper */}
              <div className="absolute bottom-0 inset-x-0 pointer-events-none" style={{ height: "30%", background: "linear-gradient(to top, #f9f8f4 0%, transparent 100%)" }} />
              {/* DCFC crest top-left */}
              <div className="absolute top-3 left-3 z-10">
                <Crest className="h-7 w-7 text-paper/60" />
              </div>
            </div>

            {/* Heading + notes + sign-off */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-4 pb-3">

              {/* Heading — sized to fill the right column without overflowing */}
              <div className="shrink-0 leading-none mb-2">
                <span
                  className="font-black uppercase text-navy"
                  style={{ fontSize: "clamp(1.3rem, 4vw, 2.6rem)", letterSpacing: "-0.025em", lineHeight: 0.87 }}
                >
                  GAFFER'S<br />THOUGHTS
                </span>
              </div>

              {/* Notes — two columns */}
              <div
                className="flex-1 min-h-0 overflow-hidden text-[8px] leading-relaxed text-ink"
                style={{ columnCount: 2, columnGap: "1rem" }}
              >
                {notes.split("\n\n").map((para, i) => (
                  <p key={i} className="mb-2 break-inside-avoid">{para}</p>
                ))}
              </div>

              {/* Sign-off */}
              <div className="shrink-0 text-right mt-1 pt-1 border-t border-line/50">
                <div className="text-[9px] font-bold text-navy italic">{manager?.name ?? "The Gaffer"}</div>
                <div className="text-[7px] uppercase tracking-[0.18em] text-mute">{manager?.role ?? "Manager"}, Doncaster City FC</div>
              </div>

            </div>
          </div>

        </PageFull>
      ),
    });
  }

  // ── 3. Platinum / principal sponsors ─────────────────────────────────────────
  platinumSponsors.forEach((s) => {
    const smileLink = s.url ?? (s.name.toLowerCase().includes("smile") ? "https://smilethaimassage.co.uk/" : null);
    const isSmile = s.name.toLowerCase().includes("smile");
    const treatments = [
      { name: "Thai Deep Tissue Massage", duration: "60 min", price: "£40" },
      { name: "Sports Massage", duration: "60 min", price: "£40" },
      { name: "Pregnancy Massage", duration: "60 min", price: "£40" },
      { name: "Indian Head Massage", duration: "45 min", price: "£35" },
      { name: "Reflexology", duration: "60 min", price: "£40" },
      { name: "Any 90-Minute Treatment", duration: "90 min", price: "£60" },
    ];
    const reviews = [
      { text: "I walked in with a nagging lower back ache and walked out feeling like I was walking on air.", source: "Google" },
      { text: "Best value for money I've seen. Relief from chronic back pain after just one session.", source: "TripAdvisor" },
      { text: "Fantastic place, incredibly skilled therapists. I've been going for years and it never disappoints.", source: "Facebook" },
    ];
    pages.push({
      id: `platinum-${s.id}`,
      el: (
        <PageFull className="overflow-hidden relative" style={{ background: "#110810" }}>
          {isSmile ? (
            <>
              <img
                src="/sponsors/smile-thai-advert.jpg"
                alt="Smile Thai Massage — Principal Partner"
                className="h-full w-full object-contain object-top"
              />
              {smileLink && (
                <a
                  href={smileLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full px-4 py-2 text-[9px] font-bold uppercase tracking-[0.15em] shadow-lg"
                  style={{ background: "#c8922a", color: "#110810" }}
                >
                  Book Now ↗
                </a>
              )}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-4 px-8">
              {s.logoFilename && (
                <div className="bg-white rounded px-4 py-3 shadow-lg">
                  <img src={variantUrl(s.logoFilename, 400, fallbackFormatFor(s.logoFilename))} alt={s.name} className="h-16 w-auto max-w-[140px] object-contain" />
                </div>
              )}
              <div className="text-center">
                <div className="font-black uppercase text-white text-2xl">{s.name}</div>
                <div className="text-xs mt-1" style={{ color: "#c8922a" }}>Principal Partner · Doncaster City FC</div>
              </div>
              {smileLink && (
                <a href={smileLink} target="_blank" rel="noopener noreferrer" className="text-xs text-white/60 underline">{smileLink}</a>
              )}
            </div>
          )}
        </PageFull>
      ),
    });
  });

  // ── 4. Fixtures ───────────────────────────────────────────────────────────────
  pages.push({
    id: "fixtures",
    el: (
      <PageScroll className="bg-paper-warm px-6 py-10 sm:px-10 sm:py-12">
        <SectionHeader eyebrow="2026/27 Season" title="Fixtures & results." className="mb-7" />
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
        <PageFull className="bg-paper-warm flex flex-col">
          <div className="shrink-0 px-4 pt-3 pb-2 border-b border-line flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-sky-deep font-bold mb-0.5">
                {leagueSnapshot.data.competition?.name ?? "League"}
              </div>
              <div className="font-serif text-navy text-xl leading-tight">League table.</div>
            </div>
            <img src="/ncel/ncefl-logo.png" alt="NCEL" className="h-14 w-auto shrink-0 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-center">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-navy text-paper text-[7px] uppercase tracking-[0.12em]">
                  <th className="px-1.5 py-1 text-left w-6 font-semibold">#</th>
                  <th className="w-5 py-1"></th>
                  <th className="px-1.5 py-1 text-left font-semibold">Club</th>
                  <th className="px-1.5 py-1 text-center w-6 font-semibold">P</th>
                  <th className="px-1.5 py-1 text-center w-6 font-semibold">W</th>
                  <th className="px-1.5 py-1 text-center w-6 font-semibold">D</th>
                  <th className="px-1.5 py-1 text-center w-6 font-semibold">L</th>
                  <th className="px-1.5 py-1 text-center w-7 font-semibold">GD</th>
                  <th className="px-1.5 py-1 text-center w-7 font-semibold">Pts</th>
                </tr>
              </thead>
              <tbody>
                {leagueSnapshot.data.teams.map((team, i) => {
                  const isDcfc = team.name.toLowerCase().includes("doncaster city");
                  const logoSlug = team.name.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
                  const logoSrc = `/League%20Table%20Logos/${logoSlug}-logo.jpg`;
                  return (
                    <tr key={team.id} className={["border-b border-line/40", isDcfc ? "bg-sky/10" : i % 2 === 0 ? "bg-paper/60" : ""].join(" ")}>
                      <td className="px-1.5 py-0.5 text-[8px] text-mute tabular-nums">{team.position}</td>
                      <td className="py-0.5 w-5">
                        <img src={logoSrc} alt="" aria-hidden="true" className="h-4 w-4 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }} />
                      </td>
                      <td className="px-1.5 py-0.5 text-[8px]">
                        <span className={isDcfc ? "text-navy font-semibold" : "text-ink"}>{isDcfc ? "Doncaster City" : team.name}</span>
                      </td>
                      <td className="px-1.5 py-0.5 text-center text-[8px] tabular-nums text-mute">{team["all-matches"].played}</td>
                      <td className="px-1.5 py-0.5 text-center text-[8px] tabular-nums text-mute">{team["all-matches"].won}</td>
                      <td className="px-1.5 py-0.5 text-center text-[8px] tabular-nums text-mute">{team["all-matches"].drawn}</td>
                      <td className="px-1.5 py-0.5 text-center text-[8px] tabular-nums text-mute">{team["all-matches"].lost}</td>
                      <td className="px-1.5 py-0.5 text-center text-[8px] tabular-nums text-mute">
                        {team["all-matches"]["goal-difference"] > 0 ? "+" : ""}{team["all-matches"]["goal-difference"]}
                      </td>
                      <td className="px-1.5 py-0.5 text-center text-[8px] tabular-nums font-bold text-navy">{team["total-points"]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="shrink-0 bg-navy/4 border-t border-line px-4 py-1.5 flex items-center justify-between">
            <Crest className="h-3 w-3 text-navy/20" />
            <span className="text-[7px] uppercase tracking-[0.2em] text-mute/60">doncastercity-fc.com</span>
          </div>
        </PageFull>
      ),
    });
  }

  // ── 5b. Smokeys dedicated page ────────────────────────────────────────────────
  {
    const smokeysSponsor = goldSponsors.find((s) => s.name.toLowerCase().includes("smokey"));
    if (smokeysSponsor) {
      pages.push({
        id: "smokeys",
        el: (
          <PageFull className="flex flex-col justify-between px-5 py-4" style={{ background: "#0e1f44" }}>
            <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-white/20 pointer-events-none" />
            <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-white/20 pointer-events-none" />
            <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-white/20 pointer-events-none" />
            <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-white/20 pointer-events-none" />

            {/* Header */}
            <div className="text-center">
              <div className="text-[8px] uppercase tracking-[0.4em] text-white/40 mb-2">Official Partner · DCFC</div>
              <div className="h-px bg-white/15 mb-3" />
              <div className="font-black uppercase text-white leading-none" style={{ fontSize: "clamp(2.2rem, 10vw, 3.4rem)", letterSpacing: "-0.02em" }}>Smokeys</div>
              <div className="font-black uppercase text-[#f6bc3a] leading-none mt-1" style={{ fontSize: "clamp(0.85rem, 4vw, 1.3rem)", letterSpacing: "0.04em" }}>Banging Food, Fast</div>
              <div className="h-px bg-white/15 mt-3" />
            </div>

            {/* Logo + tagline */}
            <div className="flex items-center gap-4">
              {smokeysSponsor.logoFilename && (
                <img src={variantUrl(smokeysSponsor.logoFilename, 400, fallbackFormatFor(smokeysSponsor.logoFilename))} alt={smokeysSponsor.name} className="h-20 w-20 object-contain shrink-0" />
              )}
              <p className="font-serif text-white/80 leading-relaxed" style={{ fontSize: "clamp(0.7rem, 3vw, 0.9rem)", fontStyle: "italic" }}>
                Want a mouthwateringly healthy takeaway experience? Discover Smokey&apos;s Grill — an award-winning takeaway where tradition meets innovation.
              </p>
            </div>

            {/* Rating badges */}
            <div className="flex items-stretch gap-2">
              <div className="flex-1 bg-white/8 border border-white/15 rounded-lg flex flex-col items-center justify-center py-3 px-1 gap-1">
                <div className="font-black text-[16px] leading-none" style={{ background: "linear-gradient(135deg,#4285F4,#EA4335,#FBBC05,#34A853)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>G</div>
                <div className="text-[#f6bc3a] text-[10px] leading-none">★★★★★</div>
                <div className="text-white/50 text-[7px] uppercase tracking-wide font-bold">Google</div>
              </div>
              <div className="flex-1 bg-white/8 border border-white/15 rounded-lg flex flex-col items-center justify-center py-3 px-1 gap-1">
                <div className="font-black text-[14px] leading-none" style={{ color: "#34c77b" }}>TA</div>
                <div className="text-[#f6bc3a] text-[10px] leading-none">★★★★★</div>
                <div className="text-white/50 text-[7px] uppercase tracking-wide font-bold">TripAdvisor</div>
              </div>
              <div className="flex-1 bg-white/8 border border-white/15 rounded-lg flex flex-col items-center justify-center py-3 px-1 gap-1">
                <div className="font-black text-[22px] leading-none" style={{ color: "#34c77b" }}>5</div>
                <div className="text-white/50 text-[6.5px] uppercase tracking-wide font-bold leading-tight text-center">Food Hygiene Rating</div>
              </div>
              <div className="flex-1 bg-white/8 border border-white/15 rounded-lg flex flex-col items-center justify-center py-3 px-1 gap-1">
                <div className="text-[#f6bc3a] text-[18px] leading-none">★</div>
                <div className="text-white/50 text-[6.5px] uppercase tracking-wide font-bold leading-tight text-center">Good Food Award</div>
              </div>
            </div>

            {/* Review */}
            <div className="bg-white/8 border border-white/15 rounded-lg px-3.5 py-3">
              <div className="text-[#f6bc3a] text-[11px] mb-1">★★★★★</div>
              <p className="text-white/80 text-[9px] leading-relaxed italic">"Absolutely outstanding. Best burger in Doncaster, hands down. The food is always fresh, hot, and cooked exactly as ordered."</p>
              <div className="text-white/35 text-[7px] mt-1 uppercase tracking-wide">Google Review</div>
            </div>

            {/* Contact details */}
            <div className="bg-white/8 border border-white/15 rounded-lg px-3.5 py-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
              <div className="flex items-start gap-1.5">
                <span className="text-white/40 text-[9px] mt-px shrink-0">📍</span>
                <span className="text-white/80 text-[8px] leading-tight">32 Netherhall Road, Doncaster DN1 2PW · Retford</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-white/40 text-[9px] shrink-0">📞</span>
                <span className="text-white/80 text-[8px]">01302 811 909</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-white/40 text-[9px] shrink-0">🕐</span>
                <span className="text-white/80 text-[8px]">Mon–Sun, 11am–11pm</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-white/40 text-[9px] shrink-0">✉</span>
                <span className="text-white/80 text-[8px]">info@smokeys.online</span>
              </div>
            </div>

            {/* CTA */}
            {smokeysSponsor.url && (
              <a href={smokeysSponsor.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-[#f6bc3a] text-[#0e1f44] py-3.5 text-[10px] font-black uppercase tracking-widest hover:bg-[#e8a020] transition-colors rounded-sm">
                Order Online at smokeys.online ↗
              </a>
            )}

            <div className="flex items-center justify-center gap-3">
              <div className="h-px w-10 bg-white/15" />
              <Crest className="h-3.5 w-3.5 text-white/20" />
              <div className="h-px w-10 bg-white/15" />
            </div>
          </PageFull>
        ),
      });

    }
  }

  // ── 6. Gold / official sponsors (2 per page) ──────────────────────────────────
  const SPONSOR_DESCRIPTIONS: Record<string, string> = {
    "Smokeys": "Three generations of fast food passion — and Smokeys is where it all comes together. Founded in 2019 by a family whose grandfather launched Starburger back in the 1970s, Smokeys set out to prove that fast food can be genuinely good. At their Nether Hall Road restaurant in Doncaster and their Retford location, they serve up proper grilled food: burgers, wraps, pizzas, salmon, and more — made with quality ingredients, every single time.\n\nThe results speak for themselves. Smokeys hold a five-star food hygiene rating and were recognised with a 2025 Good Food Award for quality, taste, and service excellence. Whether you're heading in for a sit-down or ordering online, you're in for a treat. Visit smokeys.online to order now.",
    "Visit Bawtry": "A community platform celebrating the independent businesses and attractions of one of South Yorkshire's most charming market towns. From great restaurants and independent shops to events and entertainment, Visit Bawtry connects locals and visitors with the very best the town has to offer.",
    "Green Electrical & Plumbing Supplies": "A comprehensive trade supplier serving the local community with an extensive range of bathroom fixtures, heating systems, plumbing materials, and electrical products for professionals and homeowners alike. As a member of The IPG, they combine local accessibility with industry-wide support — the team to call when you need to get the job done.",
    "Alt Rubber and Plastics": "A UK-based manufacturer specialising in high-quality polyurethane and polyethylene components for industries including mining, offshore, and automotive. This family-run business delivers bespoke solutions from design to finished component, with precise engineering and efficient turnaround times without ever compromising on quality.",
    "Eland Cables": "A leading European supplier of cables and cable accessories, trusted by industries from renewable energy to rail, data centres, and oil & gas. Backed by world-class testing facilities and a 99% on-time delivery record, Eland Cables combines deep technical expertise with an unwavering commitment to quality.",
    "AAY": "Chartered accounting support for Yorkshire business owners. Proud sponsors of Doncaster City FC. Visit accability.co.uk to find out more about what they do and how they can help you.",
  };

  const nonSmokeysGold = goldSponsors.filter((s) => !s.name.toLowerCase().includes("smokey"));
  for (let gi = 0; gi < nonSmokeysGold.length; gi += 2) {
    const pair = nonSmokeysGold.slice(gi, gi + 2);
    pages.push({
      id: `gold-${gi}`,
      el: (
        <PageFull className="bg-paper flex flex-col">
          {/* Page header */}
          <div className="shrink-0 px-5 pt-5 pb-3 border-b border-line flex items-end justify-between">
            <div>
              <div className="text-[8px] uppercase tracking-[0.3em] text-sky-deep font-semibold mb-0.5">Official Partners</div>
              <div className="font-serif text-navy text-lg leading-tight">Our sponsors.</div>
            </div>
            {gi > 0 && <div className="text-[8px] uppercase tracking-[0.2em] text-mute">Continued</div>}
          </div>

          {/* Sponsor cards */}
          <div className="flex-1 flex flex-col divide-y divide-line min-h-0 overflow-hidden">
            {pair.map((s) => {
              const desc = SPONSOR_DESCRIPTIONS[s.name] ?? null;
              const logoFmt = s.logoFilename ? fallbackFormatFor(s.logoFilename) : "jpeg";
              return (
                <div key={s.id} className="flex-1 flex flex-col justify-center px-6 py-5 gap-3 min-h-0">
                  {/* Logo + name row */}
                  <div className="flex items-center gap-4">
                    {s.logoFilename && (
                      <div className="shrink-0 h-10 w-28 flex items-center">
                        <img
                          src={variantUrl(s.logoFilename, 240, logoFmt)}
                          alt={s.name}
                          className="max-h-full max-w-full object-contain object-left"
                        />
                      </div>
                    )}
                    <div>
                      <div className="font-serif text-lg text-navy leading-tight">{s.name}</div>
                      <div className="text-[8px] uppercase tracking-[0.2em] text-mute mt-0.5">Official Partner · Doncaster City FC</div>
                    </div>
                  </div>
                  {/* Description */}
                  {desc && (
                    <div className="space-y-2">
                      {desc.split("\n\n").map((para, i) => (
                        <p key={i} className="text-xs text-ink/70 leading-relaxed">{para}</p>
                      ))}
                    </div>
                  )}
                  {/* Link */}
                  {s.url && (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-sky-deep underline underline-offset-2 hover:text-navy transition-colors"
                    >
                      {s.url.replace(/^https?:\/\/(www\.)?/, "")} ↗
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          <div className="shrink-0 bg-navy/4 border-t border-line px-4 py-2 flex items-center justify-between">
            <Crest className="h-3.5 w-3.5 text-navy/20" />
            <span className="text-[7px] uppercase tracking-[0.2em] text-mute/60">doncastercity-fc.com</span>
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
        <PageFull className="bg-navy-deep flex flex-row">
          {/* Left: tall portrait photo */}
          <div className="w-[52%] relative overflow-hidden shrink-0">
            {featuredPlayer.spotlightFilename ? (
              <img
                src={variantUrl(featuredPlayer.spotlightFilename, 600, "jpeg")}
                alt={featuredPlayer.name}
                className="absolute inset-0 h-full w-full object-cover"
                style={{ objectPosition: `${(featuredPlayer.spotlightFocalX ?? 0.5) * 100}% ${(featuredPlayer.spotlightFocalY ?? 0.5) * 100}%` }}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-navy to-navy-deep flex items-center justify-center">
                <Crest className="h-2/3 w-auto text-paper/8" />
              </div>
            )}
            {/* Fade right edge into dark bg */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-navy-deep/80" />
            {/* Fade bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-navy-deep to-transparent" />
            {/* Position label bottom-left */}
            {(featuredPlayer.position || featuredPlayer.position2) && (
              <div className="absolute bottom-4 left-4 text-[8px] uppercase tracking-[0.2em] text-sky/70 font-semibold">
                {[featuredPlayer.position, featuredPlayer.position2].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>

          {/* Right: player info — name badge at top */}
          <div className="flex-1 flex flex-col px-4 py-5 min-w-0">
            {/* Eyebrow */}
            <div className="text-[7px] uppercase tracking-[0.3em] text-sky font-semibold mb-3">Player Spotlight</div>

            {/* Ghost shirt number */}
            {featuredPlayer.shirtNumber && (
              <div
                className="text-paper/[0.07] leading-none select-none -mb-3"
                style={{ fontFamily: "var(--font-display)", fontSize: "clamp(3.5rem, 14vw, 7rem)" }}
                aria-hidden="true"
              >
                {featuredPlayer.shirtNumber}
              </div>
            )}

            {/* Name badge */}
            <h2
              className="font-serif text-paper leading-tight mb-4"
              style={{ fontSize: "clamp(1.3rem, 4vw, 2rem)" }}
            >
              {featuredPlayer.name}
            </h2>

            {/* Divider */}
            <div className="w-8 h-px bg-sky/40 mb-4" />

            {/* Bio */}
            {featuredPlayer.bio ? (
              <div className="space-y-2.5">
                {featuredPlayer.bio.split("\n\n").slice(0, 4).map((para, i) => (
                  <p key={i} className="text-paper/55 text-[10px] leading-relaxed">{para}</p>
                ))}
              </div>
            ) : (
              <p className="text-paper/30 text-[10px] italic">Bio coming soon.</p>
            )}

            {/* Player sponsors */}
            {(featuredPlayer.sponsor1Name || featuredPlayer.sponsor2Name) && (() => {
              const slots = [
                { name: featuredPlayer.sponsor1Name, url: featuredPlayer.sponsor1Url, description: featuredPlayer.sponsor1Description, logo: featuredPlayer.sponsor1LogoFilename },
                { name: featuredPlayer.sponsor2Name, url: featuredPlayer.sponsor2Url, description: featuredPlayer.sponsor2Description, logo: featuredPlayer.sponsor2LogoFilename },
              ].filter((s) => s.name);
              const two = slots.length === 2;
              return (
                <div className="mt-auto pt-4">
                  <div className="border-t border-white/10 pt-4">
                    <div className="text-[7px] uppercase tracking-[0.3em] text-sky/50 font-semibold mb-3">Player sponsor{two ? "s" : ""}</div>
                    {two ? (
                      /* Two sponsors — side by side, each stacked vertically */
                      <div className="grid grid-cols-2 gap-3">
                        {slots.map((s, i) => (
                          <div key={i} className="flex flex-col gap-1.5">
                            {s.logo && (
                              <div className="w-full h-9 bg-white/90 flex items-center justify-center p-1.5">
                                <img src={variantUrl(s.logo, 120, "avif")} alt={s.name ?? ""} className="max-h-full max-w-full object-contain" />
                              </div>
                            )}
                            {s.url ? (
                              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-semibold text-paper/90 hover:text-sky leading-tight">
                                {s.name}
                              </a>
                            ) : (
                              <span className="text-[10px] font-semibold text-paper/90 leading-tight">{s.name}</span>
                            )}
                            {s.description && (
                              <p className="text-[8.5px] text-paper/45 leading-snug">{s.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* One sponsor — logo left, name + description right */
                      slots.map((s, i) => (
                        <div key={i} className="flex items-center gap-3">
                          {s.logo && (
                            <div className="shrink-0 w-14 h-10 bg-white/90 flex items-center justify-center p-1.5">
                              <img src={variantUrl(s.logo, 120, "avif")} alt={s.name ?? ""} className="max-h-full max-w-full object-contain" />
                            </div>
                          )}
                          <div className="min-w-0">
                            {s.url ? (
                              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-paper/90 hover:text-sky leading-tight block truncate">
                                {s.name}
                              </a>
                            ) : (
                              <span className="text-[11px] font-semibold text-paper/90 leading-tight block truncate">{s.name}</span>
                            )}
                            {s.description && (
                              <p className="text-[9px] text-paper/45 leading-snug mt-0.5">{s.description}</p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Footer */}
            {!(featuredPlayer.sponsor1Name || featuredPlayer.sponsor2Name) && (
              <div className="mt-auto flex items-center gap-2 pt-4">
                <Crest className="h-3.5 w-3.5 text-paper/15" />
                <span className="text-[7px] uppercase tracking-[0.2em] text-paper/15">Doncaster City FC</span>
              </div>
            )}
          </div>
        </PageFull>
      ),
    });
  }

  // ── 8. Know Your Enemy ───────────────────────────────────────────────────────
  if (prog.oppositionProfile || fixture?.opponent) {
    const opponentName = fixture?.opponent ?? "Today's Opponents";
    const opponentParts = opponentName.split(" ");
    const opponentLast = opponentParts.length > 1 ? opponentParts.pop()! : null;
    const opponentFirst = opponentParts.join(" ");
    const opponentSlug = opponentName.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
    pages.push({
      id: "opposition",
      el: (
        <PageFull className="flex flex-col" style={{ background: "#0d1120" }}>
          {/* Ghost badge — large, pinned to bottom centre */}
          <div className="absolute bottom-0 inset-x-0 pointer-events-none select-none overflow-hidden flex items-end justify-center">
            <img src={`/League Table Logos/${opponentSlug}-logo.jpg`} alt="" className="w-[75%] max-w-[300px] object-contain opacity-[0.22]" style={{ filter: "grayscale(1) invert(1)" }}
              onError={(e) => { const img = e.target as HTMLImageElement; if (!img.dataset.tried) { img.dataset.tried = "1"; img.src = `/${opponentSlug}-logo.png`; } else { img.style.display = "none"; } }} />
          </div>

          {/* Top accent line */}
          <div className="shrink-0 h-0.5 bg-gradient-to-r from-transparent via-white/30 to-transparent" />

          {/* Editorial header */}
          <div className="shrink-0 px-5 pt-5 pb-4">
            <div className="text-[7px] uppercase tracking-[0.45em] font-semibold mb-3" style={{ color: "rgba(255,255,255,0.55)" }}>
              Today's Opponents
            </div>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-serif leading-none" style={{ color: "rgba(255,255,255,0.97)", fontSize: "clamp(2.2rem, 8vw, 4rem)" }}>
                {opponentLast ? (
                  <>
                    <span className="block">{opponentFirst}</span>
                    <span className="block">{opponentLast}</span>
                  </>
                ) : opponentFirst}
              </h2>
              <img src={`/League Table Logos/${opponentSlug}-logo.jpg`} alt={opponentName}
                className="h-16 w-16 object-contain shrink-0 mt-1"
                onError={(e) => { const img = e.target as HTMLImageElement; if (!img.dataset.tried) { img.dataset.tried = "1"; img.src = `/${opponentSlug}-logo.png`; } else { img.style.display = "none"; } }} />
            </div>
            <div className="shrink-0 mx-0 mt-3 h-px" style={{ background: "rgba(255,255,255,0.15)" }} />
          </div>

          {/* Write-up */}
          <div className="flex-1 min-h-0 overflow-hidden px-5 py-3">
            <div className="space-y-2.5">
              {(prog.oppositionProfile ?? "").split("\n\n").filter(Boolean).map((para, i) => (
                <p key={i} className={`leading-relaxed ${i === 0 ? "font-medium" : ""}`}
                  style={{
                    fontSize: i === 0 ? "10.5px" : "9px",
                    color: i === 0 ? "rgba(255,255,255,0.93)" : "rgba(255,255,255,0.70)",
                    borderLeft: i === 0 ? "2px solid rgba(255,255,255,0.35)" : "none",
                    paddingLeft: i === 0 ? "10px" : "0",
                  }}
                >
                  {para}
                </p>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 px-5 py-1.5 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
            <Crest className="h-3 w-3 text-white/20" />
            <span className="text-[7px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.30)" }}>doncastercity-fc.com</span>
          </div>
        </PageFull>
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
          <div className="space-y-5">
            {silverSponsors.map((s) => {
              const desc = SPONSOR_DESCRIPTIONS[s.name] ?? null;
              const logoFmt = s.logoFilename ? fallbackFormatFor(s.logoFilename) : "jpeg";
              return (
                <div key={s.id} className="border border-line p-4 sm:p-5 flex gap-4 items-start">
                  {s.logoFilename && (
                    <div className="shrink-0 h-10 w-20 flex items-center">
                      <img src={variantUrl(s.logoFilename, 240, logoFmt)} alt={s.name} className="max-h-full max-w-full object-contain object-left" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-navy text-sm leading-tight mb-0.5">{s.name}</div>
                    <div className="text-[8px] uppercase tracking-[0.18em] text-mute mb-2">Club Partner · Doncaster City FC</div>
                    {desc && <p className="text-xs text-ink/70 leading-relaxed mb-2">{desc}</p>}
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] text-sky-deep underline underline-offset-2 hover:text-navy">
                        {s.url.replace(/^https?:\/\/(www\.)?/, "")} ↗
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </PageScroll>
      ),
    });
  }

  // ── 10. Sponsor the Pitch ─────────────────────────────────────────────────────
  pages.push({
    id: "pitch",
    el: (
      <PageFull className="bg-navy flex flex-col">
        {/* Header */}
        <div className="shrink-0 px-5 pt-5 pb-3 border-b border-paper/10">
          <div className="text-[8px] uppercase tracking-[0.3em] text-sky font-semibold mb-0.5">Marra Falcons Stadium</div>
          <div className="font-serif text-paper text-lg leading-tight">Sponsor a pitch square.</div>
        </div>

        {/* Live pitch grid */}
        <div className="flex-1 flex items-center justify-center px-4 py-3 min-h-0">
          <div className="w-full relative" style={{ aspectRatio: "15/10", maxHeight: "100%" }}>
            {/* Grass background */}
            <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, #1e6b30 0%, #256b34 40%, #1e6b30 100%)" }} />
            {/* Pitch markings */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 150 100" preserveAspectRatio="none" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.7">
              <rect x="0.5" y="0.5" width="149" height="99" />
              <line x1="75" y1="0" x2="75" y2="100" />
              <circle cx="75" cy="50" r="13" />
              <circle cx="75" cy="50" r="0.8" fill="rgba(255,255,255,0.25)" stroke="none" />
              <rect x="0" y="27" width="16" height="46" />
              <rect x="134" y="27" width="16" height="46" />
              <rect x="0" y="36" width="5.5" height="28" />
              <rect x="144.5" y="36" width="5.5" height="28" />
            </svg>
            {/* 15×10 sponsor grid */}
            <div
              className="absolute inset-0 grid"
              style={{ gridTemplateColumns: "repeat(15, 1fr)", gridTemplateRows: "repeat(10, 1fr)" }}
            >
              {Array.from({ length: 10 }, (_, ri) =>
                Array.from({ length: 15 }, (_, ci) => {
                  const row = ri + 1;
                  const col = ci + 1;
                  const sp = getSponsorAt(row, col);
                  const cellClass = [
                    "border border-white/8 flex items-center justify-center overflow-hidden",
                    sp
                      ? sp.tier === "platinum" ? "bg-yellow-300/20"
                      : sp.tier === "gold" ? "bg-amber-300/15"
                      : "bg-sky/15"
                      : "hover:bg-white/10 transition-colors cursor-pointer",
                  ].join(" ");
                  const inner = sp ? (
                    sp.logo
                      ? <img src={sp.logo} alt={sp.name} className="w-full h-full object-contain p-px opacity-85" />
                      : <span className="text-white/80 font-bold leading-tight text-center px-px" style={{ fontSize: "3.5px" }}>{sp.name}</span>
                  ) : null;
                  return sp ? (
                    <div key={`${row}-${col}`} className={cellClass}>{inner}</div>
                  ) : (
                    <Link key={`${row}-${col}`} to={`/pitch?row=${row}&col=${col}`} className={cellClass} tabIndex={-1} />
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Write-up + CTA */}
        <div className="shrink-0 px-5 pb-4 space-y-3">
          <p className="text-paper/55 text-[9px] leading-relaxed">
            Every square on the Marra Falcons Stadium pitch can carry your name or business. Revenue goes directly into the club — helping us develop our players, improve our facilities, and invest in our future. Platinum, gold, and silver squares are available.
          </p>
          <a
            href="/pitch"
            className="inline-flex items-center gap-2 bg-sky text-navy-deep px-4 py-1.5 font-semibold text-[9px] uppercase tracking-wide hover:bg-paper transition-colors"
          >
            Sponsor a square →
          </a>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-paper/10 px-4 py-1.5 flex items-center justify-between">
          <Crest className="h-3 w-3 text-paper/20" />
          <span className="text-[7px] uppercase tracking-[0.2em] text-paper/20">doncastercity-fc.com</span>
        </div>
      </PageFull>
    ),
  });

  // ── 10b. Chairman's Notes ─────────────────────────────────────────────────────
  if (prog.chairmansNotes) {
    pages.push({
      id: "thoughts",
      el: (
        <PageFull className="bg-paper flex flex-col">

          {/* Page header */}
          <div className="shrink-0 flex items-center gap-3 px-5 pt-4 pb-3 border-b border-line">
            <div className="flex-1 h-px bg-navy/30" />
            <div className="text-[7px] uppercase tracking-[0.45em] font-semibold text-navy/70">Thoughts from the Club</div>
            <div className="flex-1 h-px bg-navy/30" />
          </div>

          {/* Chairman's Notes — top section */}
          <div className={`${chairmansNotesImage ? "shrink-0" : "flex-1"} min-h-0 flex flex-col px-5 pt-3 pb-2 overflow-hidden`} style={chairmansNotesImage ? { height: "55%" } : undefined}>
            <div className="shrink-0 flex items-start justify-between mb-2">
              <div>
                <div className="text-[7px] uppercase tracking-[0.35em] text-sky-deep font-black mb-0.5">Chairman's Notes</div>
                <div className="font-serif text-navy font-bold leading-tight" style={{ fontSize: "clamp(0.95rem, 3vw, 1.3rem)" }}>Mark Chappell</div>
              </div>
              <div className="font-serif text-navy/20 leading-none select-none shrink-0" style={{ fontSize: "3rem", marginTop: "-0.25rem" }}>"</div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden text-[9.5px] leading-relaxed text-ink" style={{ columnCount: 2, columnGap: "1rem", columnFill: "balance" }}>
              {(prog.chairmansNotes ?? "").split("\n\n").filter(Boolean).map((para, i) => (
                <p key={i} className="mb-2.5">{para}</p>
              ))}
            </div>
          </div>

          {/* Bottom image — shown when set */}
          {chairmansNotesImage && (
            <div className="shrink-0 border-t border-line flex flex-col overflow-hidden" style={{ height: "45%" }}>
              {prog.chairmansNotesImageCaption && (
                <div className="shrink-0 px-5 py-2 bg-navy/5 border-b border-line">
                  <p className="text-[8.5px] italic text-navy/80 leading-snug">{prog.chairmansNotesImageCaption}</p>
                </div>
              )}
              <div className="flex-1 min-h-0 overflow-hidden">
                <img
                  src={variantUrl(chairmansNotesImage.filename, 1200, "jpeg")}
                  alt={prog.chairmansNotesImageCaption ?? ""}
                  className="w-full h-full object-cover"
                  style={{ objectPosition: `${(chairmansNotesImage.focalX ?? 0.5) * 100}% ${(chairmansNotesImage.focalY ?? 0.5) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="shrink-0 border-t border-line px-4 py-1.5 flex items-center justify-between">
            <Crest className="h-3 w-3 text-navy/20" />
            <span className="text-[7px] uppercase tracking-[0.2em] text-mute/60">doncastercity-fc.com</span>
          </div>

        </PageFull>
      ),
    });
  }

  // ── 11. Squad pages — two non-scrolling pages, 10 players each ───────────────
  {
    const squadSorted = firstTeamPlayers
      .slice()
      .sort((a, b) => (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99));

    // 10 slots per page (5 per column). Pad the last page with nulls so cards stay equal height.
    const PLAYERS_PER_PAGE = 10;
    const pad = (arr: typeof squadSorted, n: number) => [...arr, ...Array(Math.max(0, n - arr.length)).fill(null)] as (typeof squadSorted[number] | null)[];
    const totalPages = Math.max(1, Math.ceil(squadSorted.length / PLAYERS_PER_PAGE));
    const squadPages = Array.from({ length: totalPages }, (_, i) =>
      pad(squadSorted.slice(i * PLAYERS_PER_PAGE, (i + 1) * PLAYERS_PER_PAGE), PLAYERS_PER_PAGE)
    );
    const EmptySlot = () => (
      <div className="flex-1 flex gap-2.5 px-2.5 py-2 border-b border-line/20 last:border-0 min-h-0 overflow-hidden opacity-25">
        <div className="w-11 shrink-0 bg-navy/5 rounded-sm self-stretch border border-dashed border-navy/20" />
        <div className="flex-1 flex flex-col justify-center gap-1">
          <div className="h-2 w-14 bg-navy/10 rounded" />
          <div className="h-1.5 w-8 bg-navy/10 rounded" />
        </div>
      </div>
    );

    const PlayerCard = ({ p }: { p: typeof squadSorted[number] }) => (
      <div className="flex-1 flex gap-2.5 px-2.5 py-2 border-b border-line/50 last:border-0 min-h-0 overflow-hidden">
        {/* Portrait photo — fills card height */}
        <div className="w-11 shrink-0 relative overflow-hidden bg-navy/8 rounded-sm self-stretch">
          {p.photoFilename ? (
            <img
              src={variantUrl(p.photoFilename, 240, fallbackFormatFor(p.photoFilename))}
              alt={p.name}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: `${(p.photoFocalX ?? 0.5) * 100}% ${(p.photoFocalY ?? 0.5) * 100}%` }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-navy to-navy-deep flex items-center justify-center">
              {p.shirtNumber != null && (
                <span style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem" }} className="text-paper/15 leading-none">
                  {p.shirtNumber}
                </span>
              )}
            </div>
          )}
        </div>
        {/* Text info — flex-col to use full card height */}
        <div className="flex-1 min-w-0 flex flex-col justify-between overflow-hidden">
          <div>
            <div className="flex items-baseline gap-1 leading-none mb-0.5">
              {p.shirtNumber != null && (
                <span style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem" }} className="text-navy/25 tabular-nums shrink-0">
                  {p.shirtNumber}
                </span>
              )}
              <span className="text-[10px] font-semibold text-navy truncate leading-tight">{p.name}</span>
            </div>
            {p.position && (
              <div className="text-[7px] uppercase tracking-[0.12em] text-mute leading-none mb-1">{p.position}</div>
            )}
            {p.bio && (
              <p className="text-[8px] text-ink/55 leading-snug line-clamp-4">{p.bio}</p>
            )}
          </div>
          {(p.sponsor1Name || p.sponsor2Name) && (
            <div className="flex flex-col gap-0.5 mt-1 shrink-0">
              {[
                { name: p.sponsor1Name, url: p.sponsor1Url, logo: p.sponsor1LogoFilename },
                { name: p.sponsor2Name, url: p.sponsor2Url, logo: p.sponsor2LogoFilename },
              ].filter((s) => s.name).map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  {s.logo && (
                    <img
                      src={variantUrl(s.logo, 120, fallbackFormatFor(s.logo))}
                      alt={s.name!}
                      className="h-3.5 w-auto max-w-[36px] object-contain shrink-0"
                    />
                  )}
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer"
                      className="text-[7px] text-sky-deep underline underline-offset-1 truncate leading-tight">
                      {s.logo ? s.name : `★ ${s.name}`}
                    </a>
                  ) : (
                    <span className="text-[7px] text-mute/60 truncate leading-tight">★ {s.name}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );

    const SquadHeader = ({ label }: { label: string }) => (
      <div className="shrink-0 px-4 pt-3 pb-2 border-b border-line flex items-end justify-between">
        <div>
          <div className="text-[7px] uppercase tracking-[0.3em] text-sky-deep font-semibold mb-0.5">Doncaster City FC</div>
          <div className="font-serif text-navy text-base leading-tight">The Squad</div>
        </div>
        <div className="text-[7px] uppercase tracking-[0.2em] text-mute">{label}</div>
      </div>
    );

    squadPages.forEach((page, pageIdx) => {
      pages.push({
        id: `squad-${pageIdx + 1}`,
        el: (
          <PageFull className="bg-paper flex flex-col">
            <SquadHeader label={`${pageIdx + 1} of ${totalPages}`} />
            <div className="flex-1 grid grid-cols-2 divide-x divide-line min-h-0 overflow-hidden">
              <div className="flex flex-col overflow-hidden">{page.slice(0, 5).map((p, i) => p ? <PlayerCard key={p.id} p={p} /> : <EmptySlot key={`e${pageIdx}a-${i}`} />)}</div>
              <div className="flex flex-col overflow-hidden">{page.slice(5, 10).map((p, i) => p ? <PlayerCard key={p.id} p={p} /> : <EmptySlot key={`e${pageIdx}b-${i}`} />)}</div>
            </div>
            <div className="shrink-0 border-t border-line px-4 py-1.5 flex items-center justify-between">
              <Crest className="h-3 w-3 text-navy/20" />
              <span className="text-[7px] uppercase tracking-[0.2em] text-mute/60">doncastercity-fc.com</span>
            </div>
          </PageFull>
        ),
      });
    });
  }

  // ── 12. Team sheet ────────────────────────────────────────────────────────────
  pages.push({
    id: "teamsheet",
    el: (
      <PageFull className="bg-paper flex flex-col">

        {/* Match header */}
        <div className="shrink-0 bg-navy px-5 py-3 text-center">
          <div className="text-[8px] uppercase tracking-[0.35em] text-sky mb-1.5 font-semibold">Teams Information / Squads</div>
          <div className="font-serif text-paper leading-tight" style={{ fontSize: "clamp(1rem, 4vw, 1.5rem)" }}>
            Doncaster City FC
            <span className="text-paper/35 font-light mx-2 text-sm">v</span>
            {fixture?.opponent ?? "Opposition"}
          </div>
          {matchDate && (
            <div className="text-paper/40 text-[9px] mt-1 tracking-wide">{matchDate}</div>
          )}
        </div>

        {/* Team columns — equal height, players only */}
        <div className="flex-1 grid grid-cols-2 divide-x divide-line min-h-0 overflow-hidden">

          {/* ── DCFC ── */}
          <div className="flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 flex items-center gap-2.5 px-3 py-2.5 bg-navy/5 border-b border-line">
              <Crest className="h-7 w-7 text-navy shrink-0" />
              <div>
                <div className="font-semibold text-navy text-[10px] leading-tight">Doncaster City FC</div>
                <div className="text-[7px] uppercase tracking-[0.15em] text-sky-deep mt-0.5">Home</div>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {firstTeamPlayers
                .slice()
                .sort((a, b) => (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99))
                .map((p) => (
                  <div key={p.id} className="flex items-center border-b border-line/60 px-2 py-px gap-1.5">
                    <span
                      className="text-navy/22 tabular-nums shrink-0 text-right leading-none select-none"
                      style={{ fontFamily: "var(--font-display)", fontSize: "0.65rem", width: "0.9rem" }}
                    >
                      {p.shirtNumber ?? "—"}
                    </span>
                    <div className="text-[8.5px] font-semibold text-navy leading-tight truncate">{p.name}</div>
                  </div>
                ))}
            </div>
          </div>

          {/* ── Opposition ── */}
          <div className="flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 flex items-center gap-2.5 px-3 py-2.5 bg-navy/5 border-b border-line">
              {(() => {
                const slug = (fixture?.opponent ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
                return (
                  <img
                    src={`/League Table Logos/${slug}-logo.jpg`}
                    alt=""
                    className="h-7 w-7 object-contain shrink-0"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      if (!img.dataset.tried) {
                        img.dataset.tried = "1";
                        img.src = `/${slug}-logo.png`;
                      } else {
                        img.style.display = "none";
                        const ph = document.createElement("div");
                        ph.className = "h-7 w-7 border border-line/60 bg-paper-warm shrink-0 flex items-center justify-center";
                        ph.innerHTML = `<span style="font-size:5px;text-transform:uppercase;letter-spacing:0.05em;color:rgba(0,0,0,0.25);text-align:center;line-height:1.2">Away<br>Crest</span>`;
                        img.parentElement?.insertBefore(ph, img);
                      }
                    }}
                  />
                );
              })()}
              <div>
                <div className="font-semibold text-navy text-[10px] leading-tight">{fixture?.opponent ?? "Opposition"}</div>
                <div className="text-[7px] uppercase tracking-[0.15em] text-mute mt-0.5">Away</div>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {prog.oppositionSquad ? (
                prog.oppositionSquad.split("\n").map((l) => l.trim()).filter(Boolean).map((name, i) => (
                  <div key={i} className="flex items-center border-b border-line/60 px-2 py-px">
                    <div className="text-[8.5px] font-semibold text-navy leading-tight truncate">{name}</div>
                  </div>
                ))
              ) : oppositionLines.length > 0 ? (
                oppositionLines.map((line, i) => {
                  const m = line.match(/^(\d+)\s+(.+)$/);
                  return (
                    <div key={i} className="flex items-center border-b border-line/60 px-2 py-px gap-1.5">
                      <span
                        className="text-navy/22 tabular-nums shrink-0 text-right leading-none select-none"
                        style={{ fontFamily: "var(--font-display)", fontSize: "0.65rem", width: "0.9rem" }}
                      >
                        {m ? m[1] : i + 1}
                      </span>
                      <div className="text-[8.5px] font-semibold text-navy leading-tight truncate">{m ? m[2] : line}</div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span className="text-[8px] uppercase tracking-[0.15em] text-mute/50">Team to be announced</span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Management band — full width, two columns */}
        <div className="shrink-0 border-t border-line">
          <div className="grid grid-cols-2 divide-x divide-line">
            {/* DCFC management */}
            <div>
              <div className="px-2.5 py-1 bg-navy/5 border-b border-line/60">
                <div className="text-[7px] uppercase tracking-[0.2em] text-mute font-semibold">DCFC Management</div>
              </div>
              {firstTeamStaff.length > 0 ? (
                firstTeamStaff.map((s) => (
                  <div key={s.id} className="flex items-baseline border-b border-line/40 px-2.5 py-0.5 gap-1.5">
                    <div className="text-[9px] font-semibold text-navy leading-tight truncate">{s.name}</div>
                    <div className="text-[6.5px] uppercase tracking-wide text-mute shrink-0">{s.role}</div>
                  </div>
                ))
              ) : (
                ["Manager", "Asst Manager", "Coach"].map((role) => (
                  <div key={role} className="flex items-center border-b border-line/40 px-2.5 py-0.5 gap-2">
                    <div className="flex-1 h-px bg-line/35" />
                    <div className="text-[6.5px] uppercase tracking-wide text-mute/50 shrink-0">{role}</div>
                  </div>
                ))
              )}
            </div>
            {/* Away management */}
            <div>
              <div className="px-2.5 py-1 bg-navy/5 border-b border-line/60">
                <div className="text-[7px] uppercase tracking-[0.2em] text-mute font-semibold">Away Management</div>
              </div>
              {prog.oppositionManagement ? (
                prog.oppositionManagement.split("\n").map((l) => l.trim()).filter(Boolean).map((line, i) => {
                  const colonIdx = line.indexOf(":");
                  const role = colonIdx >= 0 ? line.slice(0, colonIdx).trim() : null;
                  const name = colonIdx >= 0 ? line.slice(colonIdx + 1).trim() : line;
                  return (
                    <div key={i} className="flex items-baseline border-b border-line/40 px-2.5 py-0.5 gap-1.5">
                      <div className="text-[9px] font-semibold text-navy leading-tight truncate flex-1 min-w-0">{name}</div>
                      {role && <div className="text-[6.5px] uppercase tracking-wide text-mute shrink-0">{role}</div>}
                    </div>
                  );
                })
              ) : (
                ["Manager", "Asst Manager", "Coach"].map((role) => (
                  <div key={role} className="flex items-center border-b border-line/40 px-2.5 py-0.5 gap-2">
                    <div className="flex-1 h-px bg-line/35" />
                    <div className="text-[6.5px] uppercase tracking-wide text-mute/50 shrink-0">{role}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Bottom credit strip */}
        <div className="shrink-0 bg-navy/5 border-t border-line px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crest className="h-3 w-3 text-navy/30" />
            <span className="text-[7px] uppercase tracking-[0.2em] text-mute">Doncaster City FC</span>
          </div>
          <span className="text-[7px] text-mute/60">doncastercity-fc.com</span>
        </div>

      </PageFull>
    ),
  });

  // ── 13. NCEL mandatory ads ────────────────────────────────────────────────────
  if (isNcelGame) {
    // Macron — kit supplier, product showcase page
    const macronProducts = [
      { slug: "aachen-pants",     name: "Aachen Pants",           price: "£26.40" },
      { slug: "chronos-hoodie",   name: "Chronos Full Zip Hoodie", price: "£38.40" },
      { slug: "crew-backpack",    name: "Crew Backpack",           price: "£26.40" },
      { slug: "elbrus-jacket",    name: "Elbrus Jacket",           price: "£36.00" },
      { slug: "galax-shorts",     name: "Galax Shorts",            price: "£10.20" },
      { slug: "gripfit-socks",    name: "Gripfit Socks",           price: "£9.60"  },
      { slug: "quarter-zip",      name: "Macron ¼ Zip Top",        price: "£32.40" },
      { slug: "match-stockings",  name: "Match Stockings",         price: "£9.60"  },
      { slug: "home-shirt",       name: "Propus Home Shirt",       price: "£31.80" },
    ];
    pages.push({
      id: "ncel-macron",
      el: (
        <PageFull className="bg-white flex flex-col">
          {/* Banner header — object-contain so nothing is cropped */}
          <img
            src="/macron-banner.png"
            alt="Macron Sports Hub Wakefield — Official Kit Supplier"
            className="w-full object-contain shrink-0"
            style={{ maxHeight: "64px" }}
          />

          {/* Subheader */}
          <div className="shrink-0 px-3 pt-2 pb-1.5 border-b border-gray-100 flex items-center justify-between">
            <div className="text-[7.5px] uppercase tracking-[0.22em] text-gray-400 font-semibold">Official DCFC Kit · 2026/27 Season</div>
            <div className="text-[7.5px] text-gray-400">macronstorewakefield.co.uk</div>
          </div>

          {/* 3-column product grid — fills remaining height with 3 equal rows */}
          <div className="flex-1 min-h-0 px-2 pt-2 pb-1 grid grid-cols-3 gap-2" style={{ gridTemplateRows: "repeat(3, 1fr)" }}>
            {macronProducts.map(({ slug, name, price }) => (
              <a
                key={slug}
                href="https://www.macronstorewakefield.co.uk/store/Adults-c201709523"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center text-center group min-h-0"
              >
                <div className="w-full flex-1 min-h-0 bg-gray-50 flex items-center justify-center overflow-hidden mb-0.5 border border-gray-100 group-hover:border-gray-300 transition-colors">
                  <img
                    src={`/macron-products/${slug}.jpg`}
                    alt={name}
                    className="w-full h-full object-contain p-1"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = "none";
                      const parent = img.parentElement;
                      if (parent && !parent.querySelector(".macron-placeholder")) {
                        const ph = document.createElement("div");
                        ph.className = "macron-placeholder w-full h-full flex items-center justify-center";
                        ph.innerHTML = `<svg viewBox="0 0 24 24" class="w-8 h-8 text-gray-200" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`;
                        ph.style.color = "#e5e7eb";
                        parent.appendChild(ph);
                      }
                    }}
                  />
                </div>
                <div className="text-[7px] text-gray-500 leading-tight">{name}</div>
                <div className="text-[8.5px] font-bold text-gray-800">{price}</div>
              </a>
            ))}
          </div>

          {/* CTA footer */}
          <div className="shrink-0 px-3 py-2 border-t border-gray-100 flex items-center justify-between">
            <p className="text-[7.5px] text-gray-400 leading-relaxed max-w-[55%]">
              Shop the official DCFC Macron range at Macron Sports Hub Wakefield — your local official Macron store.
            </p>
            <a
              href="https://www.macronstorewakefield.co.uk/store/Adults-c201709523"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 bg-gray-900 text-white text-[7.5px] font-bold uppercase tracking-[0.15em] px-3 py-1.5 hover:bg-gray-700 transition-colors"
            >
              Shop Now ↗
            </a>
          </div>
        </PageFull>
      ),
    });

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

  // ── 15. Easyfundraising ───────────────────────────────────────────────────────
  pages.push({
    id: "easyfundraising",
    el: (
      <PageFull className="bg-white flex items-center justify-center overflow-hidden">
        {/* Width constrained so the full portrait fits within viewport height */}
        <div
          className="relative flex-shrink-0"
          style={{
            width: "min(100%, calc(100vh * 2622 / 3650))",
            containerType: "inline-size",
          } as React.CSSProperties}
        >
          <img
            src="/efr-page.png"
            alt="Raise funds for Doncaster City FC for free with easyfundraising"
            className="w-full h-auto block"
          />

          {/* White overlay covering the entire "join" section — reproduced cleanly */}
          <div
            className="absolute bg-white overflow-hidden"
            style={{ top: "10.8%", left: "3.5%", width: "93%", height: "26%" }}
          >
            <div
              className="w-full h-full"
              style={{
                display: "flex",
                alignItems: "center",
                padding: "1.5% 2.5%",
                gap: "4%",
                color: "#174a5e",
              }}
            >
              {/* DCFC QR code */}
              <div style={{ flexShrink: 0, width: "23%", alignSelf: "center" }}>
                <img src="/efr-qr.png" alt="" className="w-full h-auto block" />
              </div>

              {/* Right: heading, URL, search label, cause name box */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: "4%",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "3.8cqw", lineHeight: 1.15 }}>
                  Join as our supporter today at:
                </div>
                <div style={{ fontSize: "2.4cqw", fontWeight: 500 }}>
                  www.easyfundraising.org.uk/causes/doncaster-city-fc
                </div>
                <div style={{ fontSize: "2.4cqw" }}>Just search for:</div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "2.8cqw",
                    padding: "2% 3%",
                    border: "2.5px solid #f5c142",
                    backgroundColor: "#fef9e7",
                    lineHeight: 1.2,
                  }}
                >
                  Doncaster-City-FC
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageFull>
    ),
  });

  // ── 16. Wheatsheaf sponsor page ───────────────────────────────────────────────
  pages.push({
    id: "wheatsheaf",
    el: (
      <PageFull className="flex flex-col items-center justify-center" style={{ background: "#0d1e14" }}>
        <img
          src="/sponsors/Wheatsheaf.jpeg"
          alt="Official Partner — The Wheatsheaf, Armthorpe"
          className="w-full object-contain"
          style={{ maxHeight: "100%" }}
        />
      </PageFull>
    ),
  });

  // ── 17. Macron Sports Hub Wakefield full-page ad ─────────────────────────────
  pages.push({
    id: "macron-ad",
    el: (
      <PageFull className="bg-black flex items-center justify-center overflow-hidden">
        <img
          src="/Macron_Various/Macron Programme 2026.png"
          alt="Macron Sports Hub Wakefield"
          className="w-full h-full object-contain"
        />
      </PageFull>
    ),
  });

  // ── 18. PST Sport full-page ad ────────────────────────────────────────────────
  pages.push({
    id: "pst-sport-ad",
    el: (
      <PageFull className="bg-white flex items-center justify-center overflow-hidden">
        <img
          src="/PST_Sport/NCEL Programme Advert.pdf.png"
          alt="PST Sport"
          className="w-full h-full object-contain"
        />
      </PageFull>
    ),
  });

  // ── 19. Resus UK full-page ad ─────────────────────────────────────────────────
  pages.push({
    id: "resus-uk-ad",
    el: (
      <PageFull className="bg-white flex items-center justify-center overflow-hidden">
        <img
          src="/Resus_UK/Resus UK NCEL advert 2026-27.png"
          alt="Resus UK"
          className="w-full h-full object-contain"
        />
      </PageFull>
    ),
  });

  // ── 20. Back cover — partner sticker wall ─────────────────────────────────────
  {
    const ROTS    = [-6, 4, -2, 7, -5, 3, -8, 5, -1, 6, -4, 2, -7, 3, -3, 8, -6, 5];
    const SCALES  = [1.0, 0.88, 1.05, 0.93, 1.08, 0.85, 1.0, 0.95, 1.03, 0.9];
    const TAPES   = [true, false, true, false, false, true, false, true, false, false, true, false, true, false, false, true];
    const TINTS   = ["#ffffff","#ffffff","#fffdf0","#ffffff","#f0f7ff","#ffffff","#fff8f0","#ffffff","#f8fff0","#ffffff"];

    const allSponsors = [...platinumSponsors, ...goldSponsors, ...silverSponsors];

    // Deduplicated player sponsors not already in allSponsors
    const seenNames = new Set(allSponsors.map((s) => s.name.toLowerCase()));
    const playerSponsors: { id: string; name: string; url: string | null; logoFilename: string | null }[] = [];
    firstTeamPlayers.forEach((p) => {
      for (const s of [
        { name: p.sponsor1Name, url: p.sponsor1Url, logo: p.sponsor1LogoFilename },
        { name: p.sponsor2Name, url: p.sponsor2Url, logo: p.sponsor2LogoFilename },
      ]) {
        if (!s.name) continue;
        const key = s.name.toLowerCase();
        if (seenNames.has(key)) continue;
        seenNames.add(key);
        playerSponsors.push({ id: `ps-${key}`, name: s.name, url: s.url ?? null, logoFilename: s.logo ?? null });
      }
    });

    const allStickers = [...allSponsors, ...playerSponsors];
    const stickerSponsors = allStickers.filter((s) => s.logoFilename);
    const textSponsors    = allStickers.filter((s) => !s.logoFilename);

    pages.push({
      id: "back",
      el: (
        <PageFull className="flex flex-col overflow-hidden" style={{ background: "#ede9e0" }}>
          {/* Subtle grid texture */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }} />

          {/* Header */}
          <div className="shrink-0 text-center px-6 pt-4 pb-2 relative">
            <div className="text-[7px] uppercase tracking-[0.45em] text-navy/35 mb-0.5">Doncaster City FC</div>
            <div className="font-serif text-navy leading-tight" style={{ fontSize: "1.15rem" }}>A huge thank you to our sponsors.</div>
            <div className="font-serif text-navy/50 leading-tight mt-0.5" style={{ fontSize: "0.6rem", fontStyle: "italic" }}>It means a lot.</div>
            <div className="h-px w-14 bg-navy/15 mx-auto mt-2" />
          </div>

          {/* Sticker board */}
          <div className="flex-1 flex flex-wrap items-center justify-center content-center gap-3 px-4 py-2 relative">
            {stickerSponsors.map((sponsor, i) => {
              const rot   = ROTS[i % ROTS.length];
              const scale = SCALES[i % SCALES.length];
              const tape  = TAPES[i % TAPES.length];
              const tint  = TINTS[i % TINTS.length];
              return (
                <div key={sponsor.id} className="relative" style={{ transform: `rotate(${rot}deg) scale(${scale})`, transformOrigin: "center" }}>
                  {tape && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-9 h-2.5 rounded-[2px] z-10"
                      style={{ background: "rgba(215,205,170,0.80)", border: "1px solid rgba(195,185,150,0.5)" }} />
                  )}
                  <a
                    href={sponsor.url ?? undefined}
                    target={sponsor.url ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="block px-3 py-2.5 rounded-[3px]"
                    style={{ background: tint, boxShadow: "2px 4px 10px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.10)" }}
                  >
                    <img
                      src={variantUrl(sponsor.logoFilename!, 240, fallbackFormatFor(sponsor.logoFilename!))}
                      alt={sponsor.name}
                      className="h-9 w-auto max-w-[80px] object-contain block"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </a>
                </div>
              );
            })}
            {textSponsors.map((sponsor, i) => {
              const rot = ROTS[(stickerSponsors.length + i) % ROTS.length];
              return (
                <div key={sponsor.id} style={{ transform: `rotate(${rot}deg)` }}>
                  <a
                    href={sponsor.url ?? undefined}
                    target={sponsor.url ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="block px-3 py-2 rounded-[3px] text-center"
                    style={{ background: "#ffffff", boxShadow: "2px 4px 10px rgba(0,0,0,0.15)" }}
                  >
                    <div className="text-[8px] font-bold text-navy/65 leading-tight max-w-[70px]">{sponsor.name}</div>
                  </a>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-center gap-2 pb-3 relative">
            <Crest className="h-4 w-4 text-navy/25" />
            <span className="text-[7px] uppercase tracking-[0.25em] text-navy/30">doncastercity-fc.com</span>
          </div>
        </PageFull>
      ),
    });
  }

  return <BrochureLayout pages={pages} isPreview={isPreview} progId={prog.id} />;
}
