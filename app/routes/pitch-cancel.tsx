import { eq, inArray } from "drizzle-orm";
import { Link, redirect } from "react-router";
import type { Route } from "./+types/pitch-cancel";
import { db } from "~/db.server";
import { pitchOrders, pitchSquares } from "../../db/schema";
import { Container } from "~/components/Container";
import { PageHeader } from "~/components/PageHeader";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Checkout cancelled · Doncaster City FC" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("order_id");
  if (orderId) {
    const [order] = await db
      .select()
      .from(pitchOrders)
      .where(eq(pitchOrders.id, orderId))
      .limit(1);
    if (order && order.status === "pending") {
      const held = await db
        .select({ id: pitchSquares.id })
        .from(pitchSquares)
        .where(eq(pitchSquares.orderId, orderId));
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
        .where(eq(pitchOrders.id, orderId));
    }
  }
  if (!orderId) throw redirect("/pitch");
  return null;
}

export default function PitchCancel() {
  return (
    <>
      <PageHeader
        eyebrow="Checkout cancelled"
        title="No worries — nothing was charged."
        lede="Your squares have been released back into the pool. Try again whenever you're ready."
      />
      <Container size="wide" className="py-16 text-center">
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
