import { Form, Link, NavLink } from "react-router";
import { Crest } from "./Crest";

type NavItem = { to: string; label: string; end?: boolean; adminOnly?: boolean };

const NAV: NavItem[] = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/posts", label: "News & posts" },
  { to: "/admin/players", label: "Squad" },
  { to: "/admin/fixtures", label: "Fixtures" },
  { to: "/admin/sponsors", label: "Sponsors" },
  { to: "/admin/pitch", label: "Pitch sponsorship" },
  { to: "/admin/shop", label: "Shop" },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/media", label: "Media library" },
  { to: "/admin/stats", label: "Stats sync" },
  { to: "/admin/messages", label: "Contact messages" },
  { to: "/admin/users", label: "Team access", adminOnly: true },
];

export function AdminSidebar({
  user,
}: {
  user: { name: string; email: string; role: string };
}) {
  return (
    <aside className="w-64 shrink-0 bg-navy text-paper flex flex-col min-h-screen">
      <Link
        to="/admin"
        className="flex items-center gap-3 px-5 py-5 border-b border-paper/10"
      >
        <Crest className="h-9 w-9" />
        <div className="leading-tight">
          <div className="font-display text-lg tracking-wide">DCFC</div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-sky">
            Admin
          </div>
        </div>
      </Link>

      <nav className="flex-1 py-4 px-2 space-y-0.5">
        {NAV.filter((item) => !item.adminOnly || user.role === "admin").map(
          (item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  "block px-3 py-2 text-sm rounded transition-colors",
                  isActive
                    ? "bg-sky/20 text-paper border-l-2 border-sky pl-[10px]"
                    : "text-paper/70 hover:text-paper hover:bg-paper/5",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ),
        )}
      </nav>

      <div className="px-5 py-4 border-t border-paper/10">
        <Link
          to="/admin/account"
          className="block group"
        >
          <div className="text-sm text-paper truncate group-hover:text-sky">
            {user.name}
          </div>
          <div className="text-xs text-paper/50 truncate">{user.email}</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-paper/40 mt-1 group-hover:text-sky">
            Account settings
          </div>
        </Link>
        <div className="mt-3 flex items-center gap-3 text-xs">
          <Link
            to="/"
            target="_blank"
            className="text-sky hover:text-paper"
          >
            View site ↗
          </Link>
          <span className="text-paper/20">·</span>
          <Form method="post" action="/admin/logout">
            <button className="text-paper/70 hover:text-paper" type="submit">
              Sign out
            </button>
          </Form>
        </div>
      </div>
    </aside>
  );
}
