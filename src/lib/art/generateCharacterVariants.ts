import { generateCharacterSheet } from "./geminiProvider";
import { runGate, type GateOptions } from "./outputGate/runGate";
import { defaultChecks } from "./outputGate/checks";
import { COST_PER_IMAGE_USD } from "./cost";
import type { CharacterBrief, HouseStyle } from "./types";
import type { ImageCandidate } from "./outputGate/types";

// Server-side orchestration (D-021): generate character candidates and run each
// through the Output Gate, returning the clean variants the parent chooses from.
// For the character SHEET there is no reference yet (it IS the reference), so the
// consistency check auto-passes; quality + the safety stub still run.

export interface VariantResult {
  variants: ImageCandidate[];
  /** Total generations performed (drives cost). */
  attempts: number;
  costUsd: number;
  /** True if we got the full variantsWanted before the budget ran out. */
  satisfied: boolean;
  /** Reasons candidates were rejected (telemetry / debugging). */
  rejected: string[];
}

export async function generateCharacterVariants(
  brief: CharacterBrief,
  style: HouseStyle,
  opts: { variantsWanted?: number; maxAttempts?: number; onEvent?: GateOptions["onEvent"] } = {}
): Promise<VariantResult> {
  const variantsWanted = opts.variantsWanted ?? 3;
  const maxAttempts = opts.maxAttempts ?? 6; // reroll/cost budget

  const generate = async (): Promise<ImageCandidate> => {
    const img = await generateCharacterSheet(brief, style);
    return { base64: img.base64, mimeType: img.mimeType };
  };

  const outcome = await runGate(generate, defaultChecks(), { brief, style }, { variantsWanted, maxAttempts, onEvent: opts.onEvent });

  return {
    variants: outcome.variants,
    attempts: outcome.attempts,
    costUsd: Number((outcome.attempts * COST_PER_IMAGE_USD).toFixed(3)),
    satisfied: outcome.satisfied,
    rejected: outcome.rejected.map((r) =>
      r.failures.map((f) => `${f.check}: ${f.reason ?? ""}`).join("; ")
    ),
  };
}
