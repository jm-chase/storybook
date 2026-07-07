import { generateMultiCharacterScene, generateStandaloneScene, type CharacterRef, type EnvironmentRef } from "./geminiProvider";
import { getStyleSeed } from "./styleSeed";
import { runGate, type GateOptions } from "./outputGate/runGate";
import { defaultChecks } from "./outputGate/checks";
import { COST_PER_IMAGE_USD } from "./cost";
import type { HouseStyle } from "./types";
import type { ImageCandidate } from "./outputGate/types";
import type { VariantResult } from "./generateCharacterVariants";

// Scene generation for a storyboard beat (D-022): the beat's cast members'
// locked references condition the image, and the gate verifies EACH character
// against its own reference (GateContext.references). Zero-cast beats
// (establishing shots) generate a plain scene — consistency auto-passes.

export async function generateSceneVariants(args: {
  scenePrompt: string;
  style: HouseStyle;
  characters: CharacterRef[];
  /** Locked setting reference — scenes condition on it when the beat has one. */
  environment?: EnvironmentRef;
  opts?: { variantsWanted?: number; maxAttempts?: number; onEvent?: GateOptions["onEvent"] };
}): Promise<VariantResult> {
  const { scenePrompt, style, characters, environment } = args;
  const variantsWanted = args.opts?.variantsWanted ?? 3;
  const maxAttempts = args.opts?.maxAttempts ?? 6;

  const styleSeed = (await getStyleSeed(style)) ?? undefined;
  const generate = async (): Promise<ImageCandidate> => {
    const img =
      characters.length === 0
        ? await generateStandaloneScene({ scenePrompt, style, environment, styleSeed })
        : await generateMultiCharacterScene({ characters, scenePrompt, style, environment, styleSeed });
    return { base64: img.base64, mimeType: img.mimeType };
  };

  const outcome = await runGate(
    generate,
    defaultChecks(),
    {
      // The gate's brief is character-oriented; for a scene the description is the scene itself.
      brief: { name: "", description: scenePrompt, styleId: style.id },
      style,
      references: characters.map((c) => ({ label: c.label, base64: c.base64, mimeType: c.mimeType })),
    },
    { variantsWanted, maxAttempts, onEvent: args.opts?.onEvent }
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
