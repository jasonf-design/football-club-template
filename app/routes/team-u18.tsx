import type { Route } from "./+types/team-u18";
import { Container } from "~/components/Container";
import { PageHeader } from "~/components/PageHeader";
import { Crest } from "~/components/Crest";

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
  return null;
}

// Update these when coaching staff is confirmed
const COACHING_STAFF = [
  { name: "TBC", role: "Manager" },
  { name: "TBC", role: "Assistant Manager" },
  { name: "TBC", role: "Coach" },
];

export default function TeamU18(_: Route.ComponentProps) {
  return (
    <>
      <PageHeader
        eyebrow="Under 18s"
        title="Growing the game."
        lede="Our Under 18s are the future of Doncaster City FC — developing young talent in a safe, supportive, and competitive environment."
      />

      <Container size="wide" className="py-16">
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

        {/* Coaching staff */}
        <div className="mt-16 pt-12 border-t border-line">
          <div className="text-[10px] uppercase tracking-[0.28em] text-mute mb-8">Coaching staff</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-w-2xl">
            {COACHING_STAFF.map((coach) => (
              <div key={`${coach.role}-${coach.name}`} className="border border-line bg-paper-warm/30 p-4">
                <div className="text-[9px] uppercase tracking-[0.2em] text-sky-deep mb-1">{coach.role}</div>
                <div className="font-serif text-base text-navy">{coach.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Fixtures placeholder */}
        <div className="mt-16 pt-12 border-t border-line">
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
