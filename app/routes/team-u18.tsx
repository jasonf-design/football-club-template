import { and, asc, eq, inArray } from "drizzle-orm";
import type { Route } from "./+types/team-u18";
import { db } from "~/db.server";
import { coachingStaff, media } from "../../db/schema";
import { Container } from "~/components/Container";
import { PageHeader } from "~/components/PageHeader";
import { Crest } from "~/components/Crest";
import { CoachingSection } from "~/components/CoachingSection";

const PRESEASON_FIXTURES = [
  { no: 1,  month: "Jun", day: 25, year: 2026, dayName: "Thu", opponent: "Dodworth MW 18's",       kickoff: "7:00PM"  },
  { no: 2,  month: "Jul", day:  1, year: 2026, dayName: "Wed", opponent: "Abbey Lane 18's",         kickoff: "7:00PM"  },
  { no: 3,  month: "Jul", day:  5, year: 2026, dayName: "Sun", opponent: "Askern Reds 18's",        kickoff: "10:30AM" },
  { no: 4,  month: "Jul", day:  8, year: 2026, dayName: "Wed", opponent: "Scorps Open Age",         kickoff: "7:00PM"  },
  { no: 5,  month: "Jul", day: 29, year: 2026, dayName: "Wed", opponent: "Union Jack Open Age",     kickoff: "7:00PM"  },
  { no: 6,  month: "Aug", day:  2, year: 2026, dayName: "Sun", opponent: "Dodworth MWU17's",        kickoff: "10:30AM" },
  { no: 7,  month: "Aug", day:  5, year: 2026, dayName: "Wed", opponent: "TBC",                     kickoff: "7:00PM"  },
  { no: 8,  month: "Aug", day:  9, year: 2026, dayName: "Sun", opponent: "Grimsby Town 18's",       kickoff: "10:30AM" },
  { no: 9,  month: "Aug", day: 12, year: 2026, dayName: "Wed", opponent: "Millmoor 18's",           kickoff: "7:00PM"  },
  { no: 10, month: "Aug", day: 16, year: 2026, dayName: "Sun", opponent: "Mexborough Rangers 18's", kickoff: "10:30AM" },
  { no: 11, month: "Aug", day: 19, year: 2026, dayName: "Wed", opponent: "Dodworth MW18's",         kickoff: "7:00PM"  },
  { no: 12, month: "Aug", day: 23, year: 2026, dayName: "Sun", opponent: "Dearne & District 18's",  kickoff: "10:30AM" },
];

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Under 18s · Doncaster City FC" },
    {
      name: "description",
      content: "Doncaster City FC Under 18s — developing the next generation of local talent.",
    },
  ];
}

export async function loader() {
  const staffRows = await db
    .select({ name: coachingStaff.name, role: coachingStaff.role, photoMediaId: coachingStaff.photoMediaId })
    .from(coachingStaff)
    .where(and(eq(coachingStaff.team, "u18"), eq(coachingStaff.active, true)))
    .orderBy(asc(coachingStaff.sortOrder), asc(coachingStaff.name));

  const staffPhotoIds = staffRows.map((s) => s.photoMediaId).filter(Boolean) as string[];
  const staffPhotos = staffPhotoIds.length
    ? await db.select({ id: media.id, filename: media.filename }).from(media).where(inArray(media.id, staffPhotoIds))
    : [];
  const staffPhotoById = new Map(staffPhotos.map((m) => [m.id, m.filename]));

  return {
    staff: staffRows.map((s) => ({
      name: s.name,
      role: s.role,
      photoFilename: s.photoMediaId ? (staffPhotoById.get(s.photoMediaId) ?? null) : null,
    })),
  };
}

export default function TeamU18({ loaderData }: Route.ComponentProps) {
  const { staff } = loaderData;
  return (
    <>
      <PageHeader
        eyebrow="Under 18s"
        title="Growing the game."
        lede="Our Under 18s are the future of Doncaster City FC — developing young talent in a safe, supportive, and competitive environment."
      />

      <Container size="wide" className="py-16">
        {/* Pre-season schedule */}
        <div className="mb-16 pb-12 border-b border-line">
          <div className="text-[10px] uppercase tracking-[0.28em] text-sky-deep mb-3">Pre-season 2026</div>
          <h2 className="font-serif text-3xl text-navy mb-8">U18s Pre-Season Schedule 2026</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-navy text-paper text-[10px] uppercase tracking-[0.18em]">
                  <th className="px-4 py-3 text-left font-medium w-10">No.</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Day</th>
                  <th className="px-4 py-3 text-left font-medium">Opponent</th>
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
                    <td className="px-4 py-3 font-medium text-navy">{f.opponent}</td>
                    <td className="px-4 py-3 text-right text-mute tabular-nums">{f.kickoff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Venue */}
          <div className="mt-6 flex items-start gap-4 bg-navy text-paper px-6 py-5 max-w-xl">
            <svg className="shrink-0 mt-0.5 text-sky" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-sky mb-1">All games at</div>
              <div className="font-semibold tracking-wide">Thurnscoe Sports Ground</div>
              <div className="text-sm text-paper/70 mt-0.5">Welfare Road, Thurnscoe, Rotherham S63 0JZ</div>
            </div>
          </div>
        </div>

        {/* Club badge + about */}
        <div className="flex flex-col md:flex-row gap-12 items-start max-w-4xl">
          <div className="flex-shrink-0 flex justify-center md:justify-start">
            <div className="bg-navy/5 border border-line p-10 inline-flex">
              <Crest className="h-40 w-40 text-navy" />
            </div>
          </div>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-[0.28em] text-mute mb-3">About the team</div>
            <p className="text-ink leading-relaxed text-base">
              Doncaster City FC Under 18s compete in local youth football, giving young players in the Doncaster area a
              pathway to develop their game in line with the club's values — discipline, respect, and a love for the
              beautiful game.
            </p>
            <p className="text-ink leading-relaxed text-base mt-4">
              In line with our safeguarding commitments, we do not publish player names or images for our Under 18s
              squad. Parents or guardians wishing to find out more are welcome to get in touch via the contact page.
            </p>
            <div className="mt-6">
              <a
                href="/contact"
                className="inline-flex items-center gap-2 bg-navy text-paper px-5 py-2.5 text-sm font-semibold tracking-wide uppercase hover:bg-navy-deep transition-colors"
              >
                Get in touch
              </a>
            </div>
          </div>
        </div>

        <CoachingSection staff={staff} />

        {/* Fixtures placeholder */}
        <div className="mt-12 pt-12 border-t border-line">
          <div className="text-[10px] uppercase tracking-[0.28em] text-mute mb-4">Fixtures &amp; results</div>
          <div className="border border-dashed border-line bg-paper-warm/20 p-10 text-center max-w-xl">
            <div className="font-serif text-xl text-navy/60">Coming soon</div>
            <p className="mt-2 text-sm text-mute">
              Live fixtures and results via FA Fulltime will appear here once connected.
            </p>
          </div>
        </div>
      </Container>
    </>
  );
}
