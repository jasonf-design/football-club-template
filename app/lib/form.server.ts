/**
 * Helpers for parsing FormData. Keep these tiny — most validation lives in
 * route-level zod schemas.
 */

export function str(form: FormData, key: string): string | undefined {
  const v = form.get(key);
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function strOr(form: FormData, key: string, fallback: string): string {
  return str(form, key) ?? fallback;
}

export function bool(form: FormData, key: string): boolean {
  const v = form.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function intOrNull(form: FormData, key: string): number | null {
  const v = form.get(key);
  if (typeof v !== "string" || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function dateOrNull(form: FormData, key: string): Date | null {
  const v = form.get(key);
  if (typeof v !== "string" || v === "") return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
