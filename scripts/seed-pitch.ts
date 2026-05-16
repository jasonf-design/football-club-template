import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { count } from "drizzle-orm";
import { pitchSquares } from "../db/schema";

const COLS = 15;
const ROWS = 10;
const PRICE_PENCE = 5000; // £50

// Two zones: top half + bottom half. Edit in DB or via /admin/pitch later.
function zoneFor(row: number): string {
  return row <= ROWS / 2 ? "North End" : "South End";
}

const url = process.env.DB_URL ?? "file:./local.sqlite";
const client = createClient({ url });
const db = drizzle(client);

const [existing] = await db
  .select({ value: count() })
  .from(pitchSquares);

if (existing.value > 0) {
  console.log(
    `Pitch already seeded with ${existing.value} squares. Skipping. To re-seed, drop the table first.`,
  );
  client.close();
  process.exit(0);
}

const rows = [];
let id = 1;
for (let r = 1; r <= ROWS; r++) {
  for (let c = 1; c <= COLS; c++) {
    rows.push({
      id: id++,
      row: r,
      col: c,
      zone: zoneFor(r),
      pricePence: PRICE_PENCE,
      status: "available" as const,
    });
  }
}

await db.insert(pitchSquares).values(rows);
console.log(`Seeded ${rows.length} pitch squares at £${PRICE_PENCE / 100}.`);
client.close();
