import { asc, eq, inArray } from "drizzle-orm";
import { Link } from "react-router";
import type { Route } from "./+types/sponsors";
import { db } from "~/db.server";
import { media, players, sponsors } from "../../db/schema";
import { Container } from "~/components/Container";
import { PageHeader } from "~/components/PageHeader";
import {
  fallbackFormatFor,
  variantSrcset,
  variantUrl,
} from "~/lib/uploads";

// ── Tier configuration ───────────────────────────────────────────────────────
// To add a new tier: add one entry here (and add the tier to the DB enum).
// "featured" tiers render as large showcase cards without a name label.
const TIER_CONFIG = [
  { key: "principal", label: "Principal Partner", featured: true },
  { key: "official", label: "Official Partner",  featured: false },
  { key: "partner",  label: "Club Partner",      featured: false },
] as const;

type TierKey = (typeof TIER_CONFIG)[number]["key"];

// All non-principal tiers use the same card width so every section looks identical.
// Mobile: 2 cols · sm (640px+): 4 cols · lg (1024px+): 6 cols.
const CARD_WIDTH = "w-1/2 sm:w-1/4 lg:w-1/6";
// ─────────────────────────────────────────────────────────────────────────────

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Sponsors & Partnerships · Doncaster City FC" },
    {
      name: "description",
      content:
        "Become a partner of Doncaster City FC. Match-day sponsorship, player sponsorship, and virtual pitch squares.",
    },
  ];
}

export async function loader() {
  const all = await db
    .select({
      id: sponsors.id,
      name: sponsors.name,
      url: sponsors.url,
      tier: sponsors.tier,
      logoFilename: media.filename,
    })
    .from(sponsors)
    .leftJoin(media, eq(media.id, sponsors.logoMediaId))
    .where(eq(sponsors.active, true))
    .orderBy(asc(sponsors.sortOrder), asc(sponsors.name));

  // Shirt sponsors — players that have at least one sponsor set
  const squad = await db
    .select({
      id: players.id,
      name: players.name,
      sortOrder: players.sortOrder,
      sponsor1Name: players.sponsor1Name,
      sponsor1Url: players.sponsor1Url,
      sponsor1LogoMediaId: players.sponsor1LogoMediaId,
      sponsor2Name: players.sponsor2Name,
      sponsor2Url: players.sponsor2Url,
      sponsor2LogoMediaId: players.sponsor2LogoMediaId,
    })
    .from(players)
    .where(eq(players.active, true))
    .orderBy(asc(players.sortOrder), asc(players.name));

  const sponsoredPlayers = squad.filter(
    (p) => p.sponsor1Name || p.sponsor2Name,
  );

  const logoIds = sponsoredPlayers.flatMap((p) =>
    [p.sponsor1LogoMediaId, p.sponsor2LogoMediaId].filter(Boolean),
  ) as string[];

  const logoMedia = logoIds.length
    ? await db
        .select({ id: media.id, filename: media.filename })
        .from(media)
        .where(inArray(media.id, logoIds))
    : [];
  const logoById = new Map(logoMedia.map((m) => [m.id, m.filename]));

  const playerSponsors = sponsoredPlayers.flatMap((p) => {
    const slots = [];
    if (p.sponsor1Name) {
      slots.push({
        playerId: p.id,
        playerName: p.name,
        sponsorName: p.sponsor1Name,
        sponsorUrl: p.sponsor1Url,
        logoFilename: p.sponsor1LogoMediaId ? (logoById.get(p.sponsor1LogoMediaId) ?? null) : null,
      });
    }
    if (p.sponsor2Name) {
      slots.push({
        playerId: p.id,
        playerName: p.name,
        sponsorName: p.sponsor2Name,
        sponsorUrl: p.sponsor2Url,
        logoFilename: p.sponsor2LogoMediaId ? (logoById.get(p.sponsor2LogoMediaId) ?? null) : null,
      });
    }
    return slots;
  });

  return { sponsors: all, playerSponsors };
}

type Sponsor = Awaited<ReturnType<typeof loader>>["sponsors"][number];

type PlayerSponsor = Awaited<ReturnType<typeof loader>>["playerSponsors"][number];

