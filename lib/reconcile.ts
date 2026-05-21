/**
 * AI settlement reconciler.
 *
 * Reads a disputed settlement's prose fields + lifecycle and asks Claude to
 * propose a verdict (signed / disputed / needs_human_review). The model is
 * instructed to cite specific words from the input so the verdict is
 * auditable — and to abstain (needs_human_review) when evidence is thin.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { DisputedSettlement } from "@/lib/queries";

export type ReconcileVerdict = {
  proposed_status: "signed" | "disputed" | "needs_human_review";
  confidence: number;
  reasoning: string;
  evidence_quotes: string[];
};

const FALLBACK: ReconcileVerdict = {
  proposed_status: "needs_human_review",
  confidence: 0,
  reasoning: "Could not parse AI response",
  evidence_quotes: [],
};

const SYSTEM_PROMPT = `You are auditing settlement records at an independent music venue.

CONTEXT YOU MUST KNOW: This venue has a documented data-quality problem. Settlements frequently get marked 'disputed' in the system even when the tour manager signed off positively at the table — the status gets flipped by a follow-up question, a workflow artifact, or a manual misclick, and never corrected. The 'disputed' status here is unreliable. Your job is to read the human-written prose and determine whether the 'disputed' label reflects what actually happened.

CRITICAL: The current status ('disputed') and the 'disputed_at' timestamp are the very things you are auditing. They appear on every record by definition. They are NOT evidence that a genuine dispute occurred. Likewise, the ABSENCE of a 'revised_at' or 'finalized_at' timestamp is NOT evidence a dispute is real and unresolved — false disputes are never formally resolved in the system; they just persist mislabeled. That is the entire problem you are detecting. Base your verdict ONLY on the prose: the sign-off text and the notes.

Return ONLY a raw JSON object (no markdown, no preamble) with this schema:
{
  "proposed_status": "signed" | "disputed" | "needs_human_review",
  "confidence": <number 0 to 1>,
  "reasoning": "<1-2 sentences citing specific words from the prose>",
  "evidence_quotes": ["<exact phrases from the sign-off or notes>"]
}

Rules:
- 'signed': The sign-off text is clearly positive ('Looks good', 'OK. Good night.', 'ok wire monday', 'Sign off.', a thumbs-up emoji) AND the notes do NOT describe an actual unresolved contested issue. This is the classic false dispute — propose 'signed' with confidence 0.85 or higher. A positive sign-off with null/empty notes is NOT ambiguous; it is the textbook false dispute.
- 'disputed': The sign-off hedges or objects, OR the notes describe a real contested issue (a disagreement over money, a recoup interpretation conflict, an unresolved objection from the artist or agent).
- 'needs_human_review': Genuinely mixed — a positive sign-off BUT the notes explicitly flag an unresolved question or follow-up that has not been closed (e.g., notes say an assistant emailed later questioning a line item and it hasn't been resolved).
- Casual, informal, or terse language ('OK', '👍', 'ok wire monday') is normal positive sign-off in this domain. Do NOT treat informality or brevity as ambiguity.`;

function stripFences(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return s.trim();
}

function tsToIso(t: Date | number | null | undefined): string | null {
  if (t == null) return null;
  if (t instanceof Date) return t.toISOString();
  // libsql timestamp mode returns Date already; guard for numeric just in case.
  return new Date(t).toISOString();
}

export async function reconcileSettlement(
  settlement: DisputedSettlement,
): Promise<ReconcileVerdict> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ...FALLBACK,
      reasoning: "ANTHROPIC_API_KEY is not set",
    };
  }

  const client = new Anthropic({ apiKey });

  const payload = {
    status: settlement.status,
    signoff_text: settlement.signoffText,
    notes: settlement.notes,
    lifecycle: {
      drafted_at: tsToIso(settlement.draftedAt),
      submitted_at: tsToIso(settlement.submittedAt),
      review_started_at: tsToIso(settlement.reviewStartedAt),
      signed_at: tsToIso(settlement.signedAt),
      disputed_at: tsToIso(settlement.disputedAt),
      revised_at: tsToIso(settlement.revisedAt),
      finalized_at: tsToIso(settlement.finalizedAt),
      paid_at: tsToIso(settlement.paidAt),
    },
    recoups: settlement.recoups,
  };

  const userMessage = `Settlement to evaluate:\n\n${JSON.stringify(payload, null, 2)}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return FALLBACK;

    const cleaned = stripFences(textBlock.text);
    let parsed: ReconcileVerdict;
    try {
      parsed = JSON.parse(cleaned) as ReconcileVerdict;
    } catch {
      const first = cleaned.indexOf("{");
      const last = cleaned.lastIndexOf("}");
      if (first === -1 || last === -1 || last <= first) return FALLBACK;
      parsed = JSON.parse(cleaned.slice(first, last + 1)) as ReconcileVerdict;
    }

    if (
      parsed.proposed_status !== "signed" &&
      parsed.proposed_status !== "disputed" &&
      parsed.proposed_status !== "needs_human_review"
    ) {
      return FALLBACK;
    }

    return parsed;
  } catch {
    return FALLBACK;
  }
}
