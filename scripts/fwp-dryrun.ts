// Dry-run: exercises the FWP API client + mapping with no DB writes.
// Run with: npx tsx scripts/fwp-dryrun.ts
import "dotenv/config";
import { fetchTeamFixtures } from "../app/lib/fwp.server";

const matches = await fetchTeamFixtures();
console.log(`Fetched ${matches.length} matches`);
const teamId = Number(process.env.FWP_TEAM_ID);

let dcfcHome = 0, dcfcAway = 0, other = 0;
const statuses = new Map<string, number>();
for (const m of matches) {
  if (m["home-team"].id === teamId) dcfcHome++;
  else if (m["away-team"].id === teamId) dcfcAway++;
  else other++;
  statuses.set(m.status.short, (statuses.get(m.status.short) ?? 0) + 1);
}
console.log({ dcfcHome, dcfcAway, other, statusBreakdown: Object.fromEntries(statuses) });

console.log("\nFirst match (raw → mapped opponent):");
const sample = matches[0];
if (sample) {
  const isHome = sample["home-team"].id === teamId;
  console.log({
    externalId: sample.id,
    date: sample.date,
    time: sample.time,
    competition: sample.competition.name,
    isHome,
    opponent: isHome ? sample["away-team"].name : sample["home-team"].name,
    venue: sample.venue,
    status: sample.status,
    score: `${sample["home-team"].score}-${sample["away-team"].score}`,
  });
}
