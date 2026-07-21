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

export interface EnvironmentManifest {
  /** The 2-4 identifying features of this place — the things a reader would
   * recognize it by, held fixed while camera angle/framing/incidentals vary. */
  landmarks: string[];
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

// Environment manifest (2026-07-20): same fix as the character checklist, one
// level up. A recompose-from-parts setting was drifting on re-angle — e.g. a
// cliff's one identifying rock formation redrawn as a generic mound in a
// dramatic close-up (James, "the cliff edge changed slightly" p1->p2). Holding
// the WHOLE plate rigid fights the recompose system elsewhere (that's the
// "stickers on a backdrop" bug this project already fixed); holding nothing
// loses the place's identity. The fix is the same shape as CharacterManifest:
// name the few things that ARE the place, leave everything else free.
export async function extractEnvironmentManifest(
  base64: string,
  mimeType: string,
  description: string
): Promise<EnvironmentManifest> {
  const ai = getGeminiClient();
  const res = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_VISION_MODEL,
      contents: [
        {
          text:
            `This is a picture-book SETTING reference (described as: ${JSON.stringify(description)}). ` +
            `Extract 2-4 LANDMARK features — the specific things that make this place recognizable as ` +
            `itself from any camera angle or distance, not generic dressing. Examples of the right ` +
            `precision: "a dark jagged rock spire with vertical striations jutting into the sea, with a ` +
            `foam-filled cove directly beneath it" (not "a cliff"); "a round green door with a brass ` +
            `knocker and a crooked stone chimney" (not "a cottage"). Skip incidental elements that can ` +
            `reasonably differ shot to shot (loose foreground rocks, individual flowers, exact cloud shapes). ` +
            `EXCLUDE weather, time of day, sun/moon, and sky/cloud state entirely — those change per page ` +
            `and must never be locked. Landmarks are STRUCTURAL/GEOGRAPHIC only (rock formations, buildings, ` +
            `fixed furniture, terrain shape). Each landmark ONE short sentence, under 20 words. ` +
            `Respond ONLY with JSON: {"landmarks": [string]}`,
        },
        { inlineData: { mimeType, data: base64 } },
      ],
      config: { responseMimeType: "application/json" },
    })
  );
  const raw = (res.candidates?.[0]?.content?.parts ?? []).map((p) => (p as { text?: string }).text ?? "").join("").trim();
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : raw) as { landmarks?: unknown };
  const landmarks = (Array.isArray(parsed.landmarks) ? parsed.landmarks : [])
    .map((x) => String(x).replace(/\s+/g, " ").trim().slice(0, 220))
    .filter((x) => x.length > 0)
    .slice(0, 4);
  if (landmarks.length === 0) throw new Error("environment manifest extraction returned no landmarks");
  return { landmarks };
}
