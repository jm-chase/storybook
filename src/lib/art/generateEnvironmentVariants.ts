import { generateStandaloneScene } from "./geminiProvider";
import { getStyleSeed } from "./styleSeed";
import { runGate, type GateOptions } from "./outputGate/runGate";
import { defaultChecks } from "./outputGate/checks";
import { COST_PER_IMAGE_USD } from "./cost";
import type { HouseStyle } from "./types";
import type { ImageCandidate } from "./outputGate/types";
import type { VariantResult } from "./generateCharacterVariants";

// Environment reference generation: an establishing view of the setting, empty
// of characters, gated (safety + quality; consistency auto-passes — this IS the
// reference). The locked result conditions every scene set there.

export async function generateEnvironmentVariants(
  description: string,
  style: HouseStyle,
  opts: { variantsWanted?: number; maxAttempts?: number; onEvent?: GateOptions["onEvent"] } = {}
): Promise<VariantResult> {
  const variantsWanted = opts.variantsWanted ?? 3;
  const maxAttempts = opts.maxAttempts ?? 6;

  const styleSeed = (await getStyleSeed(style)) ?? undefined;
  const generate = async (): Promise<ImageCandidate> => {
    const img = await generateStandaloneScene({
      scenePrompt: `an establishing view of ${description}, empty of people and creatures`,
      style,
      styleSeed,
    });
    return { base64: img.base64, mimeType: img.mimeType };
  };

  const outcome = await runGate(
    generate,
    defaultChecks(),
    { brief: { name: "", description, styleId: style.id }, style },
    { variantsWanted, maxAttempts, onEvent: opts.onEvent }
  );

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
