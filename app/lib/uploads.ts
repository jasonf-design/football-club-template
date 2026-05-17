/**
 * Helpers safe to use from either server or client. Anything that touches the
 * filesystem, sharp, or the database lives in `uploads.server.ts`.
 */

export const VARIANT_WIDTHS = [400, 600, 800, 1200] as const;
export type VariantWidth = (typeof VARIANT_WIDTHS)[number];

export const VARIANT_FORMATS = ["avif", "webp", "jpeg", "png"] as const;
export type VariantFormat = (typeof VARIANT_FORMATS)[number];

export function isVariantWidth(n: number): n is VariantWidth {
  return (VARIANT_WIDTHS as readonly number[]).includes(n);
}

export function isVariantFormat(s: string): s is VariantFormat {
  return (VARIANT_FORMATS as readonly string[]).includes(s);
}

export function uploadUrlFor(
  filename: string | null | undefined,
): string | null {
  if (!filename) return null;
  return `/uploads/${filename}`;
}

export function variantUrl(
  filename: string,
  width: VariantWidth,
  format: VariantFormat,
): string {
  return `/uploads/${filename}?w=${width}&f=${format}`;
}

export function variantSrcset(
  filename: string | null | undefined,
  format: VariantFormat,
): string | null {
  if (!filename) return null;
  return VARIANT_WIDTHS.map(
    (w) => `${variantUrl(filename, w, format)} ${w}w`,
  ).join(", ");
}

/**
 * Picks the right raster fallback format from the upload's extension —
 * PNG for transparency-bearing logos, WEBP for webp uploads, JPEG otherwise.
 * Used as the `<img>` fallback alongside an AVIF `<source>`.
 */
export function fallbackFormatFor(filename: string): VariantFormat {
  const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "png") return "png";
  if (ext === "webp") return "webp";
  return "jpeg";
}
