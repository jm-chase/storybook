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

// Settings are a BAG OF PARTS to recompose, not a backdrop to trace — tracing
// the reference plate and pasting characters over it caused the "stickers on
// a static image" defect (James, 2026-07-10: door overlaid on a table, grass
// indoors, a character standing on furniture).
const SETTING_LABEL =
  "the SETTING — the scene takes place in this location. Treat this reference as the location's PARTS and " +
  "MATERIALS (its furniture, structures, surfaces, colours, and layout logic), NOT as a fixed backdrop: " +
  "REBUILD the space from whatever angle and distance the action needs. Respect the space's physical logic — " +
  "indoor floors stay indoor floors, doors open where doors are, furniture keeps its real size";

// Landmark manifest (2026-07-20): holding the WHOLE plate rigid across a big
// angle change fights the recompose instruction above — that's what produced
// a location's one identifying rock formation getting redrawn as a generic
// mound in a dramatic close-up (James: "the cliff edge changed slightly" p1
// vs p2, same setting). Naming the 2-4 things that ARE the place, and saying
// plainly that everything else is free, is the same fix as the character
// manifest one level up.
function settingLabel(env: { manifest?: { landmarks: string[] } }): string {
  if (!env.manifest || env.manifest.landmarks.length === 0) return SETTING_LABEL;
  return (
    SETTING_LABEL +
    `. This place's LANDMARKS — MUST MATCH exactly, however the camera is angled: ` +
    `${env.manifest.landmarks.join("; ")}. Everything else about the setting (camera angle, framing, ` +
    `incidental foreground rocks/plants/clouds) is free to vary shot to shot`
  );
}

const SETTING_PARTS_LABEL =
  "a PARTS SHEET of the same setting — the location's individual objects drawn separately so you can " +
  "recompose them freely and accurately from any angle; do NOT copy this sheet's layout";

/** Reroll steering: what the gate rejected last attempt (runGate feeds it). */
const avoidClause = (avoid?: string) =>
  avoid ? `A PREVIOUS attempt was REJECTED for these problems — do not repeat them: ${avoid}. ` : "";

const GROUNDING_INSTRUCTION =
  "Place the characters INSIDE the space, not on top of it: feet on a real walkable surface (never standing " +
  "on tables or furniture unless the scene says so), scale correct against doors and furniture, soft contact " +
  "shadows where they touch the ground, and let furniture or foreground objects partially overlap them where " +
  "natural. ";

