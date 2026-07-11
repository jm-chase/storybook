import { getGeminiClient } from "../art/geminiClient";
import { withRetry } from "../art/retry";
import { GEMINI_IMAGE_MODEL } from "../art/geminiProvider";
import { GEMINI_VISION_MODEL } from "../art/outputGate/checks/geminiVision";
import { runGate } from "../art/outputGate/runGate";
import { safetyCheck, qualityCheck } from "../art/outputGate/checks";
import type { HouseStyle } from "../art/types";

// Custom style derivation (2026-07-11): mint a new art style from the USER'S
// OWN reference images. Legal posture (D-016 extended): the user attests they
// own or have rights to the references; the derived promptFragment is
// TECHNIQUE ATTRIBUTES ONLY — the vision pass is forbidden from naming
// artists, studios, franchises, or characters, so the style definition stays
// clean regardless of what it learned from. Every uploaded image passes the
// safety screen before anything is derived.

export interface DerivedStyleDef {
  name: string;
  blurb: string;
  promptFragment: string;
  swatches: string[];
}

interface RefImage {
  base64: string;
  mimeType: string;
}

/** Vision pass: attribute-only style definition from the references. */
export async function deriveStyleDefinition(refs: RefImage[], hint?: string): Promise<DerivedStyleDef> {
  const ai = getGeminiClient();
  const res = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_VISION_MODEL,
      contents: [
        {
          text:
            `These are reference images defining an illustration style for a children's picture-book studio` +
            (hint ? ` (the user calls it: ${JSON.stringify(hint)})` : "") +
            `. Derive the style DEFINITION as pure technique vocabulary. ` +
            `STRICT RULE: never name an artist, studio, franchise, film, book, or character — describe only ` +
            `observable technique: medium, linework, texture, palette temperament, light, shape language, mood. ` +
            `Write: "name" — a short original two-or-three-word brand name for the style (invented, not a ` +
            `reference to anything existing); "blurb" — one picker-card line; "promptFragment" — the runtime ` +
            `style instruction, 15-30 words of comma-separated technique attributes; "swatches" — the four ` +
            `dominant palette colours as hex strings. ` +
            `Respond ONLY with JSON: {"name": string, "blurb": string, "promptFragment": string, "swatches": [string]}`,
        },
        ...refs.map((r) => ({ inlineData: { mimeType: r.mimeType, data: r.base64 } })),
      ],
      config: { responseMimeType: "application/json" },
    })
  );
  const raw = (res.candidates?.[0]?.content?.parts ?? []).map((p) => (p as { text?: string }).text ?? "").join("").trim();
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : raw) as Partial<DerivedStyleDef>;
  const name = String(parsed.name ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  const promptFragment = String(parsed.promptFragment ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (!name || !promptFragment) throw new Error("style derivation returned an incomplete definition");
  // Defense in depth on the attribute-only rule: strip anything that survived
  // as a proper-noun "style of X" construction.
  if (/style of [A-Z]/.test(promptFragment) || /\b(disney|ghibli|pixar|dreamworks)\b/i.test(`${name} ${promptFragment}`)) {
    throw new Error("derived definition referenced a third-party name — rejected");
  }
  return {
    name,
    blurb: String(parsed.blurb ?? "").replace(/\s+/g, " ").trim().slice(0, 80) || "A custom style from your references.",
    promptFragment,
    swatches: (Array.isArray(parsed.swatches) ? parsed.swatches : [])
      .map((s) => String(s).trim())
      .filter((s) => /^#[0-9a-fA-F]{6}$/.test(s))
      .slice(0, 4),
  };
}

/** Generate a gated plate (seed or element sheet) conditioned on the user refs. */
export async function deriveStylePlate(args: {
  refs: RefImage[];
  style: HouseStyle;
  kind: "seed" | "elements";
}): Promise<RefImage | null> {
  const { refs, style, kind } = args;
  const ai = getGeminiClient();
  const subject =
    kind === "seed"
      ? `a rolling green meadow with one large old tree, a winding dirt path, a small wooden footbridge over a brook, and soft clouds in a wide sky`
      : `a clean reference sheet on a plain pale background showing, clearly separated in a loose grid: one fluffy cloud, one sun, one leafy deciduous tree, one pine tree, one tuft of grass, one flowering bush, one single flower, one rock, and a small patch of rippling water`;

  const outcome = await runGate(
    async (avoid?: string) => {
      const res = await withRetry(() =>
        ai.models.generateContent({
          model: GEMINI_IMAGE_MODEL,
          contents: [
            {
              text:
                (avoid ? `A PREVIOUS attempt was REJECTED for: ${avoid}. Do not repeat those mistakes. ` : "") +
                `The attached images define an ART STYLE — match their rendering technique, texture, palette, ` +
                `linework, and lighting exactly, but do NOT copy their subjects or content. Draw: ${subject}. ` +
                `Style attributes: ${style.promptFragment}. ` +
                `No people, no animals, no characters, no text or lettering, no faces on any element.`,
            },
            ...refs.map((r) => ({ inlineData: { mimeType: r.mimeType, data: r.base64 } })),
          ],
        })
      );
      const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part?.inlineData?.data) throw new Error("no image returned");
      return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType ?? "image/png" };
    },
    [safetyCheck, qualityCheck],
    {
      brief: { name: "", description: `style plate (${kind})`, styleId: style.id },
      style,
      kind: kind === "seed" ? "environment" : "character-sheet",
    },
    { variantsWanted: 1, maxAttempts: 3 }
  );
  return outcome.variants[0] ?? null;
}
