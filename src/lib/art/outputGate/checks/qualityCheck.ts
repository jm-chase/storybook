import type { CheckResult, GateContext, ImageCandidate, ImageCheck } from "../types";
import { visionVerdict } from "./geminiVision";

// Quality check (D-021): catches the AI "tells" so the parent never has to.
// Covers anatomy errors, out-of-proportion key props (e.g. the too-small
// umbrella), and garbled/unwanted text. A fail triggers an auto-reroll.

const INSTRUCTION =
  "You are inspecting a single children's picture-book illustration for production defects. " +
  "FAIL it if you see ANY of these: " +
  "(1) anatomy errors — extra or missing limbs, hands, or fingers; a third arm/hand; malformed or distorted faces; " +
  "(2) a key prop badly out of proportion — e.g. an umbrella far too small or too large for the character; " +
  "(3) garbled, misspelled, or unwanted text rendered inside the illustration. " +
  "PASS it only if it is clean, well-formed, and free of these defects.";

export const qualityCheck: ImageCheck = {
  name: "quality",
  async run(candidate: ImageCandidate, _ctx: GateContext): Promise<CheckResult> {
    const v = await visionVerdict([candidate], INSTRUCTION);
    return { check: "quality", status: v.pass ? "pass" : "fail", reason: v.reason };
  },
};
