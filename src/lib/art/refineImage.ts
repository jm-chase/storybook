import { editImage } from "./geminiProvider";
import { runGate, type GateOptions } from "./outputGate/runGate";
import { safetyCheckStub, qualityCheck, visionVerdict } from "./outputGate/checks";
import { COST_PER_IMAGE_USD } from "./cost";
import type { HouseStyle } from "./types";
import type { ImageCandidate, ImageCheck } from "./outputGate/types";
import type { VariantResult } from "./generateCharacterVariants";

// Point-to-fix (D-021, Slice 3): targeted edit of locked art. The gate for an
// edit swaps the character-consistency check for an EDIT-FIDELITY check: the
// result must differ from the original ONLY by the requested change.

export const MAX_FIX_INSTRUCTION = 200;

/** Edit-fidelity check, bound to the original image + the requested change. */
function editFidelityCheck(original: ImageCandidate, instruction: string): ImageCheck {
  return {
    name: "edit-fidelity",
    async run(candidate) {
      const v = await visionVerdict(
        [original, candidate],
        `Image 1 is the original illustration. Image 2 is an edited version whose ONLY intended change is: "${instruction}". ` +
          "FAIL if the requested change was not made, or if anything ELSE changed noticeably — characters' faces, hair, " +
          "colours, outfits, the composition, the background, or the art style. " +
          "PASS only if the requested change is present and everything else matches the original.",
      );
      return { check: "edit-fidelity", status: v.pass ? "pass" : "fail", reason: v.reason };
    },
  };
}

export async function refineImageVariants(args: {
  base64: string;
  mimeType: string;
  instruction: string;
  style: HouseStyle;
  opts?: { variantsWanted?: number; maxAttempts?: number; onEvent?: GateOptions["onEvent"] };
}): Promise<VariantResult> {
  const { base64, mimeType, instruction, style } = args;
  const variantsWanted = args.opts?.variantsWanted ?? 3;
  const maxAttempts = args.opts?.maxAttempts ?? 6;
  const original: ImageCandidate = { base64, mimeType };

  const generate = async (): Promise<ImageCandidate> => {
    const img = await editImage({ base64, mimeType, instruction, style });
    return { base64: img.base64, mimeType: img.mimeType };
  };

  const outcome = await runGate(
    generate,
    [safetyCheckStub, qualityCheck, editFidelityCheck(original, instruction)],
    { brief: { name: "", description: instruction, styleId: style.id }, style },
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
