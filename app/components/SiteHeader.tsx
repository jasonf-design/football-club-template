import { NavLink, Link } from "react-router";
import { Crest } from "./Crest";
import { CartIcon } from "./CartIcon";

const NAV = [
  { to: "/news", label: "News" },
  { to: "/fixtures", label: "Fixtures" },
  { to: "/team", label: "Team" },
  { to: "/sponsors", label: "Sponsors" },
  { to: "/pitch", label: "Sponsor a square" },
  { to: "/shop", label: "Shop" },
  { to: "/contact", label: "Contact" },
];

export function SiteHeader({
  nextFixture,
}: {
  nextFixture?: {
    opponent: string;
    homeAway: "home" | "away";
    kickoff: Date;
    competition: string;
  } | null;
}) {
  return (
    <header className="relative z-40">
      {/* Match strip */}
      <div className="bg-navy text-paper text-[11px] tracking-[0.18em] uppercase">
        <div className="max-w-[88rem] mx-auto px-5 sm:px-8 py-2.5 flex items-center gap-4">
          <span className="hidden sm:inline-flex items-center gap-2 text-sky">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky animate-pulse" />
            Next up
          </span>
          {nextFixture ? (
            <span className="flex-1 truncate">
              <span className="text-paper/70">
                {nextFixture.competition} ·{" "}
              </span>
              <span className="font-medium">
                {nextFixture.homeAway === "home" ? "vs" : "at"}{" "}
                {nextFixture.opponent}
              </span>
              <span className="text-paper/70">
                {" · "}
                {nextFixture.kickoff.toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}{" "}
                ·{" "}
                {nextFixture.kickoff.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </span>
          ) : (
            <span className="flex-1 text-paper/60">
              Fixtures to be announced — see the schedule
            </span>
          )}
          <Link
            to="/fixtures"
            className="hidden md:inline text-sky hover:text-paper transition-colors"
          >
            Full schedule →
          </Link>
        </div>
      </div>

      {/* Main bar */}
      <div className="bg-paper border-b border-line">
        <div className="max-w-[88rem] mx-auto px-5 sm:px-8 h-20 flex items-center gap-8">
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <Crest className="h-12 w-12" />
            <div className="leading-tight">
              <div className="font-display text-xl tracking-wide text-navy">
                DONCASTER&nbsp;CITY
              </div>
              <div className="text-[10px] tracking-[0.28em] uppercase text-mute -mt-0.5">
                Football Club · Est 2022
              </div>
            </div>
          </Link>

          <nav className="ml-auto hidden lg:flex items-center gap-7">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "relative text-sm font-medium tracking-wide transition-colors py-2",
                    isActive ? "text-navy" : "text-ink/70 hover:text-navy",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    {isActive && (
                      <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-sky" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
            <span className="h-5 w-px bg-line mx-1" aria-hidden />
            <CartIcon />
          </nav>

          <div className="lg:hidden ml-auto flex items-center gap-2">
            <CartIcon />
          </div>

          <details className="lg:hidden relative">
            <summary className="list-none cursor-pointer p-2 -mr-2 select-none">
              <span className="sr-only">Open menu</span>
              <svg
                width="22"
                height="22"
                viewBox="0 0 22 22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 6h16M3 11h16M3 16h16" />
              </svg>
            </summary>
            <div className="absolute right-0 top-full mt-2 w-60 bg-paper border border-line shadow-xl">
              <nav className="flex flex-col py-2">
                {NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      [
                        "px-4 py-2.5 text-sm border-l-2",
                        isActive
                          ? "border-sky text-navy bg-sky-soft/30"
                          : "border-transparent text-ink/80 hover:bg-line/40",
                      ].join(" ")
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
