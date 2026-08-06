import { data } from "react-router";
import { eq } from "drizzle-orm";
import { db } from "~/db.server";
import { players } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";

export async function loader() {
  throw data("Method Not Allowed", { status: 405 });
}

type Payload = {
  id: string;
  focalX?: number;
  focalY?: number;
  spotlightPhotoMediaId?: string | null;
};

export async function action({ request }: { request: Request }) {
  await requireAdmin(request);
  if (request.method !== "POST") throw data("Method Not Allowed", { status: 405 });

  const body = await request.json() as Payload;
  const { id } = body;
  if (!id) throw data({ error: "Missing id" }, { status: 400 });

  const update: Partial<{ spotlightFocalX: number; spotlightFocalY: number; spotlightPhotoMediaId: string | null }> = {};
  if (typeof body.focalX === "number") update.spotlightFocalX = Math.min(1, Math.max(0, body.focalX));
  if (typeof body.focalY === "number") update.spotlightFocalY = Math.min(1, Math.max(0, body.focalY));
  if ("spotlightPhotoMediaId" in body) update.spotlightPhotoMediaId = body.spotlightPhotoMediaId ?? null;

  if (Object.keys(update).length === 0) throw data({ error: "Nothing to update" }, { status: 400 });

  await db.update(players).set(update).where(eq(players.id, id));
  return { ok: true };
}
