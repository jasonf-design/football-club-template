import { createClient } from "@libsql/client";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = process.env.DB_URL ?? `file:${join(__dirname, "../local.sqlite")}`;
const db = createClient({ url });

function makeFixtureSlug(opponent, kickoff) {
  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const d = new Date(kickoff);
  const name = opponent.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${name}-${d.getUTCDate()}-${months[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

try {
  await db.execute("ALTER TABLE fixtures ADD COLUMN slug text");
  console.log("Added slug column.");
} catch { /* already exists */ }

const { rows } = await db.execute("SELECT id, opponent, kickoff FROM fixtures WHERE slug IS NULL");
console.log(`Backfilling slugs for ${rows.length} fixtures...`);

for (const row of rows) {
  const slug = makeFixtureSlug(row.opponent, row.kickoff);
  await db.execute({ sql: "UPDATE fixtures SET slug = ? WHERE id = ?", args: [slug, row.id] });
  console.log(`  ${row.id} → ${slug}`);
}

console.log("Done.");
