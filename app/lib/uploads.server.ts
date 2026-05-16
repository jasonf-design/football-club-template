import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createId } from "@paralleldrive/cuid2";
import { db } from "~/db.server";
import { media } from "../../db/schema";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? "./uploads";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export class UploadError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

export async function saveImage(
  file: File,
  { alt, uploadedBy }: { alt?: string | null; uploadedBy?: string | null } = {},
) {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new UploadError("No file provided");
  }
  if (file.size > MAX_BYTES) {
    throw new UploadError(
      `Files must be ${Math.round(MAX_BYTES / 1024 / 1024)}MB or smaller`,
    );
  }
  const ext = EXT_BY_MIME[file.type];
  if (!ext) {
    throw new UploadError(
      "Only JPEG, PNG, WEBP, GIF and AVIF images are accepted",
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());

  let meta: sharp.Metadata;
  try {
    meta = await sharp(buf).metadata();
  } catch {
    throw new UploadError("That file isn't a valid image");
  }

  await ensureUploadsDir();
  const filename = `${createId()}${ext}`;
  const filepath = path.join(UPLOADS_DIR, filename);
  await fs.writeFile(filepath, buf);

  const [row] = await db
    .insert(media)
    .values({
      filename,
      mimeType: file.type,
      width: meta.width ?? null,
      height: meta.height ?? null,
      sizeBytes: buf.byteLength,
      alt: alt ?? null,
      uploadedBy: uploadedBy ?? null,
    })
    .returning();

  return {
    id: row.id,
    url: `/uploads/${row.filename}`,
    filename: row.filename,
    width: row.width,
    height: row.height,
  };
}

export function mimeFromExt(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

export function uploadsDir() {
  return UPLOADS_DIR;
}
