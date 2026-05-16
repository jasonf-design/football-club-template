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
          </div>

          <FooterCol
            title="Club"
            links={[
              { to: "/team", label: "First Team" },
              { to: "/fixtures", label: "Fixtures & Results" },
              { to: "/news", label: "News" },
              { to: "/contact", label: "Contact" },
            ]}
          />
          <FooterCol
            title="Support us"
            links={[
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
                  className="hover:text-sky transition-colors"
                  target="_blank"
                  rel="noreferrer"
                >
                  X / Twitter
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/doncastercityfc"
                  className="hover:text-sky transition-colors"
                  target="_blank"
                  rel="noreferrer"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href="https://www.facebook.com/doncastercityfc"
                  className="hover:text-sky transition-colors"
                  target="_blank"
                  rel="noreferrer"
                >
                  Facebook
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
