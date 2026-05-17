import path from "node:path";
import { promises as fs } from "node:fs";
import { data } from "react-router";
import type { Route } from "./+types/serve-upload";
import {
  cachePath,
  generateVariant,
  isVariantFormat,
  isVariantWidth,
  mimeForFormat,
  mimeFromExt,
  uploadsDir,
} from "~/lib/uploads.server";

const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=2592000, immutable",
};

export async function loader({ params, request }: Route.LoaderArgs) {
  const safe = path.basename(params.filename);
  // Don't allow paths that try to escape the uploads dir.
  if (safe !== params.filename || safe.startsWith(".") || safe.includes("/")) {
    throw data("Not Found", { status: 404 });
  }

  const url = new URL(request.url);
  const wParam = url.searchParams.get("w");
  const fParam = url.searchParams.get("f");

  // No params → serve original.
  if (!wParam && !fParam) {
    const filepath = path.join(uploadsDir(), safe);
    let buf: Buffer;
    try {
      buf = await fs.readFile(filepath);
    } catch {
      throw data("Not Found", { status: 404 });
    }
    return bufferResponse(buf, mimeFromExt(safe));
  }

  // Variant request: validate against allowlists.
  const width = wParam ? Number(wParam) : null;
  if (width !== null && !isVariantWidth(width)) {
    throw data("Bad Request", { status: 400 });
  }
  const format = fParam ?? null;
  if (format !== null && !isVariantFormat(format)) {
    throw data("Bad Request", { status: 400 });
  }
  if (width === null || format === null) {
    // We only cache (width × format) pairs. Requiring both keeps the cache
    // keyspace finite and the rendering predictable.
    throw data("Bad Request", { status: 400 });
  }

  const cached = cachePath(safe, width, format);
  let buf: Buffer;
  try {
    buf = await fs.readFile(cached);
  } catch {
    try {
      await fs.access(path.join(uploadsDir(), safe));
    } catch {
      throw data("Not Found", { status: 404 });
    }
    try {
      await generateVariant(safe, width, format);
      buf = await fs.readFile(cached);
    } catch {
      throw data("Could not generate variant", { status: 500 });
    }
  }
  return bufferResponse(buf, mimeForFormat(format));
}

function bufferResponse(buf: Buffer, contentType: string): Response {
  const ab = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength,
  ) as ArrayBuffer;
  return new Response(ab, {
    headers: { ...CACHE_HEADERS, "Content-Type": contentType },
  });
}
