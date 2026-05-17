import { asc, desc, eq, inArray } from "drizzle-orm";
import { Link, redirect, useActionData } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/pitch";
import { db } from "~/db.server";
import { pitchOrders, pitchSquares } from "../../db/schema";
import { Container } from "~/components/Container";
import { PageHeader } from "~/components/PageHeader";
import { PitchGrid } from "~/components/PitchGrid";
import { expireStaleHolds, HOLD_TTL_MS } from "~/lib/pitch.server";
import {
  getStripe,
  isStripeConfigured,
  publicUrl,
  StripeNotConfiguredError,
} from "~/lib/stripe.server";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Sponsor a square · Doncaster City FC" },
    {
      name: "description",
      content:
        "Sponsor a square of the Doncaster City FC pitch from £50. Your name on the pitch map, in the matchday programme, and on the Supporters Wall for the whole season.",
    },
  ];
}

export async function loader() {
  await expireStaleHolds();

  const all = await db
    .select()
    .from(pitchSquares)
    .orderBy(asc(pitchSquares.row), asc(pitchSquares.col));

  const sold = all.filter((s) => s.status === "sold");
  const pricePence = all[0]?.pricePence ?? 5000;
  const supporters = await db
    .select({
      id: pitchSquares.id,
      sponsorName: pitchSquares.sponsorName,
      zone: pitchSquares.zone,
      row: pitchSquares.row,
      col: pitchSquares.col,
      updatedAt: pitchSquares.updatedAt,
    })
    .from(pitchSquares)
    .where(eq(pitchSquares.status, "sold"))
    .orderBy(desc(pitchSquares.updatedAt));

  const rows = all.length === 0 ? 0 : Math.max(...all.map((s) => s.row));
  const cols = all.length === 0 ? 0 : Math.max(...all.map((s) => s.col));

  return {
    squares: all.map((s) => ({
      id: s.id,
      row: s.row,
      col: s.col,
      zone: s.zone,
      status: s.status,
      sponsorName: s.sponsorName,
      pricePence: s.pricePence,
    })),
    config: { rows, cols, pricePence },
    soldCount: sold.length,
    totalCount: all.length,
    raisedPence: sold.length * pricePence,
    goalPence: all.length * pricePence,
    supporters,
    stripeReady: isStripeConfigured(),
  };
}

const checkoutSchema = z.object({
  squareIds: z
    .string()
    .min(1, "Pick at least one square")
    .transform((s) =>
      s
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((n) => Number.isInteger(n) && n > 0),
    )
    .refine((arr) => arr.length > 0, "Pick at least one square")
    .refine((arr) => arr.length <= 50, "Maximum 50 squares per order"),
  displayName: z
    .string()
    .min(2, "Tell us the name to display")
    .max(60, "Keep it under 60 characters"),
  email: z.string().email("That doesn't look like a valid email"),
  contactName: z.string().max(120).optional(),
});

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const parsed = checkoutSchema.safeParse({
    squareIds: form.get("squareIds") ?? "",
    displayName: form.get("displayName"),
    email: form.get("email"),
    contactName: form.get("contactName") || undefined,
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Please check the form.",
    };
  }
  const { squareIds, displayName, email, contactName } = parsed.data;

  // Expire stale holds first so we have an accurate availability snapshot.
  await expireStaleHolds();

  // Re-fetch the requested squares to verify availability.
  const rows = await db
    .select()
    .from(pitchSquares)
    .where(inArray(pitchSquares.id, squareIds));
  if (rows.length !== squareIds.length) {
    return {
      error:
        "One or more squares no longer exist. Refresh the page and try again.",
    };
  }
  const unavailable = rows.filter((r) => r.status !== "available");
  if (unavailable.length > 0) {
    return {
      error: `${unavailable.length} of your squares were claimed while you were choosing. Refresh and try again.`,
    };
  }

  const pricePence = rows[0].pricePence;
  const totalPence = pricePence * rows.length;
  const holdExpiresAt = new Date(Date.now() + HOLD_TTL_MS);

  // Insert the order.
  const [order] = await db
    .insert(pitchOrders)
    .values({
      email,
      contactName: contactName ?? null,
      displayName,
      totalPence,
      squareCount: rows.length,
      status: "pending",
      holdExpiresAt,
    })
    .returning();

  // Hold the squares.
  await db
    .update(pitchSquares)
    .set({ status: "pending", orderId: order.id })
    .where(inArray(pitchSquares.id, squareIds));

  if (!isStripeConfigured()) {
    // Release the hold so the user can try again later.
    await db
      .update(pitchSquares)
      .set({ status: "available", orderId: null })
      .where(inArray(pitchSquares.id, squareIds));
    await db
      .update(pitchOrders)
      .set({ status: "cancelled" })
      .where(eq(pitchOrders.id, order.id));
    return {
      error:
        "Online payments aren't enabled yet. Send us a note via the contact page and we'll reserve your squares manually.",
    };
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          quantity: rows.length,
          price_data: {
            currency: "gbp",
            unit_amount: pricePence,
            product_data: {
              name: "Pitch square sponsorship",
              description: `Doncaster City FC · ${rows.length} square${rows.length === 1 ? "" : "s"} · Display name: "${displayName}"`,
            },
          },
        },
      ],
      metadata: {
        kind: "pitch",
        orderId: order.id,
      },
      success_url: `${publicUrl()}/pitch/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${publicUrl()}/pitch/cancel?order_id=${order.id}`,
      expires_at: Math.floor(holdExpiresAt.getTime() / 1000),
    });

    await db
      .update(pitchOrders)
      .set({ stripeSessionId: session.id })
      .where(eq(pitchOrders.id, order.id));

    if (!session.url) {
      throw new Error("Stripe didn't return a checkout URL");
    }
    throw redirect(session.url);
  } catch (err) {
    if (err instanceof Response) throw err; // it's our redirect
    if (err instanceof StripeNotConfiguredError) {
      return { error: err.message };
    }
    await db
      .update(pitchSquares)
      .set({ status: "available", orderId: null })
      .where(inArray(pitchSquares.id, squareIds));
    await db
      .update(pitchOrders)
      .set({ status: "cancelled" })
      .where(eq(pitchOrders.id, order.id));
    console.error("[pitch checkout] failed to create Stripe session:", err);
    return {
      error:
        "Couldn't reach Stripe just now. Your squares have been released — please try again.",
    };
  }
}