const ELEMENT_VOCAB_LABEL =
  "the ELEMENT VOCABULARY for this art style — wherever the scene includes sky, clouds, sun, trees, grass, " +
  "bushes, flowers, rocks, or water, draw them in exactly the manner shown here, adapted to the scene's " +
  "lighting and composition; do NOT copy this sheet's layout or plain background, and do NOT insert elements " +
  "the scene doesn't contain — no clouds, grass, or flowers inside buildings";

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
  styleSeed?: StyleSeedRef,
  avoid?: string
): Promise<GeneratedImage> {
  const ai = getGeminiClient();
  const { labels, parts } = labeled(styleSeed ? [{ label: STYLE_SEED_LABEL, ...styleSeed }] : []);
  const prompt =
    labels +
    avoidClause(avoid) +
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
  avoid?: string;
}): Promise<GeneratedImage> {
  const ai = getGeminiClient();
  const res = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: [
        {
          text:
            avoidClause(args.avoid) +
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
  /** Optional parts sheet (component breakdown) of the same setting. */
  parts?: { base64: string; mimeType: string };
  /** Landmark checklist (settei for places) — stated in the prompt. */
  manifest?: { landmarks: string[] };
}

/** A scene with NO cast (establishing shot / environment page). */
export async function generateStandaloneScene(args: {
  scenePrompt: string;
  style: HouseStyle;
  environment?: EnvironmentRef;
  styleSeed?: StyleSeedRef;
  elementSheet?: StyleSeedRef;
  captionSpace?: boolean;
  /** Color script (CRAFT_BAR G1): this page's light/palette/mood phrase. */
  colorScript?: string;
  /** Layout binding (CRAFT_BAR G2): camera/framing direction. */
  camera?: string;
  /** Reroll steering from the gate. */
  avoid?: string;
}): Promise<GeneratedImage> {
  const ai = getGeminiClient();
  const refs: LabeledRef[] = [];
  if (args.styleSeed) refs.push({ label: STYLE_SEED_LABEL, ...args.styleSeed });
  if (args.elementSheet) refs.push({ label: ELEMENT_VOCAB_LABEL, ...args.elementSheet });
  if (args.environment) {
    refs.push({ label: settingLabel(args.environment), base64: args.environment.base64, mimeType: args.environment.mimeType });
    if (args.environment.parts) refs.push({ label: SETTING_PARTS_LABEL, ...args.environment.parts });
  }
  const { labels, parts } = labeled(refs);
  const text =
    labels +
    avoidClause(args.avoid) +
    `A children's picture-book illustration. Scene: ${args.scenePrompt}. ` +
    (args.camera ? `Camera and framing: ${args.camera}. ` : "") +
    (args.colorScript ? `Light and colour for this page: ${args.colorScript}. ` : "") +
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
  /** The reference image — the character CARD (model sheet) when one exists,
   * else the single locked reference. */
  base64: string;
  mimeType: string;
  /** Feature/wardrobe checklist (settei manifest) — stated in the prompt. */
  manifest?: { identity: string[]; wardrobe: string[] };
}

function characterLabel(c: CharacterRef): string {
  let label = `${c.label} (${c.description}`;
  if (c.manifest) {
    if (c.manifest.identity.length > 0) label += `; MUST ALWAYS HOLD: ${c.manifest.identity.join(", ")}`;
    if (c.manifest.wardrobe.length > 0) label += `; WEARING EXACTLY: ${c.manifest.wardrobe.join(", ")}`;
  }
  return label + ")";
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
  /** Color script (CRAFT_BAR G1): this page's light/palette/mood phrase. */
  colorScript?: string;
  /** Layout binding (CRAFT_BAR G2): camera/framing direction. */
  camera?: string;
  /** Acting beat-sheet note: per-character emotion + progress for this page. */
  acting?: string;
  /** Reroll steering from the gate. */
  avoid?: string;
}): Promise<GeneratedImage> {
  const ai = getGeminiClient();
  const { characters, scenePrompt, style, environment, styleSeed, elementSheet } = args;
  const refs: LabeledRef[] = [];
  if (styleSeed) refs.push({ label: STYLE_SEED_LABEL, ...styleSeed });
  if (elementSheet) refs.push({ label: ELEMENT_VOCAB_LABEL, ...elementSheet });
  for (const c of characters) refs.push({ label: characterLabel(c), base64: c.base64, mimeType: c.mimeType });
  if (environment) {
    refs.push({ label: settingLabel(environment), base64: environment.base64, mimeType: environment.mimeType });
    if (environment.parts) refs.push({ label: SETTING_PARTS_LABEL, ...environment.parts });
  }
  const { labels, parts } = labeled(refs);
  const text =
    labels +
    avoidClause(args.avoid) +
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
    `ACTING: give each character a specific, readable feeling for THIS moment, carried by posture, ` +
    `hands, and gaze — hesitation, effort, awe, mischief — not a stock smile. ` +
    (args.acting ? `Acting direction for this page — follow it exactly: ${args.acting}. ` : "") +
    GROUNDING_INSTRUCTION +
    `Scene: ${scenePrompt}. ` +
    (args.camera ? `Camera and framing: ${args.camera}. ` : "") +
    (args.colorScript ? `Light and colour for this page: ${args.colorScript}. ` : "") +
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
