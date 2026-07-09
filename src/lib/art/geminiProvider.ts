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

/** A locked style-seed image (see lib/art/styleSeed.ts). */
export interface StyleSeedRef {
  base64: string;
  mimeType: string;
}

interface LabeledRef {
  label: string;
  base64: string;
  mimeType: string;
}

const STYLE_SEED_LABEL =
  "the ART STYLE reference — match its rendering technique, texture, palette, linework, and lighting exactly, " +
  "but do NOT copy its subject, scenery, or content";

const SETTING_LABEL =
  "the SETTING — set the scene in this exact location, keeping its architecture, materials, colours, and landscape consistent";

const ELEMENT_VOCAB_LABEL =
  "the ELEMENT VOCABULARY for this art style — wherever the scene includes sky, clouds, sun, trees, grass, " +
  "bushes, flowers, rocks, or water, draw them in exactly the manner shown here, adapted to the scene's " +
  "lighting and composition; do NOT copy this sheet's layout or plain background";

// Pages with text get a typeset caption panel overlaid on the lower part of
// the art (bookPdf) — ask the model to keep that region visually quiet.
// Wording matters: an early "keep the bottom uncluttered" draft made the model
// leave a literal blank band + frame (the D-020 border-drift class).
const CAPTION_SPACE_INSTRUCTION =
  "The painting must fill the ENTIRE image edge-to-edge with no blank margins, " +
  "border, or frame. Place the focal action in the upper two-thirds; the lower " +
  "part of the scene should be simple painted ground, water, or grass with no " +
  "important details, since a caption will be placed over it. ";

/** Number the reference images and produce the matching inlineData parts. */
function labeled(refs: LabeledRef[]): { labels: string; parts: { inlineData: { mimeType: string; data: string } }[] } {
  return {
    labels: refs.length === 0 ? "" : refs.map((r, i) => `Image ${i + 1} is ${r.label}.`).join(" ") + " ",
    parts: refs.map((r) => ({ inlineData: { mimeType: r.mimeType, data: r.base64 } })),
  };
}

/** Generate a character reference sheet from a brief + locked house style. */
export async function generateCharacterSheet(
  brief: CharacterBrief,
  style: HouseStyle,
  styleSeed?: StyleSeedRef
): Promise<GeneratedImage> {
  const ai = getGeminiClient();
  const { labels, parts } = labeled(styleSeed ? [{ label: STYLE_SEED_LABEL, ...styleSeed }] : []);
  const prompt =
    labels +
    `A children's picture-book character reference: a single character, full body, ` +
    `friendly and appealing, on a plain neutral background. ` +
    `Character: ${brief.description}. ` +
    `Art style: ${style.promptFragment}. ` +
    `No text or lettering anywhere in the image.`;
  const res = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: parts.length > 0 ? [{ text: prompt }, ...parts] : prompt,
    })
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

/** A scene with NO cast (establishing shot / environment page). */
export async function generateStandaloneScene(args: {
  scenePrompt: string;
  style: HouseStyle;
  environment?: EnvironmentRef;
  styleSeed?: StyleSeedRef;
  elementSheet?: StyleSeedRef;
  captionSpace?: boolean;
}): Promise<GeneratedImage> {
  const ai = getGeminiClient();
  const refs: LabeledRef[] = [];
  if (args.styleSeed) refs.push({ label: STYLE_SEED_LABEL, ...args.styleSeed });
  if (args.elementSheet) refs.push({ label: ELEMENT_VOCAB_LABEL, ...args.elementSheet });
  if (args.environment) refs.push({ label: SETTING_LABEL, base64: args.environment.base64, mimeType: args.environment.mimeType });
  const { labels, parts } = labeled(refs);
  const text =
    labels +
    `A children's picture-book illustration. Scene: ${args.scenePrompt}. ` +
    (args.captionSpace ? CAPTION_SPACE_INSTRUCTION : "") +
    `Art style: ${args.style.promptFragment}. ` +
    `A single illustration, no characters in focus, no text or lettering.`;
  const res = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: parts.length > 0 ? [{ text }, ...parts] : text,
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
  styleSeed?: StyleSeedRef;
  elementSheet?: StyleSeedRef;
  captionSpace?: boolean;
}): Promise<GeneratedImage> {
  const ai = getGeminiClient();
  const { characters, scenePrompt, style, environment, styleSeed, elementSheet } = args;
  const refs: LabeledRef[] = [];
  if (styleSeed) refs.push({ label: STYLE_SEED_LABEL, ...styleSeed });
  if (elementSheet) refs.push({ label: ELEMENT_VOCAB_LABEL, ...elementSheet });
  for (const c of characters) refs.push({ label: `${c.label} (${c.description})`, base64: c.base64, mimeType: c.mimeType });
  if (environment) refs.push({ label: SETTING_LABEL, base64: environment.base64, mimeType: environment.mimeType });
  const { labels, parts } = labeled(refs);
  const text =
    labels +
    `Draw a SINGLE illustration showing these characters together. ` +
    `Keep EACH character's IDENTITY exactly as in their reference image — same face, hair, ` +
    `eyes, colours, markings, and body proportions — and do NOT blend or mix their features. ` +
    `Keep each character's outfit from the reference too, UNLESS the scene clearly calls for ` +
    `different clothing (such as sleeping, swimming, or dressing up) — then change only the ` +
    `clothes and keep the character unmistakably recognizable. ` +
    `Keep each character's SIZE relative to the others true to their reference proportions. ` +
    `Pose every character mid-action, actually DOING what the scene describes — natural, lively ` +
    `body language, facing and physically engaging their target — never stiffly standing and ` +
    `facing the viewer unless the scene asks for it. ` +
    `Scene: ${scenePrompt}. ` +
    (args.captionSpace ? CAPTION_SPACE_INSTRUCTION : "") +
    `Art style: ${style.promptFragment}. No text or lettering.`;
  const res = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: [{ text }, ...parts],
    })
  );
  return firstImage(res);
}
