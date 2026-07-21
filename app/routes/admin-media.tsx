import { desc, eq } from "drizzle-orm";
import { Form, useRevalidator } from "react-router";
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
import { useRef, useState } from "react";
import { FocalPointPicker } from "~/components/admin/FocalPointPicker";

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
  const [focalTarget, setFocalTarget] = useState<{ id: string; src: string; focalX: number; focalY: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { revalidate } = useRevalidator();

  async function handleFiles(files: FileList) {
    setUploading(true);
    setUploadError(null);
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/admin/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        errors.push((body as { error?: string }).error ?? `${file.name} failed`);
      }
    }
    setUploading(false);
    if (errors.length) setUploadError(errors.join(" · "));
    revalidate();
  }

  return (
    <>
    {focalTarget && (
      <FocalPointPicker
        mediaId={focalTarget.id}
        src={focalTarget.src}
        initialX={focalTarget.focalX}
        initialY={focalTarget.focalY}
        onClose={() => setFocalTarget(null)}
      />
    )}
    <AdminPage
      eyebrow="Library"
      title="Media"
      description={`${media.length} image${media.length === 1 ? "" : "s"}`}
    >
      {/* Upload area */}
      <div
        className="mb-8 border-2 border-dashed border-line bg-paper-warm p-8 text-center transition-colors hover:border-navy/40"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const files = e.dataTransfer.files;
          if (files.length) handleFiles(files);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
        />
        <p className="text-sm text-mute mb-3">
          Drag images here, or
        </p>
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="inline-block px-5 py-2 bg-navy text-white text-xs uppercase tracking-widest font-semibold hover:bg-navy/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? "Uploading…" : "Choose files"}
        </button>
        {uploadError && (
          <p className="mt-3 text-sm text-red">{uploadError}</p>
        )}
      </div>

      {actionData && "error" in actionData && actionData.error && (
        <div className="mb-6 border-l-4 border-red bg-red/5 text-red text-sm px-4 py-3">
          {actionData.error}
        </div>
      )}
      {media.length === 0 ? (
        <div className="bg-paper border border-line p-12 text-center text-mute">
          No images yet — upload some above.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {media.map((m) => {
            const url = uploadUrlFor(m.filename)!;
            const fx = m.focalX ?? 0.5;
            const fy = m.focalY ?? 0.5;
            return (
              <div key={m.id} className="bg-paper border border-line overflow-hidden">
                <button
                  type="button"
                  className="aspect-square bg-paper-warm relative w-full block group cursor-crosshair"
                  title="Click to set focal point"
                  onClick={() => setFocalTarget({ id: m.id, src: url, focalX: fx, focalY: fy })}
                >
                  <img
                    src={url}
                    alt={m.alt ?? ""}
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ objectPosition: `${fx * 100}% ${fy * 100}%` }}
                  />
                  {/* Focal point dot */}
                  <div
                    className="absolute w-3 h-3 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)] pointer-events-none"
                    style={{ left: `${fx * 100}%`, top: `${fy * 100}%`, transform: "translate(-50%,-50%)" }}
                  />
                  {/* Hover hint */}
                  <div className="absolute inset-0 bg-navy/0 group-hover:bg-navy/20 transition-colors flex items-end justify-center pb-2 pointer-events-none">
                    <span className="text-[9px] uppercase tracking-widest text-white opacity-0 group-hover:opacity-100 transition-opacity font-semibold drop-shadow">
                      Set focal point
                    </span>
                  </div>
                </button>
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
    </>
  );
}
