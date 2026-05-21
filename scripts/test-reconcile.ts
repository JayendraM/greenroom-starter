/**
 * Smoke test for the settlement reconciler.
 *
 * Loads .env.local, pulls every disputed settlement, runs reconcileSettlement()
 * on each one sequentially, and prints a one-line verdict per settlement plus
 * a tally at the end.
 *
 * Run via: npx tsx scripts/test-reconcile.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Minimal .env.local loader — tsx doesn't load env files automatically and the
// project has no dotenv dep. Lines like KEY=value (optional quotes) only.
function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // No .env.local — fall through; ANTHROPIC_API_KEY may be set externally.
  }
}

loadEnvLocal();

import { getDisputedSettlements } from "@/lib/queries";
import { reconcileSettlement } from "@/lib/reconcile";

async function main() {
  const disputed = await getDisputedSettlements();
  console.log(`Found ${disputed.length} disputed settlement(s).\n`);

  const tally = { signed: 0, disputed: 0, needs_human_review: 0 };

  for (const s of disputed) {
    const verdict = await reconcileSettlement(s);
    tally[verdict.proposed_status]++;

    const artist = s.artistName ?? "Unknown artist";
    const date = s.showDate ?? "unknown date";
    const conf = verdict.confidence.toFixed(2);

    console.log(
      `${artist} · ${date} · ${s.status} -> ${verdict.proposed_status} (${conf})`,
    );
    console.log(`  ${verdict.reasoning}`);
    if (verdict.evidence_quotes.length > 0) {
      for (const q of verdict.evidence_quotes) {
        console.log(`  · "${q}"`);
      }
    }
    console.log();
  }

  console.log("--- Summary ---");
  console.log(`signed:              ${tally.signed}`);
  console.log(`disputed:            ${tally.disputed}`);
  console.log(`needs_human_review:  ${tally.needs_human_review}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
