import { promises as fs } from "node:fs";
import path from "node:path";
import { desc, eq } from "drizzle-orm";
import sharp from "sharp";
import type { Route } from "./+types/api-social-news";
import { db } from "~/db.server";
import { media, posts } from "../../db/schema";
import { buildNewsSvg, renderToPng } from "~/lib/social-image.server";
import { getAllSponsorUris } from "~/lib/social-sponsor.server";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? "./uploads";

export async function loader({ request }: Route.LoaderArgs) {
  const url    = new URL(request.url);
  const id     = url.searchParams.get("id");
  const slug   = url.searchParams.get("slug");
  const story  = url.searchParams.get("format") === "story";
  const [w, h] = story ? [1080, 1920] : [1080, 1080];

  let post;
  if (id) {
    [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  } else if (slug) {
    [post] = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
  } else {
    [post] = await db
      .select()
      .from(posts)
      .where(eq(posts.status, "published"))
      .orderBy(desc(posts.publishedAt))
      .limit(1);
  }

  if (!post) {
    return new Response("No post found", { status: 404 });
  }

  let heroDataUri: string | null = null;
  if (post.heroMediaId) {
    const [mediaRow] = await db
      .select({ filename: media.filename, mimeType: media.mimeType })
      .from(media)
      .where(eq(media.id, post.heroMediaId))
      .limit(1);
    if (mediaRow) {
      try {
        const raw = await fs.readFile(path.join(UPLOADS_DIR, mediaRow.filename));
        const png = await sharp(raw).png().toBuffer();
        heroDataUri = `data:image/png;base64,${png.toString("base64")}`;
      } catch {
        // Missing from disk — render without hero
      }
    }
  }

  const sponsors = await getAllSponsorUris();

  const svg = buildNewsSvg(
    {
      title:       post.title,
      publishedAt: post.publishedAt,
      heroDataUri,
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
