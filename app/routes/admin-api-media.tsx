import { desc } from "drizzle-orm";
import { db } from "~/db.server";
import { media } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";

export async function loader({ request }: { request: Request }) {
  await requireAdmin(request);
  const all = await db
    .select({ id: media.id, filename: media.filename, originalName: media.originalName, width: media.width, height: media.height })
    .from(media)
    .orderBy(desc(media.createdAt));
  return all;
}
