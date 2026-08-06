import type { Route } from "./+types/admin-api-wikipedia";
import { requireAdmin } from "~/lib/session.server";

const UA = { "User-Agent": "DCFC-admin/1.0 (football club website admin tool)" };

async function fetchExtract(title: string): Promise<{ title: string; extract: string } | null> {
  const res = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext&redirects=1&titles=${encodeURIComponent(title)}&format=json`,
    { headers: UA },
  );
  const data = await res.json() as { query: { pages: Record<string, { title?: string; extract?: string; missing?: string }> } };
  const page = Object.values(data.query?.pages ?? {})[0];
  if (!page || "missing" in page || !page.extract?.trim()) return null;
  return { title: page.title!, extract: page.extract };
}

function isFootball(extract: string): boolean {
  return /football club|association football|football league|soccer club/i.test(extract);
}

function titleVariants(name: string): string[] {
  const variants: string[] = [name];
  // "LIV FC" → "LIV F.C.", "Goole AFC" → "Goole A.F.C."
  const dotted = name.replace(/\bAFC\b/g, "A.F.C.").replace(/\bFC\b/g, "F.C.");
  if (dotted !== name) variants.push(dotted);
  // Add suffix if name has no club abbreviation at all
  if (!/\b(FC|F\.C\.|AFC|A\.F\.C\.)\b/i.test(name)) {
    variants.push(`${name} F.C.`, `${name} A.F.C.`);
  }
  return variants;
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q) return Response.json({ error: "No query" }, { status: 400 });

  // 1. Try exact title variants — fastest, most accurate ("LIV FC" → "LIV F.C.")
  for (const title of titleVariants(q)) {
    const result = await fetchExtract(title);
    if (result && isFootball(result.extract)) {
      return respond(result);
    }
  }

  // 2. OpenSearch with "football club" to avoid ambiguous results like LIV Golf
  const fcSearch = await fetch(
    `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q + " football club")}&limit=5&format=json`,
    { headers: UA },
  );
  const [, fcTitles] = await fcSearch.json() as [string, string[], string[], string[]];
  for (const title of fcTitles) {
    const result = await fetchExtract(title);
    if (result && isFootball(result.extract)) return respond(result);
  }

  // 3. General OpenSearch, but only accept confirmed football pages
  const general = await fetch(
    `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=5&format=json`,
    { headers: UA },
  );
  const [, generalTitles] = await general.json() as [string, string[], string[], string[]];
  for (const title of generalTitles) {
    const result = await fetchExtract(title);
    if (result && isFootball(result.extract)) return respond(result);
  }

  return Response.json({ error: "Not found on Wikipedia" }, { status: 404 });
}

function respond({ title, extract }: { title: string; extract: string }) {
  // Strip section headers (== History ==) and empty lines, then accumulate until ~800 chars
  const lines = extract
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^={2,}/.test(l));

  const paragraphs: string[] = [];
  let chars = 0;
  for (const line of lines) {
    paragraphs.push(line);
    chars += line.length;
    if (chars >= 800) break;
  }

  return Response.json({ text: paragraphs.join("\n\n"), title });
}
