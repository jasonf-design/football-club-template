import { Link } from "react-router";
import { count, eq } from "drizzle-orm";
import type { Route } from "./+types/admin-dashboard";
import { db } from "~/db.server";
import {
  contactMessages,
  fixtures,
  pitchOrders,
  pitchSquares,
  players,
  posts,
  shopOrders,
  sponsors,
} from "../../db/schema";
import { isStripeConfigured } from "~/lib/stripe.server";
import { isResendConfigured } from "~/lib/email.server";
import { club } from "~/club.config";

export function meta(_: Route.MetaArgs) {
  return [{ title: `Admin · ${club.name.short}` }];
}

export async function loader() {
  const [
    [{ value: publishedPosts }],
    [{ value: draftPosts }],
    [{ value: upcomingFixtures }],
    [{ value: soldSquares }],
    [{ value: totalSquares }],
    [{ value: pendingPitchOrders }],
    [{ value: unhandledMessages }],
    [{ value: unfulfilledShopOrders }],
    [{ value: activePlayers }],
    [{ value: activeSponsors }],
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(posts)
      .where(eq(posts.status, "published")),
    db
      .select({ value: count() })
      .from(posts)
      .where(eq(posts.status, "draft")),
    db
      .select({ value: count() })
      .from(fixtures)
      .where(eq(fixtures.status, "scheduled")),
    db
      .select({ value: count() })
      .from(pitchSquares)
      .where(eq(pitchSquares.status, "sold")),
    db.select({ value: count() }).from(pitchSquares),
    db
      .select({ value: count() })
      .from(pitchOrders)
      .where(eq(pitchOrders.status, "pending")),
    db
      .select({ value: count() })
      .from(contactMessages)
      .where(eq(contactMessages.handled, false)),
    db
      .select({ value: count() })
      .from(shopOrders)
      .where(eq(shopOrders.status, "paid")),
    db.select({ value: count() }).from(players).where(eq(players.active, true)),
    db
      .select({ value: count() })
      .from(sponsors)
      .where(eq(sponsors.active, true)),
  ]);

  return {
    publishedPosts,
    draftPosts,
    upcomingFixtures,
    soldSquares,
    totalSquares,
    pendingPitchOrders,
    unhandledMessages,
    unfulfilledShopOrders,
    activePlayers,
    activeSponsors,
    stripeConfigured: isStripeConfigured(),
    webhookConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
    resendConfigured: isResendConfigured(),
  };
}

