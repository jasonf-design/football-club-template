import { asc, eq } from "drizzle-orm";
import { Link } from "react-router";
import type { Route } from "./+types/sponsors";
import { db } from "~/db.server";
import { media, sponsors } from "../../db/schema";
import { Container } from "~/components/Container";
import { PageHeader } from "~/components/PageHeader";
import { uploadUrlFor } from "~/lib/uploads";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Sponsors & Partnerships · Doncaster City FC" },
    {
      name: "description",
      content:
        "Become a partner of Doncaster City FC. Match-day sponsorship, shirt sponsorship, and pitch squares.",
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
  return { sponsors: all };
}

const TIER_LABEL: Record<string, string> = {
  principal: "Principal Partner",
  official: "Official Partner",
  partner: "Club Partner",
};

export default function Sponsors({ loaderData }: Route.ComponentProps) {
  const { sponsors } = loaderData;
  const grouped = {
    principal: sponsors.filter((s) => s.tier === "principal"),
    official: sponsors.filter((s) => s.tier === "official"),
    partner: sponsors.filter((s) => s.tier === "partner"),
  };
  return (
    <>
      <PageHeader
        eyebrow="Backing the club"
        title="Partner with Doncaster City."
        lede="From shirt sponsorship to a square on the pitch, there's a way for every business — and every supporter — to back the club."
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
          (["principal", "official", "partner"] as const).map((tier) =>
            grouped[tier].length === 0 ? null : (
              <section key={tier}>
                <h2 className="font-display text-2xl tracking-wider text-navy mb-6">
                  {TIER_LABEL[tier].toUpperCase()}
                </h2>
                <div
                  className={[
                    "grid gap-px bg-line",
                    tier === "principal"
                      ? "grid-cols-1 sm:grid-cols-2"
                      : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
                  ].join(" ")}
                >
                  {grouped[tier].map((s) => {
                    const logo = uploadUrlFor(s.logoFilename);
                    return (
                    <a
                      key={s.id}
                      href={s.url ?? "#"}
                      target={s.url ? "_blank" : undefined}
                      rel={s.url ? "noreferrer" : undefined}
                      className="bg-paper aspect-[3/2] flex items-center justify-center p-8 hover:bg-paper-warm transition-colors"
                    >
                      {logo ? (
                        <img
                          src={logo}
                          alt={s.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <div className="font-display text-2xl tracking-wider text-navy/80 text-center">
                          {s.name.toUpperCase()}
                        </div>
                      )}
                    </a>
                    );
                  })}
                </div>
              </section>
            ),
          )
        )}

        <BecomePartnerCTA />
      </Container>
    </>
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
              square of the pitch with your name on it from £50.
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
