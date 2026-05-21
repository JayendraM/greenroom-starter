/**
 * Cache reconciler verdicts to data/reconciliations.json so the UI can load
 * them instantly instead of issuing live API calls on every page view.
 *
 * Run via: npx tsx scripts/generate-reconciliations.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
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

type CachedVerdict = {
  proposed_status: "signed" | "disputed" | "needs_human_review";
  confidence: number;
  reasoning: string;
  evidence_quotes: string[];
};

async function main() {
  const disputed = await getDisputedSettlements();
  console.log(`Found ${disputed.length} disputed settlement(s).\n`);

  const verdicts: Record<string, CachedVerdict> = {};
  const tally = { signed: 0, disputed: 0, needs_human_review: 0 };

  let i = 0;
  for (const s of disputed) {
    i++;
    const artist = s.artistName ?? "Unknown artist";
    const date = s.showDate ?? "unknown date";
    console.log(`[${i}/${disputed.length}] ${artist} · ${date} …`);

    const verdict = await reconcileSettlement(s);
    tally[verdict.proposed_status]++;

    verdicts[s.settlementId] = {
      proposed_status: verdict.proposed_status,
      confidence: verdict.confidence,
      reasoning: verdict.reasoning,
      evidence_quotes: verdict.evidence_quotes,
    };

    console.log(
      `  -> ${verdict.proposed_status} (${verdict.confidence.toFixed(2)})`,
    );
  }

  const outPath = resolve(process.cwd(), "data/reconciliations.json");
  const payload = {
    generatedAt: new Date().toISOString(),
    verdicts,
  };
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`\nWrote ${Object.keys(verdicts).length} verdict(s) to ${outPath}`);
  console.log("\n--- Summary ---");
  console.log(`signed:              ${tally.signed}`);
  console.log(`disputed:            ${tally.disputed}`);
  console.log(`needs_human_review:  ${tally.needs_human_review}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
