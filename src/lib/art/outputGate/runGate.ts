import type { GateContext, ImageCandidate, ImageCheck, CheckResult } from "./types";

// The gate runner: generate → run every check → accept clean candidates, reroll
// failures, until we have `variantsWanted` clean variants or hit `maxAttempts`
// (the per-request reroll/cost cap). The parent is shown only the clean variants.

export interface GateOptions {
  /** How many clean variants to collect (D-021: choose from 3). */
  variantsWanted: number;
  /** Hard cap on total generations — the cost/latency budget. */
  maxAttempts: number;
  /** Progress events (W-3) — drives live status in the studio. */
  onEvent?: (e: GateProgress) => void;
}

export interface GateProgress {
  phase: "generating" | "checking" | "accepted" | "rejected";
  /** 1-based generation attempt. */
  attempt: number;
  /** Clean variants collected so far (after this event, for accepted). */
  cleanSoFar: number;
  wanted: number;
  /** First failure reason, for "rejected". */
  reason?: string;
}

export interface RejectedCandidate {
  candidate: ImageCandidate;
  failures: CheckResult[];
}

export interface GateOutcome {
  /** Clean candidates to show the parent (length ≤ variantsWanted). */
  variants: ImageCandidate[];
  /** Total generations performed (drives cost reporting). */
  attempts: number;
  /** Candidates that failed ≥1 check, with reasons (for logs/telemetry). */
  rejected: RejectedCandidate[];
  /** True if we got the full variantsWanted; false if the budget ran out first. */
  satisfied: boolean;
}

/**
 * `generate` is the (already provider-bound) image generator — calling it again
 * produces a fresh candidate (a reroll). Checks run concurrently per candidate.
 *
 * REROLL-WITH-REASON (2026-07-10): rerolls are not blind — the previous
 * attempt's rejection reasons are handed to `generate` so the next candidate
 * can be told what to avoid. Generators that ignore the argument keep the old
 * behavior.
 */
export async function runGate(
  generate: (avoid?: string) => Promise<ImageCandidate>,
  checks: ImageCheck[],
  ctx: GateContext,
  opts: GateOptions
): Promise<GateOutcome> {
  const variants: ImageCandidate[] = [];
  const rejected: RejectedCandidate[] = [];
  let attempts = 0;
  let avoid: string | undefined;

  const emit = (e: Omit<GateProgress, "cleanSoFar" | "wanted">) =>
    opts.onEvent?.({ ...e, cleanSoFar: variants.length, wanted: opts.variantsWanted });

  while (variants.length < opts.variantsWanted && attempts < opts.maxAttempts) {
    attempts++;
    emit({ phase: "generating", attempt: attempts });
    const candidate = await generate(avoid);
    emit({ phase: "checking", attempt: attempts });
    const results = await Promise.all(checks.map((c) => c.run(candidate, ctx)));
    const failures = results.filter((r) => r.status === "fail");
    if (failures.length === 0) {
      variants.push(candidate);
      emit({ phase: "accepted", attempt: attempts });
    } else {
      rejected.push({ candidate, failures });
      // Feed the next attempt what went wrong (trimmed — it's steering, not a essay).
      avoid = failures
        .map((f) => f.reason ?? f.check)
        .join("; ")
        .slice(0, 400);
      emit({ phase: "rejected", attempt: attempts, reason: failures[0].reason });
    }
  }

  return {
    variants,
    attempts,
    rejected,
    satisfied: variants.length >= opts.variantsWanted,
  };
}
