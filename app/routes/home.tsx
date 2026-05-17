import { Link } from "react-router";
import { and, asc, desc, eq, gt, lte } from "drizzle-orm";
import type { Route } from "./+types/home";
import { db } from "~/db.server";
import { fixtures, media, posts, sponsors } from "../../db/schema";
import { Container } from "~/components/Container";
import { NewsCard } from "~/components/NewsCard";
import { ResultCard } from "~/components/ResultCard";
import {
  fallbackFormatFor,
  variantSrcset,
  variantUrl,
} from "~/lib/uploads";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Doncaster City FC — Built by the community, for the community" },
    {
      name: "description",
      content:
        "Official home of Doncaster City Football Club. Fixtures, news, the latest from the squad, and how to back the club.",
    },
  ];
}

export function links() {
  return [
    {
      rel: "preload",
      as: "image",
      type: "image/avif",
      imageSrcSet: "/hero-768.avif 768w, /hero.avif 1248w",
      imageSizes: "100vw",
      fetchPriority: "high",
    },
  ];
}

export async function loader() {
  const now = new Date();
  const [nextFixtures, recentResults, latestPosts, activeSponsors] =
    await Promise.all([
      db
        .select()
        .from(fixtures)
        .where(and(eq(fixtures.status, "scheduled"), gt(fixtures.kickoff, now)))
        .orderBy(fixtures.kickoff)
        .limit(1),
      db
        .select()
        .from(fixtures)
        .where(and(eq(fixtures.status, "completed"), lte(fixtures.kickoff, now)))
        .orderBy(desc(fixtures.kickoff))
        .limit(3),
      db
        .select({
          id: posts.id,
          slug: posts.slug,
          title: posts.title,
          excerpt: posts.excerpt,
          publishedAt: posts.publishedAt,
          heroFilename: media.filename,
        })
        .from(posts)
        .leftJoin(media, eq(media.id, posts.heroMediaId))
        .where(eq(posts.status, "published"))
        .orderBy(desc(posts.publishedAt))
        .limit(5),
      db
        .select({
          id: sponsors.id,
          name: sponsors.name,
          url: sponsors.url,
          logoFilename: media.filename,
        })
        .from(sponsors)
        .leftJoin(media, eq(media.id, sponsors.logoMediaId))
        .where(eq(sponsors.active, true))
        .orderBy(asc(sponsors.sortOrder)),
    ]);

  return {
    nextFixture: nextFixtures[0] ?? null,
    recentResults,
    latestPosts,
    activeSponsors,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { nextFixture, recentResults, latestPosts, activeSponsors } =
    loaderData;
  const [feature, ...rest] = latestPosts;

  return (
    <>
      <Hero nextFixture={nextFixture} />
      <ResultsStrip results={recentResults} />
      <LatestNews feature={feature} rest={rest} />
      <PitchSponsorCTA />
      <SponsorsStrip sponsors={activeSponsors} />
      <JoinTheClub />
    </>
  );
}

/* ─── Hero ─────────────────────────────────────────────────────────────── */

function Hero({
  nextFixture,
}: {
  nextFixture: {
    opponent: string;
    homeAway: "home" | "away";
    kickoff: Date;
    venue: string | null;
    competition: string;
  } | null;
}) {
  return (
    <section className="relative bg-navy text-paper overflow-hidden">
      <picture>
        <source
          type="image/avif"
          srcSet="/hero-768.avif 768w, /hero.avif 1248w"
          sizes="100vw"
        />
        <img
          src="/hero.jpg"
          alt=""
          aria-hidden
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
      </picture>
      <div className="absolute inset-0 bg-gradient-to-r from-navy/95 via-navy/70 to-navy/25 pointer-events-none" />
      {/* decorative diagonal accent */}
      <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-sky/20 to-transparent pointer-events-none" />
      <div className="absolute -top-12 -right-12 h-96 w-96 rounded-full border border-sky/20 pointer-events-none" />
      <div className="absolute top-32 -right-40 h-[40rem] w-[40rem] rounded-full border border-sky/10 pointer-events-none" />

      <Container size="wide" className="relative py-16 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-16 items-end">
          <div>
            <div className="flex items-center gap-3 text-[10px] tracking-[0.32em] uppercase text-sky mb-7">
              <span className="h-px w-10 bg-sky" />
              Doncaster City FC · Est 2022
            </div>
            <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] leading-[0.95] tracking-tight text-balance">
              A new chapter
              <br />
              for football in
              <br />
              <span className="italic text-sky">Doncaster.</span>
            </h1>
            <p className="mt-8 max-w-lg text-paper/70 text-lg leading-relaxed">
              Built by supporters, played for the city. Follow the journey
              through every kick-off, every result, and every story along the
              way.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                to="/fixtures"
                className="inline-flex items-center gap-2 bg-sky text-navy px-6 py-3.5 text-sm font-semibold tracking-wide uppercase hover:bg-paper transition-colors"
              >
                See fixtures
                <span aria-hidden>→</span>
              </Link>
              <Link
                to="/pitch"
                className="inline-flex items-center gap-2 border border-paper/30 text-paper px-6 py-3.5 text-sm font-medium tracking-wide uppercase hover:bg-paper/10 transition-colors"
              >
                Sponsor a square
              </Link>
            </div>
          </div>

          <NextFixtureCard nextFixture={nextFixture} />
        </div>
      </Container>
    </section>
  );
}

