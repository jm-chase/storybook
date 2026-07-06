import type { CheckResult, GateContext, ImageCandidate, ImageCheck } from "../types";
import { visionVerdict } from "./geminiVision";

// Consistency check (D-021): is the candidate still the SAME character, in the
// SAME art style, as the locked reference? Catches the style drift we saw on
// scene 06 of the spike. A fail triggers an auto-reroll. When there's no
// reference (the character sheet itself), there's nothing to compare → pass.

export const consistencyCheck: ImageCheck = {
  name: "consistency",
  async run(candidate: ImageCandidate, ctx: GateContext): Promise<CheckResult> {
    // Multi-character scenes (D-022): verify EACH cast member against its own
    // locked reference, in a single vision call with labelled images.
    if (ctx.references && ctx.references.length > 0) {
      const refs = ctx.references;
      const labels = refs.map((r, i) => `Image ${i + 1} is the locked reference for ${r.label}.`).join(" ");
      const v = await visionVerdict(
        [...refs.map((r) => ({ base64: r.base64, mimeType: r.mimeType })), candidate],
        `${labels} The FINAL image is a story scene meant to feature ALL of these characters together. ` +
          "FAIL if any listed character is missing, or is not clearly the same character as its reference " +
          "(different face, hair, colours, or body), or if two characters' features have been blended or mixed. " +
          "PASS only if every listed character appears and each is unmistakably its reference."
      );
      return { check: "consistency", status: v.pass ? "pass" : "fail", reason: v.reason };
    }
    if (!ctx.referenceBase64) {
      return { check: "consistency", status: "pass", reason: "no reference (this is the reference)" };
    }
    const v = await visionVerdict(
      [
        { base64: ctx.referenceBase64, mimeType: candidate.mimeType },
        candidate,
      ],
      "Image 1 is a character reference. Image 2 is a story scene meant to feature the SAME character. " +
        "FAIL if Image 2 is not clearly the same character — different face, hair, colours, or outfit — " +
        "or if its art style noticeably differs from Image 1. PASS only if it is the same character in the same style."
    );
    return { check: "consistency", status: v.pass ? "pass" : "fail", reason: v.reason };
  },
};