export default function Sponsors({ loaderData }: Route.ComponentProps) {
  const { sponsors, playerSponsors } = loaderData;

  const grouped = Object.fromEntries(
    TIER_CONFIG.map(({ key }) => [key, sponsors.filter((s) => s.tier === key)]),
  ) as Record<TierKey, Sponsor[]>;

  return (
    <>
      <PageHeader
        eyebrow="Backing the club"
        title="Partner with Doncaster City."
        lede="From player sponsorship to a square on the virtual pitch, there's a way for every business — and every supporter — to back the club."
      >
        <Link
          to="/pitch"
          className="inline-flex items-center gap-2 bg-navy text-paper px-6 py-3.5 text-sm font-semibold tracking-wide uppercase hover:bg-navy-deep transition-colors"
        >
          Sponsor a square
        </Link>
      </PageHeader>

      <Container size="wide" className="py-16 space-y-16">
        {sponsors.length === 0 ? (
          <BecomePartnerEmpty />
        ) : (
          TIER_CONFIG.map(({ key, label, featured }) => {
            const items = grouped[key];
            if (items.length === 0) return null;
            return (
              <section key={key}>
                <h2 className="font-display text-2xl tracking-wider text-navy mb-6">
                  {label.toUpperCase()}
                </h2>
                {featured ? (
                  <FeaturedGrid items={items} />
                ) : (
                  <SponsorGrid items={items} />
                )}
              </section>
            );
          })
        )}

        {playerSponsors.length > 0 && (
          <PlayerSponsorsSection sponsors={playerSponsors} />
        )}

        <BecomePartnerCTA />
      </Container>
    </>
  );
}

// Large showcase cards for principal/featured tiers — no name label needed.
function FeaturedGrid({ items }: { items: Sponsor[] }) {
  const single = items.length === 1;
  return (
    <div
      className={
        single
          ? "max-w-lg w-full border border-line"
          : "flex flex-wrap border-t border-l border-line"
      }
    >
      {items.map((s) => {
        const filename = s.logoFilename;
        const fallback = filename ? fallbackFormatFor(filename) : null;
        const sizes = single ? "min(512px, 100vw)" : "(min-width: 640px) 50vw, 100vw";
        return (
          <a
            key={s.id}
            href={s.url ?? "#"}
            target={s.url ? "_blank" : undefined}
            rel={s.url ? "noreferrer" : undefined}
            className={[
              "bg-paper aspect-[3/2] flex items-center justify-center p-8 hover:bg-paper-warm transition-colors",
              single ? "w-full" : "w-full sm:w-1/2 border-r border-b border-line",
            ].join(" ")}
          >
            {filename && fallback ? (
              <picture>
                <source
                  type="image/avif"
                  srcSet={variantSrcset(filename, "avif") ?? undefined}
                  sizes={sizes}
                />
                <img
                  src={variantUrl(filename, 800, fallback)}
                  srcSet={variantSrcset(filename, fallback) ?? undefined}
                  sizes={sizes}
                  alt={s.name}
                  loading="lazy"
                  decoding="async"
                  className="max-h-full max-w-full object-contain"
                />
              </picture>
            ) : (
              <div className="font-display text-2xl tracking-wider text-navy/80 text-center">
                {s.name.toUpperCase()}
              </div>
            )}
          </a>
        );
      })}
    </div>
  );
}

// Standard sponsor grid — uniform card sizes, name label, no orphan-cell grey space.
function SponsorGrid({ items }: { items: Sponsor[] }) {
  return (
    <div className="flex flex-wrap border-t border-l border-line">
      {items.map((s) => (
        <SponsorCard key={s.id} sponsor={s} />
      ))}
    </div>
  );
}

function SponsorCard({ sponsor: s }: { sponsor: Sponsor }) {
  const filename = s.logoFilename;
  const fallback = filename ? fallbackFormatFor(filename) : null;
  const sizes = "(min-width: 1024px) 15vw, (min-width: 640px) 22vw, 48vw";

  return (
    <a
      href={s.url ?? "#"}
      target={s.url ? "_blank" : undefined}
      rel={s.url ? "noreferrer" : undefined}
      className={`${CARD_WIDTH} border-r border-b border-line bg-paper hover:bg-paper-warm transition-colors`}
    >
      {/* padding-top forces 3:2 logo area height cross-browser reliably */}
      <div className="relative w-full" style={{ paddingTop: "66.667%" }}>
        <div className="absolute inset-0 flex items-center justify-center p-3 overflow-hidden">
          {filename && fallback ? (
            // contents: picture is layout-transparent; img becomes direct flex child
            <picture className="contents">
              <source
                type="image/avif"
                srcSet={variantSrcset(filename, "avif") ?? undefined}
                sizes={sizes}
              />
              <img
                src={variantUrl(filename, 400, fallback)}
                srcSet={variantSrcset(filename, fallback) ?? undefined}
                sizes={sizes}
                alt={s.name}
                loading="lazy"
                decoding="async"
                className="max-h-full max-w-full object-contain"
              />
            </picture>
          ) : null}
        </div>
      </div>
      <div className="border-t border-line px-2 py-1.5 text-center text-[9px] font-semibold tracking-[0.12em] text-navy/60 uppercase truncate">
        {s.name}
      </div>
    </a>
  );
}

