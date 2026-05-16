import { and, eq, lt } from "drizzle-orm";
import { db } from "~/db.server";
import { pitchOrders, pitchSquares } from "../../db/schema";

/**
 * Release any pending squares whose hold has expired. Called lazily from the
 * /pitch loader and admin views so we don't need a background job. Returns
 * the number of squares released.
 */
export async function expireStaleHolds(): Promise<number> {
  const now = new Date();

  const stale = await db
    .select({ id: pitchSquares.id, orderId: pitchSquares.orderId })
    .from(pitchSquares)
    .where(
      and(eq(pitchSquares.status, "pending"), lt(pitchSquares.updatedAt, now)),
    );

  const reallyStale = stale.filter((s) => {
    // We rely on pitch_orders.holdExpiresAt for the actual TTL.
    return s.orderId;
  });

  if (reallyStale.length === 0) return 0;

  const orderIds = [...new Set(reallyStale.map((s) => s.orderId!))];
  let released = 0;
  for (const orderId of orderIds) {
    const [order] = await db
      .select()
      .from(pitchOrders)
      .where(eq(pitchOrders.id, orderId))
      .limit(1);
    if (!order) continue;
    if (order.status !== "pending") continue;
    if (!order.holdExpiresAt || order.holdExpiresAt > now) continue;
    await db
      .update(pitchSquares)
      .set({ status: "available", orderId: null, sponsorName: null })
      .where(
        and(eq(pitchSquares.orderId, orderId), eq(pitchSquares.status, "pending")),
      );
    await db
      .update(pitchOrders)
      .set({ status: "cancelled" })
      .where(eq(pitchOrders.id, orderId));
    released += 1;
  }
  return released;
}

export const HOLD_TTL_MS = 15 * 60 * 1000;