function NextFixtureCard({
  nextFixture,
}: {
  nextFixture: {
    opponent: string;
    homeAway: "home" | "away";
    kickoff: Date;
    venue: string | null;
    competition: string;
  } | null;
}) {
  if (!nextFixture) {
    return (
      <div className="relative bg-paper text-navy p-8 lg:p-10 border-l-[6px] border-sky">
        <div className="text-[10px] uppercase tracking-[0.28em] text-mute">
          Next match
        </div>
        <div className="mt-4 font-serif text-3xl text-navy leading-tight">
          Schedule to be announced
        </div>
        <p className="mt-3 text-sm text-mute leading-relaxed">
          Fixtures haven't been added yet. Head to the schedule page when they
          drop — or sign up below for updates.
        </p>
        <Link
          to="/fixtures"
          className="mt-6 inline-block text-sm font-semibold tracking-wide uppercase text-navy border-b-2 border-sky pb-1"
        >
          Schedule page
        </Link>
      </div>
    );
  }

  const k = nextFixture.kickoff;
  return (
    <div className="relative bg-paper text-navy">
      <div className="absolute top-0 left-0 right-0 h-2 bg-hashed opacity-[0.06]" />
      <div className="p-8 lg:p-10 border-l-[6px] border-sky">
        <div className="flex items-baseline justify-between">
          <div className="text-[10px] uppercase tracking-[0.28em] text-mute">
            Next match
          </div>
          <div className="text-[10px] uppercase tracking-[0.28em] text-sky-deep font-semibold">
            {nextFixture.homeAway === "home" ? "Home" : "Away"}
          </div>
        </div>

        <div className="mt-6 flex items-end gap-5">
          <div className="scoreboard text-6xl text-navy leading-[0.85]">
            {k
              .toLocaleDateString("en-GB", { day: "2-digit" })
              .padStart(2, "0")}
          </div>
          <div className="pb-1.5">
            <div className="font-display text-2xl text-navy leading-none tracking-wide">
              {k.toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}
            </div>
            <div className="font-display text-base text-mute leading-tight">
              {k.toLocaleDateString("en-GB", { weekday: "long" })}
            </div>
          </div>
          <div className="ml-auto pb-1 text-right">
            <div className="scoreboard text-3xl text-navy leading-none">
              {k.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-mute mt-1">
              Kick-off
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-line">
          <div className="text-[10px] uppercase tracking-[0.22em] text-mute">
            {nextFixture.homeAway === "home" ? "vs" : "Away to"}
          </div>
          <div className="font-serif text-3xl text-navy mt-1 leading-tight">
            {nextFixture.opponent}
          </div>
          <div className="text-sm text-mute mt-2">
            {nextFixture.competition}
            {nextFixture.venue && <> · {nextFixture.venue}</>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Results strip ────────────────────────────────────────────────────── */

function ResultsStrip({
  results,
}: {
  results: {
    id: string;
    opponent: string;
    homeAway: "home" | "away";
    homeScore: number | null;
    awayScore: number | null;
    competition: string;
    kickoff: Date;
  }[];
}) {
  return (
    <section className="bg-paper-warm border-y border-line">
      <Container size="wide" className="py-10">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="font-display text-2xl tracking-wider text-navy">
            RECENT RESULTS
          </h2>
          <Link
            to="/fixtures"
            className="text-xs uppercase tracking-[0.2em] text-navy hover:text-sky-bright font-medium"
          >
            All results →
          </Link>
        </div>
        {results.length === 0 ? (
          <div className="bg-paper border border-line px-5 py-8 text-sm text-mute">
            No results yet — the journey starts with the first kick-off.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-line">
            {results.map((r) => (
              <div key={r.id} className="bg-paper p-1">
                <ResultCard
                  opponent={r.opponent}
                  homeAway={r.homeAway}
                  homeScore={r.homeScore}
                  awayScore={r.awayScore}
                  competition={r.competition}
                  date={r.kickoff}
                />
              </div>
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}

/* ─── Latest news ──────────────────────────────────────────────────────── */

type LatestPost = {
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: Date | null;
  heroFilename: string | null;
};

function LatestNews({
  feature,
  rest,
}: {
  feature: LatestPost | undefined;
  rest: LatestPost[];
}) {
  return (
    <section>
      <Container size="wide" className="py-20 md:py-28">
        <div className="flex items-end justify-between mb-12">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-sky-deep mb-3">
              From the club
            </div>
            <h2 className="font-serif text-4xl md:text-5xl text-navy leading-none">
              Latest news.
            </h2>
          </div>
          <Link
            to="/news"
            className="hidden sm:inline-flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-navy font-medium hover:text-sky-bright"
          >
            All stories
            <span aria-hidden>→</span>
          </Link>
        </div>

        {!feature ? (
          <EmptyNewsState />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14">
            <NewsCard
              slug={feature.slug}
              title={feature.title}
              excerpt={feature.excerpt}
              date={feature.publishedAt ?? new Date()}
              heroFilename={feature.heroFilename}
              size="feature"
              category="Featured"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {rest.slice(0, 4).map((p) => (
                <NewsCard
                  key={p.slug}
                  slug={p.slug}
                  title={p.title}
                  excerpt={p.excerpt}
                  date={p.publishedAt ?? new Date()}
                  heroFilename={p.heroFilename}
                />
              ))}
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}

function EmptyNewsState() {
  return (
    <div className="border border-line bg-paper-warm/40 p-12 text-center">
      <div className="font-serif text-2xl text-navy">
        First whistle hasn't blown yet.
      </div>
      <p className="mt-3 text-mute max-w-md mx-auto">
        Once the season starts, every story will land here first. Check back
        soon — or follow the club on social.
      </p>
    </div>
  );
}

/* ─── Pitch sponsor CTA ────────────────────────────────────────────────── */

function PitchSponsorCTA() {
  return (
    <section className="relative">
      <Container size="wide" className="py-20 md:py-24">
        <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-16 bg-navy text-paper p-10 md:p-16 overflow-hidden">
          <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-sky/10 pointer-events-none" />
          <div className="relative">
            <div className="text-[10px] uppercase tracking-[0.28em] text-sky mb-4">
              Back the club
            </div>
            <h2 className="font-serif text-4xl md:text-5xl leading-tight text-balance">
              Put your name
              <br /> on our <span className="italic text-sky">pitch.</span>
            </h2>
            <p className="mt-6 text-paper/70 leading-relaxed max-w-md">
              For just £50, sponsor a square of the playing surface. Your name
              — or your business — appears on the pitch map and in the matchday
              programme all season long.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 items-center">
              <Link
                to="/pitch"
                className="inline-flex items-center gap-2 bg-sky text-navy px-6 py-3.5 text-sm font-semibold tracking-wide uppercase hover:bg-paper transition-colors"
              >
                Pick your square
                <span aria-hidden>→</span>
              </Link>
              <span className="text-xs text-paper/50 uppercase tracking-[0.2em]">
                £50 per square
              </span>
            </div>
          </div>

          <PitchGridPreview />
        </div>
      </Container>
    </section>
  );
}

function PitchGridPreview() {
  const cols = 15;
  const rows = 10;
  const cells = Array.from({ length: cols * rows });
  const soldSeeds = new Set([
    3, 7, 14, 22, 28, 41, 55, 67, 73, 88, 91, 102, 116, 119, 128, 137,
  ]);
  const pendingSeeds = new Set([12, 45, 82, 110]);
  return (
    <div className="relative">
      <div className="aspect-[3/2] bg-navy-deep border border-sky/20 p-3 relative">
        {/* pitch markings */}
        <div className="absolute inset-3 border border-sky/15" />
        <div className="absolute left-1/2 top-3 bottom-3 w-px bg-sky/15" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-16 w-16 rounded-full border border-sky/15" />
        <div
          className="grid gap-[2px] h-full w-full"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          }}
        >
          {cells.map((_, i) => {
            const isSold = soldSeeds.has(i);
            const isPending = pendingSeeds.has(i);
            return (
              <div
                key={i}
                className={[
                  "transition-colors",
                  isSold
                    ? "bg-sky"
                    : isPending
                      ? "bg-cream/80"
                      : "bg-paper/[0.04] hover:bg-paper/10",
                ].join(" ")}
              />
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-[10px] uppercase tracking-[0.2em] text-paper/60">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 bg-sky" /> Sold
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 bg-cream/80" /> Pending
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 bg-paper/10" /> Available
        </span>
      </div>
    </div>
  );
}

/* ─── Sponsors strip ───────────────────────────────────────────────────── */

function SponsorsStrip({
  sponsors,
}: {
  sponsors: {
    id: string;
    name: string;
    url: string | null;
    logoFilename: string | null;
  }[];
}) {
  if (sponsors.length === 0) {
    return (
      <section className="bg-paper-warm border-y border-line">
        <Container size="wide" className="py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-mute mb-2">
                Partnerships
              </div>
              <div className="font-serif text-2xl text-navy">
                Could your business be on this strip?
              </div>
            </div>
            <Link
              to="/sponsors"
              className="inline-flex items-center gap-2 border border-navy text-navy px-5 py-2.5 text-xs uppercase tracking-[0.2em] font-medium hover:bg-navy hover:text-paper transition-colors"
            >
              Become a partner
            </Link>
          </div>
        </Container>
      </section>
    );
  }
  return (
    <section className="bg-paper-warm border-y border-line">
      <Container size="wide" className="py-12">
        <div className="text-[10px] uppercase tracking-[0.28em] text-mute text-center mb-7">
          Proudly partnered with
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {sponsors.map((s) => {
            const filename = s.logoFilename;
            const fallback = filename ? fallbackFormatFor(filename) : null;
            const inner =
              filename && fallback ? (
                <picture>
                  <source
                    type="image/avif"
                    srcSet={variantSrcset(filename, "avif") ?? undefined}
                    sizes="200px"
                  />
                  <img
                    src={variantUrl(filename, 400, fallback)}
                    srcSet={variantSrcset(filename, fallback) ?? undefined}
                    sizes="200px"
                    alt={s.name}
                    loading="lazy"
                    decoding="async"
                    className="h-10 md:h-12 w-auto opacity-70 hover:opacity-100 transition-opacity"
                  />
                </picture>
              ) : (
                <span className="text-xl font-display tracking-wider text-navy/60 hover:text-navy transition-colors">
                  {s.name.toUpperCase()}
                </span>
              );
            return s.url ? (
              <a
                key={s.id}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                {inner}
              </a>
            ) : (
              <span key={s.id} className="block">
                {inner}
              </span>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

/* ─── Closing ──────────────────────────────────────────────────────────── */

function JoinTheClub() {
  return (
    <section>
      <Container size="wide" className="py-24 md:py-32">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-sky-deep mb-4">
              The matchday
            </div>
            <h2 className="font-serif text-4xl md:text-5xl text-navy leading-tight text-balance">
              Come down on a Saturday.
              <br />
              <span className="italic">Stand with us.</span>
            </h2>
            <p className="mt-6 text-mute leading-relaxed max-w-md">
              There's nothing quite like a non-league Saturday afternoon. Real
              football, real community, real beer at the bar. Bring the family,
              bring a mate, bring yourself.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/fixtures"
                className="inline-flex items-center gap-2 bg-navy text-paper px-6 py-3.5 text-sm font-semibold tracking-wide uppercase hover:bg-navy-deep transition-colors"
              >
                Next fixture
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 border border-navy/20 text-navy px-6 py-3.5 text-sm font-medium tracking-wide uppercase hover:bg-navy/5 transition-colors"
              >
                Get in touch
              </Link>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-10">
            <Stat label="Founded" value="2022" />
            <Stat label="Home shirt" value="Navy & sky" />
            <Stat label="Built by" value="The fans" />
            <Stat label="For" value="The city" />
          </dl>
        </div>
      </Container>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.22em] text-mute">
        {label}
      </dt>
      <dd className="font-display text-4xl text-navy mt-2 tracking-wide">
        {value.toUpperCase()}
      </dd>
    </div>
  );
}
