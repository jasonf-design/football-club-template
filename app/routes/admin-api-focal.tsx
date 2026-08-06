import { data } from "react-router";
import type { Route } from "./+types/admin-api-focal";
import { db } from "~/db.server";
import { media } from "../../db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "~/lib/session.server";

export async function loader() {
  throw data("Method Not Allowed", { status: 405 });
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  if (request.method !== "POST") throw data("Method Not Allowed", { status: 405 });

  const { id, focalX, focalY } = await request.json() as { id: string; focalX: number; focalY: number };

  if (!id || typeof focalX !== "number" || typeof focalY !== "number") {
    throw data({ error: "Invalid payload" }, { status: 400 });
  }

  const x = Math.min(1, Math.max(0, focalX));
  const y = Math.min(1, Math.max(0, focalY));

  await db.update(media).set({ focalX: x, focalY: y }).where(eq(media.id, id));
  return { ok: true, focalX: x, focalY: y };
}
