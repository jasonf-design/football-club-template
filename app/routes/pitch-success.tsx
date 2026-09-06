import { eq, inArray } from "drizzle-orm";
import { Link, redirect } from "react-router";
import type { Route } from "./+types/pitch-success";
import { db } from "~/db.server";
import { pitchOrders, pitchSquares } from "../../db/schema";
import { Container } from "~/components/Container";
import { PageHeader } from "~/components/PageHeader";
import {
  getStripe,
  isStripeConfigured,
} from "~/lib/stripe.server";
import { club } from "~/club.config";

export function meta(_: Route.MetaArgs) {
  return [{ title: `Thank you · ${club.name.short}` }];
}

/**
 * Fallback finaliser: if the user lands here before the webhook fires, retrieve
 * the session from Stripe and mark squares sold ourselves. Idempotent — safe
 * to run again if the webhook beats us to it.
 */
async function finaliseFromStripe(sessionId: string) {
  if (!isStripeConfigured()) return null;
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid") return session;
  const orderId = session.metadata?.orderId;
  if (!orderId) return session;
  const [order] = await db
    .select()
    .from(pitchOrders)
    .where(eq(pitchOrders.id, orderId))
    .limit(1);
  if (!order) return session;
  if (order.status === "paid") return session;
  const held = await db
    .select({ id: pitchSquares.id })
    .from(pitchSquares)
    .where(eq(pitchSquares.orderId, order.id));
  if (held.length > 0) {
    await db
      .update(pitchSquares)
      .set({ status: "sold", sponsorName: order.displayName })
      .where(
        inArray(
          pitchSquares.id,
          held.map((s) => s.id),
        ),
      );
  }
  await db
    .update(pitchOrders)
    .set({
      status: "paid",
      paidAt: new Date(),
      stripePaymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null),
    })
    .where(eq(pitchOrders.id, order.id));
  return session;
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) throw redirect("/pitch");

  try {
    await finaliseFromStripe(sessionId);
  } catch (err) {
    console.error("[pitch success] finalise failed:", err);
  }

  const [order] = await db
    .select()
    .from(pitchOrders)
    .where(eq(pitchOrders.stripeSessionId, sessionId))
    .limit(1);
  if (!order) {
    return { order: null, squares: [] as { id: number }[] };
  }
  const squares = await db
    .select({
      id: pitchSquares.id,
      row: pitchSquares.row,
      col: pitchSquares.col,
      zone: pitchSquares.zone,
    })
    .from(pitchSquares)
    .where(eq(pitchSquares.orderId, order.id));
  return { order, squares };
}

export default function PitchSuccess({ loaderData }: Route.ComponentProps) {
  const { order, squares } = loaderData;
  if (!order) {
    return (
      <>
        <PageHeader
          eyebrow="Thank you"
          title="We're processing your sponsorship."
          lede="Your payment is on its way through. Refresh in a moment to see your name on the virtual pitch."
        />
        <Container size="wide" className="py-12 text-center">
          <Link
            to="/pitch"
            className="inline-flex items-center gap-2 bg-navy text-paper px-6 py-3 text-sm font-semibold tracking-wide uppercase hover:bg-navy-deep transition-colors"
          >
            Back to the pitch
          </Link>
        </Container>
      </>
    );
  }
  const isPaid = order.status === "paid";
  return (
    <>
      <PageHeader
        eyebrow={isPaid ? "You're on the virtual pitch" : "Almost there"}
        title={isPaid ? "Welcome to the wall." : "Confirming your payment…"}
        lede={
          isPaid
            ? `Thank you ${order.displayName}. Your name is now on ${order.squareCount} square${order.squareCount === 1 ? "" : "s"} for the season.`
            : "Stripe has accepted your payment — we're just finalising the squares on our end. This usually takes a few seconds."
        }
      />
      <Container size="wide" className="py-12">
        <div className="bg-paper border border-line p-8 max-w-2xl">
          <dl className="grid grid-cols-2 gap-y-5 gap-x-8 text-sm">
            <div>
              <dt className="text-[10px] uppercase tracking-[0.22em] text-mute">
                Display name
              </dt>
              <dd className="font-serif text-xl text-navy mt-1">
                {order.displayName}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.22em] text-mute">
                Squares
              </dt>
              <dd className="scoreboard text-2xl text-navy mt-1">
                {order.squareCount}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.22em] text-mute">
                Total
              </dt>
              <dd className="scoreboard text-2xl text-navy mt-1">
                £{(order.totalPence / 100).toLocaleString("en-GB")}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.22em] text-mute">
                Receipt to
              </dt>
              <dd className="text-ink mt-1">{order.email}</dd>
            </div>
          </dl>
          {squares.length > 0 && (
            <div className="mt-6 pt-5 border-t border-line">
              <div className="text-[10px] uppercase tracking-[0.24em] text-mute mb-2">
                Your squares
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs text-ink">
                {squares.map((s) => (
                  <span
                    key={s.id}
                    className="px-2 py-0.5 bg-paper-warm border border-line"
                  >
                    {s.zone} · R{s.row} · C{s.col}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="mt-8">
          <Link
            to="/pitch"
            className="inline-flex items-center gap-2 bg-navy text-paper px-6 py-3 text-sm font-semibold tracking-wide uppercase hover:bg-navy-deep transition-colors"
          >
            View the pitch
          </Link>
        </div>
      </Container>
    </>
  );
}
