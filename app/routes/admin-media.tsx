import { desc, eq } from "drizzle-orm";
import { Form } from "react-router";
import type { Route } from "./+types/admin-media";
import { db } from "~/db.server";
import { media, posts, players, sponsors } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  AdminPage,
  DangerButton,
} from "~/components/admin/AdminShell";
import { uploadsDir } from "~/lib/uploads.server";
import { uploadUrlFor } from "~/lib/uploads";
import { useState } from "react";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Media · Admin" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const all = await db
    .select()
    .from(media)
    .orderBy(desc(media.createdAt));
  return { media: all };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  if (form.get("intent") !== "delete") return { ok: false };
  const id = form.get("id");
  if (typeof id !== "string") return { ok: false };

  // Refuse to delete if the media is still referenced — gives the admin a
  // clear error rather than orphaning the post/player/sponsor's image.
  const [usedByPost] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.heroMediaId, id))
    .limit(1);
  const [usedByPlayer] = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.photoMediaId, id))
    .limit(1);
  const [usedBySponsor] = await db
    .select({ id: sponsors.id })
    .from(sponsors)
    .where(eq(sponsors.logoMediaId, id))
    .limit(1);
  if (usedByPost || usedByPlayer || usedBySponsor) {
    return {
      ok: false,
      error: "This image is in use. Remove it from posts/players/sponsors first.",
    };
  }

  const [row] = await db
    .select({ filename: media.filename })
    .from(media)
    .where(eq(media.id, id))
    .limit(1);
  await db.delete(media).where(eq(media.id, id));
  if (row?.filename) {
    try {
      await fs.unlink(path.join(uploadsDir(), row.filename));
    } catch {
      // Already gone is fine.
    }
  }
  return { ok: true };
}

export default function AdminMedia({ loaderData, actionData }: Route.ComponentProps) {
  const { media } = loaderData;
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <AdminPage
      eyebrow="Library"
      title="Media"
      description={
        media.length === 0
          ? "Uploads appear here. Drag-and-drop will land in a future phase — for now upload from inside a post, player or sponsor."
          : `${media.length} image${media.length === 1 ? "" : "s"}`
      }
    >
      {actionData && "error" in actionData && actionData.error && (
        <div className="mb-6 border-l-4 border-red bg-red/5 text-red text-sm px-4 py-3">
          {actionData.error}
        </div>
      )}
      {media.length === 0 ? (
        <div className="bg-paper border border-line p-12 text-center text-mute">
          The media library is empty.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {media.map((m) => {
            const url = uploadUrlFor(m.filename)!;
            return (
              <div key={m.id} className="bg-paper border border-line overflow-hidden">
                <div className="aspect-square bg-paper-warm relative">
                  <img
                    src={url}
                    alt={m.alt ?? ""}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
                <div className="p-3 text-xs">
                  <div className="font-mono truncate text-ink" title={m.filename}>
                    {m.filename}
                  </div>
                  <div className="text-mute mt-1">
                    {m.width}×{m.height} · {Math.round(m.sizeBytes / 1024)} KB
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(url);
                        setCopied(m.id);
                        setTimeout(() => setCopied(null), 1500);
                      }}
                      className="text-[10px] uppercase tracking-[0.18em] text-navy hover:text-sky-bright font-medium"
                    >
                      {copied === m.id ? "Copied" : "Copy URL"}
                    </button>
                    <Form method="post" className="ml-auto">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={m.id} />
                      <button
                        type="submit"
                        onClick={(e) => {
                          if (!confirm("Delete this image?")) e.preventDefault();
                        }}
                        className="text-[10px] uppercase tracking-[0.18em] text-red hover:text-red/70 font-medium"
                      >
                        Delete
                      </button>
                    </Form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminPage>
  );
}
