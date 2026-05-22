import { readFile } from "fs/promises";
import path from "path";
import { getDisputedSettlements } from "@/lib/queries";
import { formatShowDateFull } from "@/lib/format";
import { ReconcileView, type ReconcileItem } from "./reconcile-view";
import type { ReconcileVerdict } from "@/lib/reconcile";

type CacheFile = {
  generatedAt: string;
  verdicts: Record<string, ReconcileVerdict>;
};

async function readVerdicts(): Promise<CacheFile | null> {
  try {
    const p = path.join(process.cwd(), "data", "reconciliations.json");
    const raw = await readFile(p, "utf-8");
    return JSON.parse(raw) as CacheFile;
  } catch {
    return null;
  }
}

export default async function ReconcilePage() {
  const [disputed, cache] = await Promise.all([
    getDisputedSettlements(),
    readVerdicts(),
  ]);

  const verdicts = cache?.verdicts ?? {};

  const items: ReconcileItem[] = disputed.map((s) => {
    const base = {
      settlementId: s.settlementId,
      showId: s.showId,
      artistName: s.artistName ?? "Unknown artist",
      showDateFormatted: s.showDate ? formatShowDateFull(s.showDate) : "—",
      currentStatus: s.status,
    };
    const verdict = verdicts[s.settlementId];
    if (!verdict) {
      return { ...base, kind: "unanalyzed" as const };
    }
    return {
      ...base,
      kind: "analyzed" as const,
      proposedStatus: verdict.proposed_status,
      confidence: verdict.confidence,
      reasoning: verdict.reasoning,
      evidenceQuotes: verdict.evidence_quotes ?? [],
    };
  });

  return <ReconcileView items={items} generatedAt={cache?.generatedAt ?? null} />;
}
