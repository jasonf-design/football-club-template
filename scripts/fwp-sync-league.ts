// Sync league table from FWP.
// Usage: npx tsx scripts/fwp-sync-league.ts
import "dotenv/config";
import { syncLeagueTable } from "../app/lib/fwp.server";

const result = await syncLeagueTable();
console.log(`League table synced: ${result.teams} teams`);
