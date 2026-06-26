import { type GenerateContentResponse } from "@google/genai";
import { getGeminiClient } from "../../geminiClient";
import { withRetry } from "../../retry";

// Shared helper for vision-based gate checks: send one or more images + an
// instruction to a Gemini vision model and get back a {pass, reason} verdict.
// Uses a text/vision model (gemini-2.5-flash), NOT the image-generation model.

export const GEMINI_VISION_MODEL =
  process.env.GEMINI_VISION_MODEL ?? "gemini-2.5-flash";

export interface Verdict {
  pass: boolean;
  reason: string;
}

function textOf(res: GenerateContentResponse): string {
  const convenience = (res as unknown as { text?: string }).text;
  if (typeof convenience === "string" && convenience) return convenience;
  const parts = res.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => (p as { text?: string }).text ?? "").join("");
}

export async function visionVerdict(
  images: { base64: string; mimeType: string }[],
  instruction: string
): Promise<Verdict> {
  const ai = getGeminiClient();
  const contents = [
    {
      text:
        instruction +
        ' Respond ONLY with JSON of the form {"pass": boolean, "reason": string}.',
    },
    ...images.map((im) => ({ inlineData: { mimeType: im.mimeType, data: im.base64 } })),
  ];

  const res = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_VISION_MODEL,
      contents,
      config: { responseMimeType: "application/json" },
    })
  );

  const raw = textOf(res).trim();
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : raw) as Partial<Verdict>;
    return { pass: !!parsed.pass, reason: String(parsed.reason ?? "") };
  } catch {
    // Fail-open for quality/consistency (a missed defect just reaches the
    // variant chooser, where the parent rerolls). The SAFETY check must NOT
    // use this helper's fail-open behavior — see safetyCheck.
    return { pass: true, reason: `unparseable verdict: ${raw.slice(0, 120)}` };
  }
}