function PlayerSponsorsSection({ sponsors: items }: { sponsors: PlayerSponsor[] }) {
  return (
    <section>
      <h2 className="font-display text-2xl tracking-wider text-navy mb-6">
        PLAYER SPONSORS
      </h2>
      <div className="flex flex-wrap border-t border-l border-line">
        {items.map((s, i) => {
          const cardClass = `${CARD_WIDTH} border-r border-b border-line bg-paper hover:bg-paper-warm transition-colors`;
          const content = (
            <>
              <div className="relative w-full" style={{ paddingTop: "66.667%" }}>
                <div className="absolute inset-0 flex items-center justify-center p-3 overflow-hidden">
                  {s.logoFilename ? (
                    <picture className="contents">
                      <source
                        type="image/avif"
                        srcSet={variantSrcset(s.logoFilename, "avif") ?? undefined}
                        sizes="(min-width: 1024px) 15vw, (min-width: 640px) 22vw, 48vw"
                      />
                      <img
                        src={variantUrl(s.logoFilename, 400, fallbackFormatFor(s.logoFilename))}
                        alt={s.sponsorName}
                        loading="lazy"
                        decoding="async"
                        className="max-h-full max-w-full object-contain"
                      />
                    </picture>
                  ) : null}
                </div>
              </div>
              <div className="border-t border-line px-2 py-1.5 text-center">
                <div className="text-[9px] font-semibold tracking-[0.12em] text-navy/60 uppercase truncate">
                  {s.sponsorName}
                </div>
                <div className="text-[8px] tracking-[0.08em] text-mute/60 truncate mt-0.5">
                  Sponsoring {s.playerName}
                </div>
              </div>
            </>
          );
          return s.sponsorUrl ? (
            <a key={i} href={s.sponsorUrl} target="_blank" rel="noreferrer" className={cardClass}>
              {content}
            </a>
          ) : (
            <div key={i} className={cardClass}>{content}</div>
          );
        })}
      </div>
    </section>
  );
}

function BecomePartnerEmpty() {
  return (
    <div className="border border-line bg-paper-warm/40 p-16 text-center">
      <div className="font-serif text-3xl text-navy">
        Be among the first to back the club.
      </div>
      <p className="mt-3 text-mute max-w-xl mx-auto">
        We're building the partnership family from the ground up. Whether you
        run a local business, a national brand, or you just love this city —
        there's a place for you here.
      </p>
    </div>
  );
}

function BecomePartnerCTA() {
  return (
    <section className="bg-navy text-paper p-10 md:p-14 grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-10 items-center">
      <div>
        <div className="text-[10px] uppercase tracking-[0.28em] text-sky mb-3">
          Become a partner
        </div>
        <h3 className="font-serif text-3xl md:text-4xl leading-tight text-balance">
          Three ways to put your business in front of the city.
        </h3>
        <ul className="mt-6 space-y-3 text-paper/80 text-sm">
          <li className="flex gap-3">
            <span className="text-sky">01</span>
            <span>
              <strong className="text-paper">Shirt &amp; matchday.</strong>{" "}
              Premium placement on kit, hoardings, and matchday programmes.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-sky">02</span>
            <span>
              <strong className="text-paper">Pitch sponsorship.</strong> A
              square of the virtual pitch with your name on it from £50.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-sky">03</span>
            <span>
              <strong className="text-paper">Custom packages.</strong>{" "}
              Hospitality, training kit, junior football — let's design
              something for you.
            </span>
          </li>
        </ul>
      </div>
      <div className="flex flex-col gap-3">
        <Link
          to="/contact"
          className="bg-sky text-navy text-center px-6 py-3.5 text-sm font-semibold tracking-wide uppercase hover:bg-paper transition-colors"
        >
          Get in touch
        </Link>
        <Link
          to="/pitch"
          className="border border-paper/30 text-paper text-center px-6 py-3.5 text-sm font-medium tracking-wide uppercase hover:bg-paper/10 transition-colors"
        >
          Sponsor a square
        </Link>
      </div>
    </section>
  );
}
