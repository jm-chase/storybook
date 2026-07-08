import { getGeminiClient } from "../../geminiClient";
import { withRetry } from "../../retry";
import { GEMINI_VISION_MODEL } from "./geminiVision";
import type { CheckResult, GateContext, ImageCandidate, ImageCheck } from "../types";

// LG-1 image-safety check. Every generated image passes through here FIRST,
// and the check FAILS CLOSED: a provider error, timeout, or unparseable
// verdict rejects the image — an unscreened image never reaches a user.
//
// Provider selection (SAFETY_PROVIDER env):
//   "gemini" (default) — a strict Gemini-vision policy classifier (below).
//   "stub"             — dev-only opt-OUT for offline work: passes everything,
//                        warns loudly. Never set in production.
//
// ⚠️ LG-1 is not fully closed by this: a general vision classifier is a real
// safety layer but NOT a specialist CSAM screen. Before launch, add a
// purpose-built provider (Thorn Safer / Hive class — James's account/contract
// call, see LAUNCH_GATES.md) as a second arm in this same check. The
// fail-closed + first-in-gate wiring here is the drop-in point.

const POLICY =
  `You are a strict image-safety screen for a picture-book product whose images may depict children. ` +
  `Judge the attached generated illustration. Mark it UNSAFE if it contains ANY of: ` +
  `nudity or sexual or suggestive content of any kind; any child depicted in a sexualized, abusive, ` +
  `exploitative, or degrading way; realistic violence, gore, blood, or injury; torture or cruelty; ` +
  `frightening horror imagery; hate symbols or extremist imagery; drugs, alcohol, or tobacco use; ` +
  `glorified realistic weapons; or self-harm. Mild cartoon peril appropriate to a young children's ` +
  `story (a huffing wolf, a grumpy troll) is SAFE. ` +
  `Respond ONLY with JSON: {"safe": boolean, "reason": string}.`;

let warnedStub = false;

async function geminiSafetyVerdict(candidate: ImageCandidate, ctx: GateContext): Promise<CheckResult> {
  try {
    const ai = getGeminiClient();
    const res = await withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_VISION_MODEL,
        contents: [
          { text: `${POLICY} For context, the image was requested from this description: ${JSON.stringify(ctx.brief.description)}` },
          { inlineData: { mimeType: candidate.mimeType, data: candidate.base64 } },
        ],
        config: { responseMimeType: "application/json" },
      })
    );
    const raw = (res.candidates?.[0]?.content?.parts ?? [])
      .map((p) => (p as { text?: string }).text ?? "")
      .join("")
      .trim();
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : raw) as { safe?: unknown; reason?: unknown };
    if (typeof parsed.safe !== "boolean") throw new Error(`malformed safety verdict: ${raw.slice(0, 120)}`);
    return {
      check: "safety",
      status: parsed.safe ? "pass" : "fail",
      reason: String(parsed.reason ?? ""),
    };
  } catch (e) {
    // FAIL CLOSED — never pass an unscreened image.
    return { check: "safety", status: "fail", reason: `safety screen unavailable (${(e as Error).message.slice(0, 160)}) — failing closed` };
  }
}

export const safetyCheck: ImageCheck = {
  name: "safety",
  async run(candidate: ImageCandidate, ctx: GateContext): Promise<CheckResult> {
    if (process.env.SAFETY_PROVIDER === "stub") {
      if (!warnedStub) {
        console.warn(
          "[output-gate] ⚠️ SAFETY NOT ENFORCED — SAFETY_PROVIDER=stub (offline dev only). " +
            "Unset it to restore the real screen (LAUNCH_GATES.md, LG-1)."
        );
        warnedStub = true;
      }
      return { check: "safety", status: "pass", reason: "DEV STUB — safety not enforced" };
    }
    return geminiSafetyVerdict(candidate, ctx);
  },
};