export default function AdminDashboard({ loaderData }: Route.ComponentProps) {
  const d = loaderData;
  return (
    <div className="p-8 md:p-12">
      <header className="mb-10">
        <div className="text-[10px] uppercase tracking-[0.28em] text-sky-deep mb-2">
          Welcome back
        </div>
        <h1 className="font-serif text-4xl text-navy">Dashboard</h1>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-line border border-line">
        <StatTile
          label="Published posts"
          value={d.publishedPosts}
          hint={`${d.draftPosts} draft${d.draftPosts === 1 ? "" : "s"}`}
          to="/admin/posts"
        />
        <StatTile
          label="Upcoming fixtures"
          value={d.upcomingFixtures}
          hint="In schedule"
          to="/admin/fixtures"
        />
        <StatTile
          label="Pitch squares sold"
          value={d.soldSquares}
          hint={
            d.pendingPitchOrders > 0
              ? `${d.pendingPitchOrders} pending order${d.pendingPitchOrders === 1 ? "" : "s"}`
              : "No pending orders"
          }
          to="/admin/pitch"
        />
        <StatTile
          label="Shop orders to fulfil"
          value={d.unfulfilledShopOrders}
          hint="Paid, awaiting ship"
          to="/admin/orders"
        />
        <StatTile
          label="Messages to review"
          value={d.unhandledMessages}
          hint="From contact form"
          to="/admin/messages"
          highlight={d.unhandledMessages > 0}
        />
        <StatTile
          label="Site status"
          value="Live"
          hint="Public site is up"
          to="/"
          external
        />
      </div>

      <section className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card title="Get started">
          <ol className="space-y-3 text-sm text-ink">
            <Step done={d.publishedPosts > 0} href="/admin/posts">
              Publish your first news story
            </Step>
            <Step done={d.upcomingFixtures > 0} href="/admin/fixtures">
              Add this season's fixtures
            </Step>
            <Step done={d.activePlayers > 0} href="/admin/players">
              Add the first-team squad
            </Step>
            <Step done={d.activeSponsors > 0} href="/admin/sponsors">
              Add club partners and sponsors
            </Step>
            <Step done={d.totalSquares > 0} href="/admin/pitch">
              Seed the pitch sponsorship grid
            </Step>
            <Step done={d.soldSquares > 0} href="/admin/pitch">
              Launch the pitch sponsorship campaign
            </Step>
          </ol>
        </Card>
        <Card title="Build status">
          <ul className="space-y-2.5 text-sm text-ink/80">
            <Pill label="Public site" status="ok" note="Live" />
            <Pill label="Admin CMS" status="ok" note="Authenticated" />
            <Pill label="Rich-text editor" status="ok" note="TipTap ready" />
            <Pill label="Image uploads" status="ok" note="Sharp + media library" />
            <Pill
              label="Pitch grid"
              status={d.totalSquares > 0 ? "ok" : "pending"}
              note={
                d.totalSquares > 0
                  ? `${d.totalSquares} squares seeded`
                  : "Run npm run pitch:seed"
              }
            />
            <Pill
              label="Stripe checkout"
              status={d.stripeConfigured ? "ok" : "pending"}
              note={
                d.stripeConfigured ? "Keys configured" : "STRIPE_SECRET_KEY not set"
              }
            />
            <Pill
              label="Stripe webhook"
              status={d.webhookConfigured ? "ok" : "pending"}
              note={
                d.webhookConfigured
                  ? "/api/stripe/webhook secret set"
                  : "STRIPE_WEBHOOK_SECRET not set"
              }
            />
            <Pill
              label="Contact email alerts"
              status={d.resendConfigured ? "ok" : "pending"}
              note={
                d.resendConfigured
                  ? "Resend configured"
                  : "Falls back to admin inbox only"
              }
            />
            <Pill label="Shop" status="pending" note="Phase 4" />
          </ul>
        </Card>
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  to,
  highlight,
  external,
}: {
  label: string;
  value: number | string;
  hint?: string;
  to: string;
  highlight?: boolean;
  external?: boolean;
}) {
  const inner = (
    <div
      className={[
        "bg-paper p-6 h-full transition-colors hover:bg-paper-warm",
        highlight ? "ring-2 ring-inset ring-red/30" : "",
      ].join(" ")}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] text-mute">
        {label}
      </div>
      <div className="scoreboard text-4xl text-navy mt-2 leading-none">
        {value}
      </div>
      {hint && <div className="text-xs text-mute mt-3">{hint}</div>}
    </div>
  );
  if (external) {
    return (
      <a href={to} target="_blank" rel="noreferrer">
        {inner}
      </a>
    );
  }
  return <Link to={to}>{inner}</Link>;
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-paper border border-line p-7">
      <h2 className="font-display text-lg tracking-wider text-navy mb-5">
        {title.toUpperCase()}
      </h2>
      {children}
    </div>
  );
}

function Step({
  done,
  href,
  children,
}: {
  done: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={[
          "mt-0.5 inline-flex h-5 w-5 items-center justify-center text-[10px] font-bold",
          done ? "bg-green text-paper" : "border border-line text-mute",
        ].join(" ")}
      >
        {done ? "✓" : ""}
      </span>
      <Link
        to={href}
        className={[
          "underline-offset-4 hover:underline",
          done ? "text-mute line-through" : "text-ink",
        ].join(" ")}
      >
        {children}
      </Link>
    </li>
  );
}

function Pill({
  label,
  status,
  note,
}: {
  label: string;
  status: "ok" | "pending" | "error";
  note: string;
}) {
  const dot = {
    ok: "bg-green",
    pending: "bg-cream border border-mute/30",
    error: "bg-red",
  }[status];
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2.5">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </span>
      <span className="text-xs text-mute">{note}</span>
    </li>
  );
}
