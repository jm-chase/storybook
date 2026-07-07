import { type GenerateContentResponse } from "@google/genai";
import { getGeminiClient } from "./geminiClient";
import { withRetry } from "./retry";
import type { CharacterBrief, HouseStyle } from "./types";

// Gemini image generation ("Nano Banana" — gemini-2.5-flash-image). Multi-image
// reference input is the character-consistency mechanism: we generate a
// character reference once, then pass it back as an inline image on every scene
// so the same character is preserved. Verified against @google/genai 2.10.0:
// ai.models.generateContent({model, contents}) → candidates[0].content.parts[].inlineData.
//
// SECURITY: this calls a paid API with a secret key — it must run server-side
// only (Next route handler / server action / a script), never in the browser.
// Cost (gemini-2.5-flash-image): ~$0.039 per generated image.

export const GEMINI_IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";

export { COST_PER_IMAGE_USD } from "./cost";

export interface GeneratedImage {
  /** base64-encoded image bytes. */
  base64: string;
  mimeType: string;
}

function firstImage(res: GenerateContentResponse): GeneratedImage {
  const parts = res.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const inline = p.inlineData;
    if (inline?.data) {
      return { base64: inline.data, mimeType: inline.mimeType ?? "image/png" };
    }
  }
  throw new Error("Gemini returned no image part.");
}

/** Generate a character reference sheet from a brief + locked house style. */
export async function generateCharacterSheet(
  brief: CharacterBrief,
  style: HouseStyle
): Promise<GeneratedImage> {
  const ai = getGeminiClient();
  const prompt =
    `A children's picture-book character reference: a single character, full body, ` +
    `friendly and appealing, on a plain neutral background. ` +
    `Character: ${brief.description}. ` +
    `Art style: ${style.promptFragment}. ` +
    `No text or lettering anywhere in the image.`;
  const res = await withRetry(() =>
    ai.models.generateContent({ model: GEMINI_IMAGE_MODEL, contents: prompt })
  );
  return firstImage(res);
}

/**
 * Generate a scene featuring the SAME character, conditioned on the reference
 * image. This is the consistency test: identical character, new pose/emotion/place.
 */
export async function generateScene(args: {
  referenceBase64: string;
  referenceMimeType?: string;
  scenePrompt: string;
  style: HouseStyle;
}): Promise<GeneratedImage> {
  const ai = getGeminiClient();
  const { referenceBase64, referenceMimeType = "image/png", scenePrompt, style } = args;
  const res = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: [
        {
          text:
            `Keep THIS exact character — same face, colours, proportions, and outfit — ` +
            `and draw them in a new scene. Scene: ${scenePrompt}. ` +
            `Art style: ${style.promptFragment}. ` +
            `A single illustration, no text or lettering.`,
        },
        { inlineData: { mimeType: referenceMimeType, data: referenceBase64 } },
      ],
    })
  );
  return firstImage(res);
}

/**
 * Point-to-fix (D-021, Slice 3): a TARGETED edit of an existing image. The
 * parent says the fix plainly ("the umbrella is too small"); we instruct the
 * model to change only that and preserve everything else. The result still
 * goes through the gate, with the ORIGINAL as the consistency reference.
 */
export async function editImage(args: {
  base64: string;
  mimeType: string;
  instruction: string;
  style: HouseStyle;
}): Promise<GeneratedImage> {
  const ai = getGeminiClient();
  const res = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: [
        {
          text:
            `Edit this illustration. Make ONLY this change: ${args.instruction}. ` +
            `Keep everything else EXACTLY as it is — same characters, faces, colours, ` +
            `composition, background, and art style (${args.style.promptFragment}). ` +
            `No text or lettering.`,
        },
        { inlineData: { mimeType: args.mimeType, data: args.base64 } },
      ],
    })
  );
  return firstImage(res);
}

/** A locked setting reference passed alongside a scene request. */
export interface EnvironmentRef {
  description: string;
  base64: string;
  mimeType: string;
}

const SETTING_INSTRUCTION =
  "The FINAL reference image shows the SETTING. Set the scene in this exact location — " +
  "keep its architecture, materials, colours, and landscape consistent with the setting image. ";

/** A scene with NO cast (establishing shot / environment page). */
export async function generateStandaloneScene(args: {
  scenePrompt: string;
  style: HouseStyle;
  environment?: EnvironmentRef;
}): Promise<GeneratedImage> {
  const ai = getGeminiClient();
  const text =
    `A children's picture-book illustration. Scene: ${args.scenePrompt}. ` +
    (args.environment ? SETTING_INSTRUCTION : "") +
    `Art style: ${args.style.promptFragment}. ` +
    `A single illustration, no characters in focus, no text or lettering.`;
  const res = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: args.environment
        ? [{ text }, { inlineData: { mimeType: args.environment.mimeType, data: args.environment.base64 } }]
        : text,
    })
  );
  return firstImage(res);
}

export interface CharacterRef {
  /** e.g. "the hero", "the sidekick". */
  label: string;
  description: string;
  base64: string;
  mimeType: string;
}

/**
 * Generate a scene with MULTIPLE locked characters together (R-18). Each
 * character's reference image is passed alongside a labelled instruction so the
 * model preserves each one and does not blend their features.
 */
export async function generateMultiCharacterScene(args: {
  characters: CharacterRef[];
  scenePrompt: string;
  style: HouseStyle;
  environment?: EnvironmentRef;
}): Promise<GeneratedImage> {
  const ai = getGeminiClient();
  const { characters, scenePrompt, style, environment } = args;
  const labels = characters
    .map((c, i) => `Image ${i + 1} is ${c.label} (${c.description}).`)
    .join(" ");
  const text =
    `${labels} ` +
    `Draw a SINGLE illustration showing these characters together. ` +
    `Keep EACH character exactly as in their reference image — same face, colours, ` +
    `proportions, and outfit — and do NOT blend or mix their features. ` +
    (environment ? SETTING_INSTRUCTION : "") +
    `Scene: ${scenePrompt}. Art style: ${style.promptFragment}. No text or lettering.`;
  const res = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: [
        { text },
        ...characters.map((c) => ({ inlineData: { mimeType: c.mimeType, data: c.base64 } })),
        ...(environment ? [{ inlineData: { mimeType: environment.mimeType, data: environment.base64 } }] : []),
      ],
    })
  );
  return firstImage(res);
}
