import { promises as fs } from "node:fs";
import path from "node:path";
import { asc, eq } from "drizzle-orm";
import sharp from "sharp";
import { db } from "~/db.server";
import { media, sponsors } from "../../db/schema";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? "./uploads";

export type SponsorUri = { dataUri: string; name: string };

export async function getAllSponsorUris(): Promise<SponsorUri[]> {
  const rows = await db
    .select({
      name:     sponsors.name,
      filename: media.filename,
      mimeType: media.mimeType,
    })
    .from(sponsors)
    .innerJoin(media, eq(sponsors.logoMediaId, media.id))
    .where(eq(sponsors.active, true))
    .orderBy(asc(sponsors.sortOrder), asc(sponsors.id));

  const results: SponsorUri[] = [];
  for (const row of rows) {
    try {
      const raw = await fs.readFile(path.join(UPLOADS_DIR, row.filename));
      const png = await sharp(raw).png().toBuffer();
      results.push({
        dataUri: `data:image/png;base64,${png.toString("base64")}`,
        name: row.name,
      });
    } catch {
      // File missing — skip
    }
  }
  return results;
}
