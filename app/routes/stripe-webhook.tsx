import { eq, inArray } from "drizzle-orm";
import { data } from "react-router";
import type Stripe from "stripe";
import type { Route } from "./+types/stripe-webhook";
import { db } from "~/db.server";
import {
  pitchOrders,
  pitchSquares,
  products,
  shopOrders,
} from "../../db/schema";
import { getStripe } from "~/lib/stripe.server";
import { sendPitchOrderPaidNotification, sendShopOrderPaidNotification } from "~/lib/email.server";

export async function loader() {
  throw data("Method Not Allowed", { status: 405 });
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    throw data("Method Not Allowed", { status: 405 });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return data(
      { error: "STRIPE_WEBHOOK_SECRET is not set" },
      { status: 503 },
    );
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return data({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      secret,
    );
  } catch (err) {
    console.error("[stripe webhook] signature verification failed:", err);
    return data({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed":
        await handleCheckoutFailed(event.data.object as Stripe.Checkout.Session);
        break;
      default:
      // ignore other event types for now
    }
    return { received: true };
  } catch (err) {
    console.error("[stripe webhook] handler error:", err);
    // Return 500 so Stripe retries.
    return data({ error: "Handler failed" }, { status: 500 });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const kind = session.metadata?.kind;
  const orderId = session.metadata?.orderId;
  if (!kind || !orderId) return;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  if (kind === "pitch") {
    const [order] = await db
      .select()
      .from(pitchOrders)
      .where(eq(pitchOrders.id, orderId))
      .limit(1);
    if (!order) return;
    if (order.status === "paid") return; // idempotent

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
        stripePaymentIntentId: paymentIntentId,
      })
      .where(eq(pitchOrders.id, order.id));

    sendPitchOrderPaidNotification({
      name: order.contactName ?? order.displayName,
      email: order.email,
      displayName: order.displayName,
      squareCount: order.squareCount,
      totalPence: order.totalPence,
      orderId: order.id,
    }).catch((e) => console.error("[email] pitch paid notification failed:", e));
    return;
  }

  if (kind === "shop") {
    const [order] = await db
      .select()
      .from(shopOrders)
      .where(eq(shopOrders.id, orderId))
      .limit(1);
    if (!order) return;
    if (order.status === "paid") return; // idempotent

    type LineItem = {
      productId: string;
      qty: number;
      name: string;
      pricePence: number;
      slug: string;
    };
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
        // Stock decrement is best-effort — never fail the webhook over it.
        console.error("[stripe webhook] stock decrement failed", err);
      }
    }

    await db
      .update(shopOrders)
      .set({
        status: "paid",
        paidAt: new Date(),
        stripePaymentIntentId: paymentIntentId,
        shippingJson: (session.customer_details as unknown) ?? null,
      })
      .where(eq(shopOrders.id, order.id));

    sendShopOrderPaidNotification({
      email: order.email,
      totalPence: order.totalPence,
      orderId: order.id,
      lineItems,
    }).catch((e) => console.error("[email] shop paid notification failed:", e));
  }
}

async function handleCheckoutFailed(session: Stripe.Checkout.Session) {
  const kind = session.metadata?.kind;
  const orderId = session.metadata?.orderId;
  if (!kind || !orderId) return;
  if (kind === "pitch") {
    const [order] = await db
      .select()
      .from(pitchOrders)
      .where(eq(pitchOrders.id, orderId))
      .limit(1);
    if (!order || order.status !== "pending") return;
    const held = await db
      .select({ id: pitchSquares.id })
      .from(pitchSquares)
      .where(eq(pitchSquares.orderId, order.id));
    if (held.length > 0) {
      await db
        .update(pitchSquares)
        .set({ status: "available", orderId: null })
        .where(
          inArray(
            pitchSquares.id,
            held.map((s) => s.id),
          ),
        );
    }
    await db
      .update(pitchOrders)
      .set({ status: "cancelled" })
      .where(eq(pitchOrders.id, order.id));
  }
}
