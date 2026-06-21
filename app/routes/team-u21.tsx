import { and, asc, eq, inArray } from "drizzle-orm";
import { Link } from "react-router";
import type { Route } from "./+types/team-u21";
import { db } from "~/db.server";
import { coachingStaff, media, players } from "../../db/schema";
import { Container } from "~/components/Container";
import { PageHeader } from "~/components/PageHeader";
import { variantSrcset, variantUrl } from "~/lib/uploads";
import { CoachingSection } from "~/components/CoachingSection";

const PRESEASON_FIXTURES = [
  { no: 1, month: "Jul", day: 31, year: 2026, dayName: "Fri", opponent: "Matlock Town U21s",       ha: "A", venue: "Venue TBC",                                                                        kickoff: "7:30PM" },
  { no: 2, month: "Aug", day:  6, year: 2026, dayName: "Thu", opponent: "Penistone Church U21s",   ha: "A", venue: "Parker Roofing Memorial Ground, Church View Rd, Penistone, Sheffield S36 6AT",    kickoff: "7:30PM" },
  { no: 3, month: "Aug", day: 12, year: 2026, dayName: "Wed", opponent: "Armthorpe Welfare U21s",  ha: "A", venue: "Marra Falcons Stadium, Church St, Armthorpe, Doncaster DN3 3AG",                  kickoff: "7:30PM" },
];

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Under 23s · Doncaster City FC" },
    {
      name: "description",
      content: "Meet the Doncaster City FC Under 23s squad.",
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
    })
    .from(players)
    .leftJoin(media, eq(media.id, players.photoMediaId))
    .where(and(eq(players.active, true), eq(players.team, "u23")))
    .orderBy(asc(players.sortOrder), asc(players.name));

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

  const staffRows = await db
    .select({ name: coachingStaff.name, role: coachingStaff.role, photoMediaId: coachingStaff.photoMediaId })
    .from(coachingStaff)
    .where(and(eq(coachingStaff.team, "u23"), eq(coachingStaff.active, true)))
    .orderBy(asc(coachingStaff.sortOrder), asc(coachingStaff.name));

  const staffPhotoIds = staffRows.map((s) => s.photoMediaId).filter(Boolean) as string[];
  const staffPhotos = staffPhotoIds.length
    ? await db.select({ id: media.id, filename: media.filename }).from(media).where(inArray(media.id, staffPhotoIds))
    : [];
  const staffPhotoById = new Map(staffPhotos.map((m) => [m.id, m.filename]));

  return {
    squad: squad.map((p) => ({
      ...p,
      sponsor1LogoFilename: p.sponsor1LogoMediaId ? (logoById.get(p.sponsor1LogoMediaId) ?? null) : null,
      sponsor2LogoFilename: p.sponsor2LogoMediaId ? (logoById.get(p.sponsor2LogoMediaId) ?? null) : null,
    })),
    staff: staffRows.map((s) => ({
      name: s.name,
      role: s.role,
      photoFilename: s.photoMediaId ? (staffPhotoById.get(s.photoMediaId) ?? null) : null,
    })),
  };
}

type SquadPlayer = Awaited<ReturnType<typeof loader>>["squad"][number];

export default function TeamU21({ loaderData }: Route.ComponentProps) {
  const { squad, staff } = loaderData;
  return (
    <>
      <PageHeader
        eyebrow="Under 23s"
        title="The next generation."
        lede="The squad developing through the Doncaster City system. Tomorrow's first team, playing today."
      />
      <Container size="wide" className="py-16">
        {/* Pre-season fixtures */}
        <div className="mb-16 pb-12 border-b border-line">
          <div className="text-[10px] uppercase tracking-[0.28em] text-sky-deep mb-3">Pre-season 2026</div>
          <h2 className="font-serif text-3xl text-navy mb-8">U21s Pre-Season Schedule 2026</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-navy text-paper text-[10px] uppercase tracking-[0.18em]">
                  <th className="px-4 py-3 text-left font-medium w-10">No.</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Day</th>
                  <th className="px-4 py-3 text-left font-medium">Opponent &amp; Venue</th>
                  <th className="px-4 py-3 text-right font-medium">KO</th>
                </tr>
              </thead>
              <tbody>
                {PRESEASON_FIXTURES.map((f, i) => (
                  <tr
                    key={f.no}
                    className={[
                      "border-b border-line transition-colors hover:bg-sky/5",
                      i % 2 === 0 ? "bg-paper" : "bg-paper-warm/30",
                    ].join(" ")}
                  >
                    <td className="px-4 py-3 scoreboard text-navy/40 text-base">{String(f.no).padStart(2, "0")}</td>
                    <td className="px-4 py-3">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-mute">{f.month}</div>
                      <div className="font-semibold text-navy leading-none">{f.day}</div>
                      <div className="text-[10px] text-mute">{f.year}</div>
                    </td>
                    <td className="px-4 py-3 text-mute hidden sm:table-cell">{f.dayName}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-navy">{f.opponent}</span>
                        <span className={[
                          "text-[9px] font-bold px-1.5 py-0.5 uppercase tracking-wide flex-shrink-0",
                          f.ha === "H" ? "bg-navy text-paper" : f.ha === "A" ? "border border-line text-navy" : "bg-sky/20 text-navy",
                        ].join(" ")}>{f.ha}</span>
                      </div>
                      <div className="text-[10px] text-mute mt-0.5">{f.venue}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-mute tabular-nums whitespace-nowrap">{f.kickoff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {squad.length === 0 ? (
          <div className="border border-line bg-paper-warm/40 p-16 text-center">
            <div className="font-serif text-3xl text-navy">
              Squad announcement coming soon.
            </div>
            <p className="mt-3 text-mute max-w-md mx-auto">
              Once the Under 23s squad is finalised, every player will be introduced here.
            </p>
          </div>
        ) : (
          <>
            <h2 className="sr-only">Players</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
              {squad.map((p) => <PlayerCard key={p.id} player={p} />)}
            </div>
          </>
        )}

        <CoachingSection staff={staff} />
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

        <div className="mt-2 space-y-1.5">
          <SponsorSlot
            name={p.sponsor1Name}
            url={p.sponsor1Url}
            logoFilename={p.sponsor1LogoFilename}
            sponsorRoute={`/sponsor/${p.id}`}
          />
          <SponsorSlot
            name={p.sponsor2Name}
            url={p.sponsor2Url}
            logoFilename={p.sponsor2LogoFilename}
            sponsorRoute={`/sponsor/${p.id}`}
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
  sponsorRoute,
}: {
  name: string | null;
  url: string | null;
  logoFilename: string | null;
  sponsorRoute: string;
}) {
  url = ensureAbsolute(url);
  if (!name) {
    return (
      <Link to={sponsorRoute} className="block hover:opacity-80 transition-opacity">
        <div className="flex items-center gap-1.5 border border-dashed border-line px-2 py-1">
          <span className="text-[9px] uppercase tracking-[0.18em] text-mute font-medium">
            Available to sponsor
          </span>
        </div>
      </Link>
    );
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
      <div className="text-[9px] uppercase tracking-[0.14em] text-mute mb-0.5">Sponsored by</div>
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
