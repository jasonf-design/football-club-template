import { asc, eq, inArray } from "drizzle-orm";
import { redirect, useActionData } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/cart";
import { db } from "~/db.server";
import { media, products, shopOrders } from "../../db/schema";
import { Container } from "~/components/Container";
import { PageHeader } from "~/components/PageHeader";
import { CartView } from "~/components/CartView";
import {
  getStripe,
  isStripeConfigured,
  publicUrl,
  StripeNotConfiguredError,
} from "~/lib/stripe.server";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Cart · Doncaster City FC" }];
}

export async function loader() {
  const all = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      pricePence: products.pricePence,
      stock: products.stock,
      imageFilename: media.filename,
    })
    .from(products)
    .leftJoin(media, eq(media.id, products.imageMediaId))
    .where(eq(products.active, true))
    .orderBy(asc(products.sortOrder));
  return { products: all, stripeReady: isStripeConfigured() };
}

const cartSchema = z.object({
  email: z.string().email("Please use a valid email"),
  cart: z.string().min(2, "Your cart is empty"),
});

const itemSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().min(1).max(99),
});

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const parsed = cartSchema.safeParse({
    email: form.get("email"),
    cart: form.get("cart"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  let items: { productId: string; qty: number }[];
  try {
    const raw = JSON.parse(parsed.data.cart);
    if (!Array.isArray(raw)) throw new Error("not array");
    items = raw.map((it) => itemSchema.parse(it));
    if (items.length === 0) throw new Error("empty");
  } catch {
    return { error: "Your cart is empty or invalid. Add some items first." };
  }

  // Server-side product lookup is the source of truth for price/availability.
  const productIds = items.map((it) => it.productId);
  const rows = await db
    .select()
    .from(products)
    .where(inArray(products.id, productIds));
  const byId = new Map(rows.map((p) => [p.id, p]));

  for (const it of items) {
    const p = byId.get(it.productId);
    if (!p || !p.active) {
      return {
        error: "One of your items is no longer available. Refresh and try again.",
      };
    }
    if (p.stock != null && p.stock < it.qty) {
      return {
        error: `Only ${p.stock} of "${p.name}" left in stock.`,
      };
    }
  }

  const lineItems = items.map((it) => {
    const p = byId.get(it.productId)!;
    return {
      productId: p.id,
      slug: p.slug,
      name: p.name,
      qty: it.qty,
      pricePence: p.pricePence,
    };
  });
  const totalPence = lineItems.reduce(
    (acc, it) => acc + it.pricePence * it.qty,
    0,
  );

  const [order] = await db
    .insert(shopOrders)
    .values({
      email: parsed.data.email,
      totalPence,
      status: "pending",
      lineItemsJson: lineItems,
    })
    .returning();

  if (!isStripeConfigured()) {
    await db
      .update(shopOrders)
      .set({ status: "cancelled" })
      .where(eq(shopOrders.id, order.id));
    return {
      error:
        "Online payments aren't enabled yet. Email hello@doncastercityfc.com and we'll take your order manually.",
    };
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: parsed.data.email,
      line_items: lineItems.map((it) => ({
        quantity: it.qty,
        price_data: {
          currency: "gbp",
          unit_amount: it.pricePence,
          product_data: {
            name: it.name,
            metadata: { productId: it.productId },
          },
        },
      })),
      shipping_address_collection: {
        allowed_countries: ["GB"],
      },
      phone_number_collection: { enabled: true },
      metadata: {
        kind: "shop",
        orderId: order.id,
      },
      success_url: `${publicUrl()}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${publicUrl()}/cart`,
    });
    await db
      .update(shopOrders)
      .set({ stripeSessionId: session.id })
      .where(eq(shopOrders.id, order.id));
    if (!session.url) throw new Error("Stripe didn't return a URL");
    throw redirect(session.url);
  } catch (err) {
    if (err instanceof Response) throw err;
    if (err instanceof StripeNotConfiguredError) {
      return { error: err.message };
    }
    await db
      .update(shopOrders)
      .set({ status: "cancelled" })
      .where(eq(shopOrders.id, order.id));
    console.error("[shop checkout] failed:", err);
    return {
      error:
        "Couldn't reach Stripe just now. Nothing was charged — please try again.",
    };
  }
}

export default function Cart({ loaderData }: Route.ComponentProps) {
  const { products, stripeReady } = loaderData;
  const result = useActionData<typeof action>();
  return (
    <>
      <PageHeader eyebrow="Your bag" title="Almost there." />
      <Container size="wide" className="py-12">
        <CartView
          products={products}
          stripeReady={stripeReady}
          error={result?.error}
        />
      </Container>
    </>
  );
}
