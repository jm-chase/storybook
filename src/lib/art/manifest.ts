import { getGeminiClient } from "./geminiClient";
import { withRetry } from "./retry";
import { GEMINI_VISION_MODEL } from "./outputGate/checks/geminiVision";

// Feature & wardrobe manifest (settei, 2026-07-10): when a character locks,
// extract the canonical CHECKLIST from the chosen reference. Checklists beat
// holistic judgment — "full white beard" as an explicit criterion catches the
// mustache-vs-beard drift that same-character vibes miss, and "mustard scarf"
// as a named item catches the scarf quietly vanishing.

export interface CharacterManifest {
  /** Permanent identity features visible from any angle. */
  identity: string[];
  /** The exact wardrobe items. */
  wardrobe: string[];
}

export async function extractManifest(
  base64: string,
  mimeType: string,
  description: string
): Promise<CharacterManifest> {
  const ai = getGeminiClient();
  const res = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_VISION_MODEL,
      contents: [
        {
          text:
            `This is a picture-book character reference (described as: ${JSON.stringify(description)}). ` +
            `Extract the canonical model-sheet checklist. ` +
            `"identity": 3-6 PERMANENT physical features that must hold in every view and pose — hair (colour, ` +
            `length, style, hairline/balding), facial hair (exact kind: moustache vs full beard), eyes/glasses, ` +
            `species markings, build. Be precise enough to catch drift ("full white beard covering chin and ` +
            `cheeks", not "facial hair"). ` +
            `"wardrobe": every clothing/accessory item worn, each as one short precise phrase ("mustard-yellow ` +
            `scarf", "blue denim overalls"). ` +
            `Respond ONLY with JSON: {"identity": [string], "wardrobe": [string]}`,
        },
        { inlineData: { mimeType, data: base64 } },
      ],
      config: { responseMimeType: "application/json" },
    })
  );
  const raw = (res.candidates?.[0]?.content?.parts ?? []).map((p) => (p as { text?: string }).text ?? "").join("").trim();
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : raw) as { identity?: unknown; wardrobe?: unknown };
  const clean = (v: unknown) =>
    (Array.isArray(v) ? v : [])
      .map((x) => String(x).replace(/\s+/g, " ").trim().slice(0, 80))
      .filter((x) => x.length > 0)
      .slice(0, 8);
  const identity = clean(parsed.identity);
  const wardrobe = clean(parsed.wardrobe);
  if (identity.length === 0) throw new Error("manifest extraction returned no identity features");
  return { identity, wardrobe };
}
