/**
 * Helpers safe to use from either server or client. Anything that touches the
 * filesystem, sharp, or the database lives in `uploads.server.ts`.
 */
export function uploadUrlFor(
  filename: string | null | undefined,
): string | null {
  if (!filename) return null;
  return `/uploads/${filename}`;
}
