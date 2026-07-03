// Debug: print raw FWP status and scores for all fetched fixtures
// Usage: npx tsx scripts/fwp-debug.ts
import "dotenv/config";
import { fetchTeamFixtures } from "../app/lib/fwp.server";

const matches = await fetchTeamFixtures();
for (const m of matches) {
  console.log(
    m.date, m.time,
    `status="${m.status.short}"`,
    `scores: ${m["home-team"].score} - ${m["away-team"].score}`,
    `|`, m["home-team"].name, "vs", m["away-team"].name
  );
}
