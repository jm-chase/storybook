import type { GateContext, ImageCandidate, ImageCheck, CheckResult } from "./types";

// The gate runner: generate → run every check → accept clean candidates, reroll
// failures, until we have `variantsWanted` clean variants or hit `maxAttempts`
// (the per-request reroll/cost cap). The parent is shown only the clean variants.

export interface GateOptions {
  /** How many clean variants to collect (D-021: choose from 3). */
  variantsWanted: number;
  /** Hard cap on total generations — the cost/latency budget. */
  maxAttempts: number;
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
 */
export async function runGate(
  generate: () => Promise<ImageCandidate>,
  checks: ImageCheck[],
  ctx: GateContext,
  opts: GateOptions
): Promise<GateOutcome> {
  const variants: ImageCandidate[] = [];
  const rejected: RejectedCandidate[] = [];
  let attempts = 0;

  while (variants.length < opts.variantsWanted && attempts < opts.maxAttempts) {
    attempts++;
    const candidate = await generate();
    const results = await Promise.all(checks.map((c) => c.run(candidate, ctx)));
    const failures = results.filter((r) => r.status === "fail");
    if (failures.length === 0) {
      variants.push(candidate);
    } else {
      rejected.push({ candidate, failures });
    }
  }

  return {
    variants,
    attempts,
    rejected,
    satisfied: variants.length >= opts.variantsWanted,
  };
}
