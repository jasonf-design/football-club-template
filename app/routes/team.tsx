import { asc, eq, inArray } from "drizzle-orm";
import type { Route } from "./+types/team";
import { db } from "~/db.server";
import { media, players } from "../../db/schema";
import { Container } from "~/components/Container";
import { PageHeader } from "~/components/PageHeader";
import { variantSrcset, variantUrl } from "~/lib/uploads";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "First Team · Doncaster City FC" },
    {
      name: "description",
      content: "Meet the players representing Doncaster City this season.",
    },
  ];
}

export async function loader() {
  const squad = await db
    .select({
      id: players.id,
      name: players.name,
      position: players.position,
      position2: players.position2,
      bio: players.bio,
      photoFilename: media.filename,
      sponsor1Name: players.sponsor1Name,
      sponsor1Url: players.sponsor1Url,
      sponsor1LogoMediaId: players.sponsor1LogoMediaId,
      sponsor2Name: players.sponsor2Name,
      sponsor2Url: players.sponsor2Url,
      sponsor2LogoMediaId: players.sponsor2LogoMediaId,
      sponsorshipUrl: players.sponsorshipUrl,
    })
    .from(players)
    .leftJoin(media, eq(media.id, players.photoMediaId))
    .where(eq(players.active, true))
    .orderBy(asc(players.sortOrder), asc(players.name));

  // Batch-fetch sponsor logo filenames
  const logoIds = squad.flatMap((p) =>
    [p.sponsor1LogoMediaId, p.sponsor2LogoMediaId].filter(Boolean),
  ) as string[];

  const logoMedia = logoIds.length
    ? await db
        .select({ id: media.id, filename: media.filename })
        .from(media)
        .where(inArray(media.id, logoIds))
    : [];
  const logoById = new Map(logoMedia.map((m) => [m.id, m.filename]));

  return {
    squad: squad.map((p) => ({
      ...p,
      sponsor1LogoFilename: p.sponsor1LogoMediaId ? (logoById.get(p.sponsor1LogoMediaId) ?? null) : null,
      sponsor2LogoFilename: p.sponsor2LogoMediaId ? (logoById.get(p.sponsor2LogoMediaId) ?? null) : null,
    })),
  };
}

type SquadPlayer = Awaited<ReturnType<typeof loader>>["squad"][number];

export default function Team({ loaderData }: Route.ComponentProps) {
  const { squad } = loaderData;
  return (
    <>
      <PageHeader
        eyebrow="The squad"
        title="First team."
        lede="The eleven who'll be wearing navy and sky this season. Every player, every position, every story."
      />
      <Container size="wide" className="py-16">
        {squad.length === 0 ? (
          <div className="border border-line bg-paper-warm/40 p-16 text-center">
            <div className="font-serif text-3xl text-navy">
              Squad announcement coming soon.
            </div>
            <p className="mt-3 text-mute max-w-md mx-auto">
              Once the first team is finalised, every player will be introduced here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
            {squad.map((p) => <PlayerCard key={p.id} player={p} />)}
          </div>
        )}
      </Container>
    </>
  );
}

function PlayerCard({ player: p }: { player: SquadPlayer }) {
  const filename = p.photoFilename;
  return (
    <article className="group">
      <div className="aspect-[3/4] bg-navy/5 relative overflow-hidden">
        {filename ? (
          <picture>
            <source
              type="image/avif"
              srcSet={variantSrcset(filename, "avif") ?? undefined}
              sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 48vw"
            />
            <img
              src={variantUrl(filename, 600, "jpeg")}
              srcSet={variantSrcset(filename, "jpeg") ?? undefined}
              sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 48vw"
              alt={p.name}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </picture>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy-deep to-sky/10" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/30 to-transparent" />
      </div>

      <div className="pt-3">
        {(p.position || p.position2) && (
          <div className="text-[10px] uppercase tracking-[0.22em] text-sky-deep">
            {[p.position, p.position2].filter(Boolean).join(" · ")}
          </div>
        )}
        <h3 className="font-serif text-xl text-navy mt-1 leading-tight">{p.name}</h3>

        {/* Shirt sponsorship slots */}
        <div className="mt-2 space-y-1.5">
          <SponsorSlot
            name={p.sponsor1Name}
            url={p.sponsor1Url}
            logoFilename={p.sponsor1LogoFilename}
            sponsorshipUrl={p.sponsorshipUrl}
          />
          <SponsorSlot
            name={p.sponsor2Name}
            url={p.sponsor2Url}
            logoFilename={p.sponsor2LogoFilename}
            sponsorshipUrl={p.sponsorshipUrl}
          />
        </div>
      </div>
    </article>
  );
}

function ensureAbsolute(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
}

function SponsorSlot({
  name,
  url,
  logoFilename,
  sponsorshipUrl,
}: {
  name: string | null;
  url: string | null;
  logoFilename: string | null;
  sponsorshipUrl: string | null;
}) {
  url = ensureAbsolute(url);
  sponsorshipUrl = ensureAbsolute(sponsorshipUrl);
  if (!name) {
    const badge = (
      <div className="flex items-center gap-1.5 border border-dashed border-line px-2 py-1">
        <span className="text-[9px] uppercase tracking-[0.18em] text-mute/60 font-medium">
          Available to sponsor
        </span>
      </div>
    );
    return sponsorshipUrl ? (
      <a href={sponsorshipUrl} target="_blank" rel="noreferrer" className="block hover:opacity-80 transition-opacity">
        {badge}
      </a>
    ) : badge;
  }

  const inner = (
    <div className="flex items-center gap-2 border border-line bg-paper-warm/30 px-2 py-1 min-w-0">
      {logoFilename && (
        <img
          src={variantUrl(logoFilename, 120, "jpeg")}
          alt={name}
          loading="lazy"
          decoding="async"
          className="h-4 w-auto max-w-[40px] object-contain flex-shrink-0"
        />
      )}
      <span className="text-[9px] uppercase tracking-[0.14em] text-navy/70 font-semibold truncate">
        {name}
      </span>
    </div>
  );

  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.14em] text-mute/60 mb-0.5">Sponsored by</div>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="block hover:opacity-80 transition-opacity">
          {inner}
        </a>
      ) : (
        <div>{inner}</div>
      )}
    </div>
  );
}
