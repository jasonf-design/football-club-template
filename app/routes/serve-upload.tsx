import path from "node:path";
import { promises as fs } from "node:fs";
import { data } from "react-router";
import type { Route } from "./+types/serve-upload";
import { mimeFromExt, uploadsDir } from "~/lib/uploads.server";

export async function loader({ params }: Route.LoaderArgs) {
  const safe = path.basename(params.filename);
  // Don't allow paths that try to escape the uploads dir.
  if (safe !== params.filename || safe.startsWith(".") || safe.includes("/")) {
    throw data("Not Found", { status: 404 });
  }
  const filepath = path.join(uploadsDir(), safe);
  let buf: Buffer;
  try {
    buf = await fs.readFile(filepath);
  } catch {
    throw data("Not Found", { status: 404 });
  }
  const ab = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength,
  ) as ArrayBuffer;
  return new Response(ab, {
    headers: {
      "Content-Type": mimeFromExt(safe),
      "Cache-Control": "public, max-age=2592000, immutable",
    },
  });
}
