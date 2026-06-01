import { Link } from "react-router";
import { Crest } from "./Crest";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 bg-navy text-paper/80">
      <div className="max-w-[88rem] mx-auto px-5 sm:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-12">
          <div>
            <div className="flex items-center gap-3 mb-5">
              <Crest className="h-12 w-12 bg-paper/5 p-1 rounded-full" />
              <div className="leading-tight">
                <div className="font-display text-xl text-paper tracking-wide">
                  DONCASTER CITY FC
                </div>
                <div className="text-[10px] tracking-[0.28em] uppercase text-sky">
                  Est 2022
                </div>
              </div>
            </div>
            <p className="text-sm leading-relaxed max-w-sm">
              A new chapter for football in Doncaster. Built by the community,
              for the community.
            </p>
            <div className="mt-6">
              <FooterTitle>Raise free donations</FooterTitle>
              <a
                href="https://www.easyfundraising.org.uk/causes/doncastercityfc"
                target="_blank"
                rel="noreferrer"
                className="inline-block hover:opacity-80 transition-opacity"
              >
                <img
                  src="/easyfundraising-white.svg"
                  alt="easyfundraising"
                  className="h-5 w-auto"
                />
              </a>
              <p className="mt-2 text-xs text-paper/50 leading-relaxed max-w-[220px]">
                Shop online and raise free donations for the club — it costs you nothing.
              </p>
            </div>
          </div>

          <FooterCol
            title="Club"
            links={[
              { to: "/team", label: "First Team" },
              { to: "/team/under-21s", label: "Under 21s" },
              { to: "/team/under-18s", label: "Under 18s" },
              { to: "/fixtures", label: "Fixtures & Results" },
              { to: "/news", label: "News" },
              { to: "/contact", label: "Contact" },
            ]}
          />
          <FooterCol
            title="Support us"
            links={[
              { to: "/support", label: "Support the club" },
              { to: "/pitch", label: "Sponsor a square" },
              { to: "/sponsors", label: "Partnerships" },
              { to: "/shop", label: "Club shop" },
            ]}
          />
          <div>
            <FooterTitle>Follow</FooterTitle>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://x.com/doncastercityfc"
                  className="inline-flex items-center gap-2 hover:text-sky transition-colors"
                  target="_blank"
                  rel="noreferrer"
                >
                  <XIcon /> X / Twitter
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/doncastercityfc"
                  className="inline-flex items-center gap-2 hover:text-sky transition-colors"
                  target="_blank"
                  rel="noreferrer"
                >
                  <InstagramIcon /> Instagram
                </a>
              </li>
              <li>
                <a
                  href="https://www.facebook.com/doncastercityfc"
                  className="inline-flex items-center gap-2 hover:text-sky transition-colors"
                  target="_blank"
                  rel="noreferrer"
                >
                  <FacebookIcon /> Facebook
                </a>
              </li>
              <li>
                <a
                  href="https://www.tiktok.com/@doncastercityfc"
                  className="inline-flex items-center gap-2 hover:text-sky transition-colors"
                  target="_blank"
                  rel="noreferrer"
                >
                  <TikTokIcon /> TikTok
                </a>
              </li>
              <li>
                <a
                  href="https://www.youtube.com/@DoncasterCity"
                  className="inline-flex items-center gap-2 hover:text-sky transition-colors"
                  target="_blank"
                  rel="noreferrer"
                >
                  <YouTubeIcon /> YouTube
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 pt-8 border-t border-paper/10 flex flex-col md:flex-row justify-between gap-4 text-xs text-paper/50">
          <div>
            © {year} Doncaster City Football Club. All rights reserved.
          </div>
          <div className="flex gap-5">
            <Link to="/contact" className="hover:text-sky transition-colors">
              Contact
            </Link>
            <Link
              to="/admin/login"
              className="hover:text-sky transition-colors"
            >
              Staff login
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.261 5.632 5.903-5.632Zm-1.161 17.52h1.833L7.084 4.126H5.117Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.883v2.27h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function FooterTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.28em] text-sky mb-4">
      {children}
    </div>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { to: string; label: string }[];
}) {
  return (
    <div>
      <FooterTitle>{title}</FooterTitle>
      <ul className="space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="hover:text-sky transition-colors">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
