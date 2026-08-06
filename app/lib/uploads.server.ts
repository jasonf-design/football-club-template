import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createId } from "@paralleldrive/cuid2";
import { db } from "~/db.server";
import { media } from "../../db/schema";
import {
  VARIANT_WIDTHS,
  type VariantFormat,
  type VariantWidth,
} from "./uploads";

export {
  VARIANT_WIDTHS,
  VARIANT_FORMATS,
  isVariantWidth,
  isVariantFormat,
  type VariantFormat,
  type VariantWidth,
} from "./uploads";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? "./uploads";
const CACHE_DIR = path.join(UPLOADS_DIR, ".cache");

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
const MAX_ORIGINAL_DIMENSION = 1600;

const MIME_BY_FORMAT: Record<VariantFormat, string> = {
  avif: "image/avif",
  webp: "image/webp",
  jpeg: "image/jpeg",
  png: "image/png",
};

export function mimeForFormat(format: VariantFormat): string {
  return MIME_BY_FORMAT[format];
}

export class UploadError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

async function ensureDirs() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

function basenameNoExt(filename: string): string {
  return path.basename(filename, path.extname(filename));
}

export function cachePath(
  filename: string,
  width: VariantWidth,
  format: VariantFormat,
): string {
  return path.join(CACHE_DIR, `${basenameNoExt(filename)}-w${width}.${format}`);
}

function encode(pipeline: sharp.Sharp, format: VariantFormat): sharp.Sharp {
  switch (format) {
    case "avif":
      return pipeline.avif({ quality: 65 });
    case "webp":
      return pipeline.webp({ quality: 80 });
    case "jpeg":
      // Flatten transparency to white before JPEG encoding (JPEG has no alpha channel).
      return pipeline.flatten({ background: { r: 255, g: 255, b: 255 } }).jpeg({ quality: 80, mozjpeg: true });
    case "png":
      return pipeline.png({ compressionLevel: 9 });
  }
}

export async function generateVariant(
  filename: string,
  width: VariantWidth,
  format: VariantFormat,
): Promise<string> {
  await ensureDirs();
  const out = cachePath(filename, width, format);
  const src = path.join(UPLOADS_DIR, filename);
  await encode(
    sharp(src).rotate().resize({ width, withoutEnlargement: true }),
    format,
  ).toFile(out);
  return out;
}

function formatFromMime(mime: string): VariantFormat | "gif" | null {
  switch (mime) {
    case "image/jpeg":
      return "jpeg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/avif":
      return "avif";
    case "image/gif":
      return "gif";
    default:
      return null;
  }
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
  const format = formatFromMime(file.type);
  if (!ext || !format) {
    throw new UploadError(
      "Only JPEG, PNG, WEBP, GIF and AVIF images are accepted",
    );
  }

  const inputBuf = Buffer.from(await file.arrayBuffer());

  let meta: sharp.Metadata;
  try {
    meta = await sharp(inputBuf).metadata();
  } catch {
    throw new UploadError("That file isn't a valid image");
  }

  // Cap dimensions and re-encode (skip GIFs to preserve animation).
  let outputBuf: Buffer;
  let outWidth: number | null;
  let outHeight: number | null;
  if (format === "gif") {
    outputBuf = inputBuf;
    outWidth = meta.width ?? null;
    outHeight = meta.height ?? null;
  } else {
    const { data, info } = await encode(
      sharp(inputBuf)
        .rotate()
        .resize({
          width: MAX_ORIGINAL_DIMENSION,
          height: MAX_ORIGINAL_DIMENSION,
          fit: "inside",
          withoutEnlargement: true,
        }),
      format,
    ).toBuffer({ resolveWithObject: true });
    outputBuf = data;
    outWidth = info.width;
    outHeight = info.height;
  }

  await ensureDirs();
  const filename = `${createId()}${ext}`;
  const filepath = path.join(UPLOADS_DIR, filename);
  await fs.writeFile(filepath, outputBuf);

  // Pre-warm AVIF variants. AVIF doesn't preserve GIF animation.
  if (format !== "gif") {
    await Promise.all(
      VARIANT_WIDTHS.map((w) => generateVariant(filename, w, "avif")),
    );
  }

  const [row] = await db
    .insert(media)
    .values({
      filename,
      originalName: file.name || null,
      mimeType: file.type,
      width: outWidth,
      height: outHeight,
      sizeBytes: outputBuf.byteLength,
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
