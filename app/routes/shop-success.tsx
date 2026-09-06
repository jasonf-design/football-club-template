import { eq } from "drizzle-orm";
import { Link, redirect } from "react-router";
import { useEffect } from "react";
import type { Route } from "./+types/shop-success";
import { db } from "~/db.server";
import { products, shopOrders } from "../../db/schema";
import { Container } from "~/components/Container";
import { PageHeader } from "~/components/PageHeader";
import {
  getStripe,
  isStripeConfigured,
} from "~/lib/stripe.server";
import { clearCart } from "~/lib/cart";
import { club } from "~/club.config";

export function meta(_: Route.MetaArgs) {
  return [{ title: `Thank you · ${club.name.short}` }];
}

type LineItem = {
  productId: string;
  slug: string;
  name: string;
  qty: number;
  pricePence: number;
};

/**
 * Fallback for when the user lands here before the Stripe webhook has fired.
 * Idempotent: re-running once the webhook arrives is a no-op.
 */
async function finaliseFromStripe(sessionId: string) {
  if (!isStripeConfigured()) return;
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid") return;
  const orderId = session.metadata?.orderId;
  if (!orderId) return;
  const [order] = await db
    .select()
    .from(shopOrders)
    .where(eq(shopOrders.id, orderId))
    .limit(1);
  if (!order || order.status === "paid") return;

  // Decrement stock for items that track it. Lazily — don't fail the
  // confirmation page if a single update fails.
  const lineItems = (order.lineItemsJson as LineItem[] | null) ?? [];
  for (const li of lineItems) {
    try {
      const [p] = await db
        .select({ id: products.id, stock: products.stock })
        .from(products)
        .where(eq(products.id, li.productId))
        .limit(1);
      if (p && p.stock != null) {
        await db
          .update(products)
          .set({ stock: Math.max(0, p.stock - li.qty) })
          .where(eq(products.id, p.id));
      }
    } catch (err) {
      console.error("[shop success] stock decrement failed", err);
    }
  }

  await db
    .update(shopOrders)
    .set({
      status: "paid",
      paidAt: new Date(),
      stripePaymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null),
      shippingJson: (session.customer_details as unknown) ?? null,
    })
    .where(eq(shopOrders.id, order.id));
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) throw redirect("/shop");
  try {
    await finaliseFromStripe(sessionId);
  } catch (err) {
    console.error("[shop success] finalise failed:", err);
  }
  const [order] = await db
    .select()
    .from(shopOrders)
    .where(eq(shopOrders.stripeSessionId, sessionId))
    .limit(1);
  return { order: order ?? null };
}

export default function ShopSuccess({ loaderData }: Route.ComponentProps) {
  const { order } = loaderData;

  // Clear cart on the client when we land on success.
  useEffect(() => {
    clearCart();
  }, []);

  if (!order) {
    return (
      <>
        <PageHeader
          eyebrow="Thank you"
          title="We're processing your order."
          lede="Your payment is on its way through. Refresh in a moment and you'll see the full receipt."
        />
        <Container size="wide" className="py-12 text-center">
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 bg-navy text-paper px-6 py-3 text-sm font-semibold tracking-wide uppercase hover:bg-navy-deep transition-colors"
          >
            Back to the shop
          </Link>
        </Container>
      </>
    );
  }
  const isPaid = order.status === "paid";
  const lineItems = (order.lineItemsJson as unknown as LineItem[] | null) ?? [];
  return (
    <>
      <PageHeader
        eyebrow={isPaid ? "Order confirmed" : "Almost there"}
        title={isPaid ? "Thanks for backing the club." : "Confirming your order…"}
        lede={
          isPaid
            ? "Your gear is on its way. We've emailed your receipt — you can close this page or keep browsing."
            : "Stripe has accepted your payment — we're just finalising your order. This usually takes a few seconds."
        }
      />
      <Container size="wide" className="py-12">
        <div className="bg-paper border border-line p-8 max-w-2xl">
          <dl className="grid grid-cols-2 gap-y-5 gap-x-8 text-sm">
            <div>
              <dt className="text-[10px] uppercase tracking-[0.22em] text-mute">
                Receipt to
              </dt>
              <dd className="text-ink mt-1">{order.email}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.22em] text-mute">
                Total
              </dt>
              <dd className="scoreboard text-2xl text-navy mt-1">
                £{(order.totalPence / 100).toFixed(2)}
              </dd>
            </div>
          </dl>
          {lineItems.length > 0 && (
            <div className="mt-6 pt-5 border-t border-line space-y-3 text-sm">
              {lineItems.map((it) => (
                <div key={it.productId} className="flex justify-between gap-3">
                  <span className="text-ink">
                    {it.qty} × {it.name}
                  </span>
                  <span className="text-mute">
                    £{((it.qty * it.pricePence) / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-8">
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 bg-navy text-paper px-6 py-3 text-sm font-semibold tracking-wide uppercase hover:bg-navy-deep transition-colors"
          >
            Keep shopping
          </Link>
        </div>
      </Container>
    </>
  );
}
