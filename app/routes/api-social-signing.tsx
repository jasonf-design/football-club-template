import { desc, eq } from "drizzle-orm";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Route } from "./+types/api-social-signing";
import { db } from "~/db.server";
import { media, players } from "../../db/schema";
import { buildSigningSvg, renderToPng } from "~/lib/social-image.server";
import { getAllSponsorUris } from "~/lib/social-sponsor.server";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? "./uploads";

export async function loader({ request }: Route.LoaderArgs) {
  const url   = new URL(request.url);
  const id    = url.searchParams.get("id");
  const story = url.searchParams.get("format") === "story";
  const [w, h] = story ? [1080, 1920] : [1080, 1080];

  let player;
  if (id) {
    [player] = await db
      .select()
      .from(players)
      .where(eq(players.id, id))
      .limit(1);
  } else {
    [player] = await db
      .select()
      .from(players)
      .where(eq(players.active, true))
      .orderBy(desc(players.createdAt))
      .limit(1);
  }

  if (!player) {
    return new Response("No player found", { status: 404 });
  }

  // Attempt to load player photo as a data-URI
  let photoDataUri: string | null = null;
  if (player.photoMediaId) {
    const [mediaRow] = await db
      .select({ filename: media.filename, mimeType: media.mimeType })
      .from(media)
      .where(eq(media.id, player.photoMediaId))
      .limit(1);
    if (mediaRow) {
      try {
        const buf = await fs.readFile(path.join(UPLOADS_DIR, mediaRow.filename));
        photoDataUri = `data:${mediaRow.mimeType};base64,${buf.toString("base64")}`;
      } catch {
        // File missing from disk — render without photo
      }
    }
  }

  const sponsors = await getAllSponsorUris();

  const svg = buildSigningSvg(
    {
      name:         player.name,
      position:     player.position,
      photoDataUri,
    },
    w,
    h,
    sponsors,
  );

  const png = await renderToPng(svg);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