export default function Pitch({ loaderData }: Route.ComponentProps) {
  const {
    squares,
    config,
    soldCount,
    totalCount,
    raisedPence,
    goalPence,
    supporters,
    stripeReady,
  } = loaderData;
  const result = useActionData<typeof action>();

  if (totalCount === 0) {
    return <PitchNotSeeded />;
  }

  const percent =
    goalPence > 0 ? Math.min(100, Math.round((raisedPence / goalPence) * 100)) : 0;

  return (
    <>
      <PageHeader
        eyebrow="Pitch sponsorship"
        title="Put your name on our pitch."
        lede={`Sponsor a square of the playing surface for the season. Your name appears on the pitch map, in the matchday programme, and on the Supporters Wall — for just £${(config.pricePence / 100).toFixed(0)} per square.`}
      />

      {/* Progress strip */}
      <section className="bg-paper-warm border-y border-line">
        <Container size="wide" className="py-8">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-mute mb-2">
                Campaign progress
              </div>
              <div className="flex items-baseline gap-4">
                <div className="scoreboard text-5xl text-navy leading-none">
                  £{(raisedPence / 100).toLocaleString("en-GB")}
                </div>
                <div className="text-mute text-sm">
                  of £{(goalPence / 100).toLocaleString("en-GB")} raised
                </div>
              </div>
              <div className="mt-4 h-2 bg-line w-full max-w-xl">
                <div
                  className="h-full bg-sky transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-x-6 text-center md:text-right">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.22em] text-mute">
                  Sold
                </dt>
                <dd className="scoreboard text-2xl text-navy mt-1">
                  {soldCount}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.22em] text-mute">
                  Left
                </dt>
                <dd className="scoreboard text-2xl text-navy mt-1">
                  {totalCount - soldCount}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.22em] text-mute">
                  Total
                </dt>
                <dd className="scoreboard text-2xl text-navy mt-1">
                  {totalCount}
                </dd>
              </div>
            </dl>
          </div>
        </Container>
      </section>

      {/* Grid + side panel */}
      <Container size="wide" className="py-12">
        <PitchGrid
          squares={squares}
          config={config}
          stripeReady={stripeReady}
          error={result?.error}
        />
      </Container>

      {/* Supporters wall */}
      <SupportersWall supporters={supporters} />

      {/* How it works */}
      <section className="bg-paper-warm border-y border-line">
        <Container size="wide" className="py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-sky-deep mb-3">
                How it works
              </div>
              <h2 className="font-serif text-3xl text-navy leading-tight">
                Four steps. Done in two minutes.
              </h2>
            </div>
            <ol className="space-y-4 text-ink">
              <Step n={1}>
                Tap any available square on the pitch above. Pick as many as
                you like.
              </Step>
              <Step n={2}>
                Enter the name you'd like to appear on the pitch (you, your
                family, your business).
              </Step>
              <Step n={3}>
                Pay securely through Stripe. £
                {(config.pricePence / 100).toFixed(0)} per square.
              </Step>
              <Step n={4}>
                Your name lands on the pitch map, the matchday programme and
                the Supporters Wall — all season long.
              </Step>
            </ol>
          </div>
        </Container>
      </section>
    </>
  );
}

function Step({
  n,
  children,
}: {
  n: number;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span className="scoreboard text-2xl text-sky leading-none">
        {String(n).padStart(2, "0")}
      </span>
      <span className="pt-1">{children}</span>
    </li>
  );
}

function SupportersWall({
  supporters,
}: {
  supporters: {
    id: number;
    sponsorName: string | null;
    zone: string;
    row: number;
    col: number;
  }[];
}) {
  if (supporters.length === 0) return null;
  return (
    <section>
      <Container size="wide" className="py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-sky-deep mb-3">
              The Supporters Wall
            </div>
            <h2 className="font-serif text-4xl text-navy leading-tight">
              Every name on our pitch.
            </h2>
          </div>
          <div className="text-mute text-sm hidden sm:block">
            {supporters.length} backer{supporters.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm">
          {supporters.map((s) => (
            <div
              key={s.id}
              className="py-2 border-b border-line text-ink truncate"
              title={`${s.zone} · R${s.row} · C${s.col}`}
            >
              {s.sponsorName ?? "Anonymous backer"}
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function PitchNotSeeded() {
  return (
    <>
      <PageHeader
        eyebrow="Pitch sponsorship"
        title="Almost ready."
        lede="The pitch grid is being prepared. Check back soon — or get in touch to register your interest."
      />
      <Container size="wide" className="py-16">
        <div className="border border-line bg-paper-warm/40 p-12 text-center">
          <div className="font-serif text-2xl text-navy">
            The pitch hasn't been seeded yet.
          </div>
          <p className="mt-2 text-mute text-sm">
            An admin needs to run <code>npm run pitch:seed</code> to lay out
            the squares.
          </p>
          <div className="mt-6">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 bg-navy text-paper px-6 py-3 text-sm font-semibold tracking-wide uppercase hover:bg-navy-deep transition-colors"
            >
              Get in touch
            </Link>
          </div>
        </div>
      </Container>
    </>
  );
}
