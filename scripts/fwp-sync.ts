// Run FWP fixture sync and report results.
// Usage: npx tsx scripts/fwp-sync.ts
import "dotenv/config";
import { syncDcfcFixtures } from "../app/lib/fwp.server";

const result = await syncDcfcFixtures();
console.log("FWP sync complete:");
console.log(`  Fetched:   ${result.fetched}`);
console.log(`  Created:   ${result.created}`);
console.log(`  Updated:   ${result.updated}`);
console.log(`  Unchanged: ${result.unchanged}`);
if (result.skipped.length > 0) {
  console.log(`  Skipped:   ${result.skipped.length}`);
  for (const s of result.skipped) {
    console.log(`    - ${s.externalId}: ${s.reason}`);
  }
}
