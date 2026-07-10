import { getGeminiClient } from "./geminiClient";
import { withRetry } from "./retry";
import { GEMINI_IMAGE_MODEL } from "./geminiProvider";
import { runGate } from "./outputGate/runGate";
import { safetyCheck, qualityCheck, consistencyCheck } from "./outputGate/checks";
import type { HouseStyle } from "./types";

// Character CARD (settei, 2026-07-10): one composite model sheet derived from
// the locked reference — turnaround (front / three-quarter / profile), two
// action poses, three expressions — so scenes see the character from every
// angle in every mood instead of gravitating back to one canonical standing
// pose. One image per character keeps the reference budget flat (the card
// REPLACES the single reference in scene calls).
// Gated: safety + quality + consistency against the original reference.

export interface CardResult {
  base64: string;
  mimeType: string;
  attempts: number;
}

export async function deriveCharacterCard(args: {
  refBase64: string;
  refMimeType: string;
  description: string;
  style: HouseStyle;
}): Promise<CardResult | null> {
  const { refBase64, refMimeType, description, style } = args;
  const ai = getGeminiClient();

  const outcome = await runGate(
    async (avoid?: string) => {
      const res = await withRetry(() =>
        ai.models.generateContent({
          model: GEMINI_IMAGE_MODEL,
          contents: [
            {
              text:
                (avoid ? `A PREVIOUS attempt was REJECTED for: ${avoid}. Do not repeat those mistakes. ` : "") +
                `Image 1 is a picture-book character reference: ${description}. ` +
                `Draw a clean MODEL SHEET of this EXACT character on a plain pale background, all in one image, ` +
                `clearly separated: TOP ROW — full-body turnaround: front view, three-quarter view, side profile ` +
                `view, all standing neutral; BOTTOM ROW — two full-body action poses (mid-stride walking or ` +
                `running; reaching or crouching) and three head-and-shoulders expressions (happy, worried, ` +
                `determined). The SAME face, hair, colours, markings, proportions, and EXACT outfit in every ` +
                `single view — this sheet defines the character. ` +
                `Art style: ${style.promptFragment}. No text, no labels, no lettering.`,
            },
            { inlineData: { mimeType: refMimeType, data: refBase64 } },
          ],
        })
      );
      const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part?.inlineData?.data) throw new Error("no image returned");
      return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType ?? "image/png" };
    },
    [safetyCheck, qualityCheck, consistencyCheck],
    {
      brief: { name: "", description, styleId: style.id },
      style,
      kind: "character-sheet",
      referenceBase64: refBase64,
    },
    { variantsWanted: 1, maxAttempts: 3 }
  );

  if (outcome.variants.length === 0) return null;
  return { ...outcome.variants[0], attempts: outcome.attempts };
}
