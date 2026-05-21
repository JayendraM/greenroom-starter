"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, ScanSearch, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PlainBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ProposedStatus = "signed" | "disputed" | "needs_human_review";

export type ReconcileItem = {
  settlementId: string;
  showId: string;
  artistName: string;
  showDateFormatted: string;
  currentStatus: string;
  proposedStatus: ProposedStatus;
  confidence: number;
  reasoning: string;
  evidenceQuotes: string[];
};

const proposedVariant: Record<
  ProposedStatus,
  { variant: "brand" | "rose" | "amber"; label: string; accent: "brand" | "rose" | "amber" }
> = {
  signed: { variant: "brand", label: "Signed", accent: "brand" },
  disputed: { variant: "rose", label: "Disputed", accent: "rose" },
  needs_human_review: { variant: "amber", label: "Needs review", accent: "amber" },
};

export function ReconcileView({
  items,
  generatedAt,
}: {
  items: ReconcileItem[];
  generatedAt: string | null;
}) {
  // Persistence + audit trail (who confirmed, when, prior values) is the next ship.
  // For now, "Confirm" is client-state only and resets on reload.
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());

  const confirm = (id: string) =>
    setReviewed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

  const { attention, falseDisputes } = useMemo(() => {
    const attention = items.filter(
      (i) => i.proposedStatus === "disputed" || i.proposedStatus === "needs_human_review",
    );
    const falseDisputes = items.filter((i) => i.proposedStatus === "signed");
    return { attention, falseDisputes };
  }, [items]);

  const counts = useMemo(() => {
    let likelyFalse = 0;
    let needsReview = 0;
    let confirmedReal = 0;
    for (const i of items) {
      if (i.proposedStatus === "signed") likelyFalse++;
      else if (i.proposedStatus === "needs_human_review") needsReview++;
      else if (i.proposedStatus === "disputed") confirmedReal++;
    }
    return { likelyFalse, needsReview, confirmedReal };
  }, [items]);

  const total = items.length;
  const falsePct = total > 0 ? Math.round((counts.likelyFalse / total) * 100) : 0;
  const reviewedCount = reviewed.size;
  const reviewedPct = total > 0 ? (reviewedCount / total) * 100 : 0;
  const queueCleared = total > 0 && reviewedCount === total;

  const confirmAllFalse = () => {
    setReviewed((prev) => {
      const next = new Set(prev);
      for (const i of falseDisputes) next.add(i.settlementId);
      return next;
    });
  };

  const allFalseReviewed =
    falseDisputes.length > 0 &&
    falseDisputes.every((i) => reviewed.has(i.settlementId));

  return (
    <div className="px-12 py-10 max-w-7xl">
      {/* Header */}
      <div className="mb-10">
        <div className="eyebrow mb-3">Reconciliation</div>
        <h1
          className="font-display text-[48px] font-medium text-ink-900 leading-[1.05]"
          style={{ letterSpacing: "-0.02em", fontOpticalSizing: "auto" }}
        >
          Disputed queue
        </h1>
        <p className="text-[14px] text-ink-500 mt-3 max-w-2xl leading-relaxed">
          {total} settlements are flagged disputed. AI analysis:{" "}
          <span className="text-brand-700 font-medium">{counts.likelyFalse} likely false</span>,{" "}
          <span className="text-amber-700 font-medium">{counts.needsReview} need review</span>,{" "}
          <span className="text-rose-700 font-medium">{counts.confirmedReal} confirmed real</span>.
        </p>
      </div>

      {/* Headline callout */}
      {total > 0 && (
        <div className="relative overflow-hidden rounded-xl border border-brand-200/60 bg-gradient-to-br from-brand-50/60 to-canvas p-8 mb-12">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-brand-500 to-brand-700" />
          <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-brand-100/30 rounded-full blur-2xl" />
          <div className="relative flex items-start gap-5">
            <div className="w-10 h-10 rounded-lg bg-white ring-1 ring-brand-200/60 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-brand-700" />
            </div>
            <div>
              <div className="eyebrow text-[10px] text-brand-800 mb-3">
                AI verdict
              </div>
              <div
                className="font-display text-[36px] font-medium text-ink-900 leading-[1.1]"
                style={{ letterSpacing: "-0.02em" }}
              >
                <span className="font-mono tabular font-semibold text-brand-700">
                  {counts.likelyFalse}
                </span>{" "}
                of{" "}
                <span className="font-mono tabular font-semibold">{total}</span>{" "}
                disputes{" "}
                <span className="text-ink-500">
                  ({falsePct}%)
                </span>{" "}
                appear to be mislabeled.
              </div>
              <p className="text-[12.5px] text-ink-500 mt-3 max-w-xl leading-relaxed">
                Sign-offs like &ldquo;OK. Good night.&rdquo; or 👍 with no contested
                notes — the status flipped, but the prose says the tour manager
                approved. Confirm and clear them in bulk below.
                {generatedAt && (
                  <>
                    {" "}
                    <span className="text-ink-400">
                      · Verdicts generated{" "}
                      {new Date(generatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </>
                )}
              </p>

              {/* Live reviewed progress — increments on individual + bulk confirm */}
              <div className="mt-5 pt-4 border-t border-brand-200/40 max-w-xl">
                {queueCleared ? (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-brand-700 text-white text-[11px] font-medium">
                    <Check className="h-3.5 w-3.5" />
                    Queue cleared
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="eyebrow text-[10px] text-ink-500">
                        Reviewed
                      </span>
                      <span className="text-[11px] font-mono tabular text-ink-600">
                        <span className="font-semibold text-ink-900">
                          {reviewedCount}
                        </span>{" "}
                        of {total}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
                      <div
                        className="h-full bg-brand-700 transition-all duration-300"
                        style={{ width: `${reviewedPct}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attention group: disputed + needs_human_review first */}
      {attention.length > 0 && (
        <section className="mb-12">
          <div className="flex items-baseline justify-between mb-5">
            <h2
              className="font-display text-[24px] font-medium text-ink-900"
              style={{ letterSpacing: "-0.02em" }}
            >
              Needs your attention
            </h2>
            <span className="text-[11px] font-mono tabular text-ink-400">
              {attention.length} {attention.length === 1 ? "item" : "items"}
            </span>
          </div>
          <div className="space-y-3">
            {attention.map((item) => (
              <ReconcileCard
                key={item.settlementId}
                item={item}
                reviewed={reviewed.has(item.settlementId)}
                onConfirm={() => confirm(item.settlementId)}
              />
            ))}
          </div>
        </section>
      )}

      {/* False disputes group: signed */}
      {falseDisputes.length > 0 && (
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-5">
            <div>
              <h2
                className="font-display text-[24px] font-medium text-ink-900"
                style={{ letterSpacing: "-0.02em" }}
              >
                Likely false disputes
              </h2>
              <p className="text-[12.5px] text-ink-500 mt-1 max-w-lg leading-relaxed">
                Positive sign-offs with no contested notes — the dispute label
                doesn&apos;t match what the prose says happened.
              </p>
            </div>
            <Button
              variant="brand"
              size="sm"
              onClick={confirmAllFalse}
              disabled={allFalseReviewed}
            >
              {allFalseReviewed ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  All confirmed
                </>
              ) : (
                <>
                  <ScanSearch className="h-3.5 w-3.5" />
                  Confirm all false disputes
                </>
              )}
            </Button>
          </div>
          <div className="space-y-3">
            {falseDisputes.map((item) => (
              <ReconcileCard
                key={item.settlementId}
                item={item}
                reviewed={reviewed.has(item.settlementId)}
                onConfirm={() => confirm(item.settlementId)}
              />
            ))}
          </div>
        </section>
      )}

      {total === 0 && (
        <div className="py-20 text-center">
          <ScanSearch className="h-8 w-8 text-ink-200 mx-auto mb-3" />
          <div className="text-[14px] text-ink-500">
            No disputed settlements in the queue.
          </div>
        </div>
      )}

      <div className="text-[11.5px] text-ink-400 leading-relaxed mt-12 pt-6 border-t border-ink-200/60 max-w-2xl">
        Confirmations here are session-only. Persistence and an audit trail —
        who cleared what, when, and the prior status — ship next.
      </div>
    </div>
  );
}

function ReconcileCard({
  item,
  reviewed,
  onConfirm,
}: {
  item: ReconcileItem;
  reviewed: boolean;
  onConfirm: () => void;
}) {
  const proposed = proposedVariant[item.proposedStatus];
  const confidencePct = Math.round(item.confidence * 100);

  return (
    <Card
      accent={proposed.accent}
      className={cn(
        "transition-all duration-200",
        reviewed && "opacity-50",
      )}
    >
      <CardContent className="px-5 py-4">
        <div className="grid grid-cols-[1fr_auto] gap-5 items-start">
          <div className="min-w-0">
            {/* Top line: artist + date */}
            <div className="flex items-baseline gap-2.5 mb-3">
              <h3 className="text-[15px] font-semibold text-ink-900 truncate">
                {item.artistName}
              </h3>
              <span className="text-[12px] text-ink-400 tabular">
                {item.showDateFormatted}
              </span>
            </div>

            {/* Status transition */}
            <div className="flex items-center gap-2 mb-3">
              <PlainBadge variant="rose">Disputed</PlainBadge>
              <ArrowRight className="h-3 w-3 text-ink-300" />
              <PlainBadge variant={proposed.variant}>{proposed.label}</PlainBadge>
              <span className="ml-2 text-[11px] font-mono tabular text-ink-500">
                {confidencePct}% confidence
              </span>
            </div>

            {/* Reasoning */}
            <p className="text-[13px] text-ink-700 leading-relaxed mb-3">
              {item.reasoning}
            </p>

            {/* Evidence quotes */}
            {item.evidenceQuotes.length > 0 && (
              <ul className="space-y-1 pl-3 border-l-2 border-ink-200/60">
                {item.evidenceQuotes.map((quote, i) => (
                  <li
                    key={i}
                    className="text-[12px] italic text-ink-500 leading-relaxed"
                  >
                    &ldquo;{quote}&rdquo;
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Confirm action */}
          <div className="shrink-0">
            {reviewed ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200/60 text-[12px] font-medium">
                <Check className="h-3.5 w-3.5" />
                Reviewed
              </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={onConfirm}>
                <Check className="h-3.5 w-3.5" />
                Confirm
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
