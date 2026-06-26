import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";
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

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set (add it to .env.local).");
  }
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

export interface GeneratedImage {
  /** base64-encoded image bytes. */
  base64: string;
  mimeType: string;
}

/**
 * Retry transient failures: 429/RESOURCE_EXHAUSTED (quota/rate) and
 * 503/UNAVAILABLE ("high demand"). Honors the server's retry delay when given,
 * otherwise exponential backoff.
 */
async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e);
      const retriable = /\b429\b|RESOURCE_EXHAUSTED|\b503\b|UNAVAILABLE|high demand/i.test(msg);
      if (!retriable || attempt >= tries - 1) throw e;
      const m = msg.match(/retry in ([0-9.]+)s/i) ?? msg.match(/"retryDelay":\s*"([0-9.]+)s"/);
      const waitMs = m
        ? (Math.ceil(parseFloat(m[1])) + 1) * 1000
        : Math.min(3000 * 2 ** attempt, 30000);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
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
  const ai = getClient();
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
  const ai = getClient();
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
