import type { CheckResult, GateContext, ImageCandidate, ImageCheck } from "../types";
import { visionVerdict } from "./geminiVision";

// Contact/occlusion close-inspection (settei package, item J): full-frame
// judges miss thin-structure interpenetration (a hand and lantern passing
// THROUGH a railing — found by James on the Juno book). This check runs a
// second, narrowly-focused look — but only for scenes whose description
// mentions thin structures, so the common case pays nothing.

const THIN_STRUCTURES = /railing|banister|fence|bars|ladder|balustrade|lattice|trellis|grate|cage/i;

export const contactCheck: ImageCheck = {
  name: "contact",
  async run(candidate: ImageCandidate, ctx: GateContext): Promise<CheckResult> {
    if ((ctx.kind ?? "scene") !== "scene" || !THIN_STRUCTURES.test(ctx.brief.description)) {
      return { check: "contact", status: "pass", reason: "no thin structures in scene" };
    }
    const v = await visionVerdict(
      [candidate],
      `Inspect this illustration CLOSELY at the level of hands, held objects, and thin structures ` +
        `(railings, banisters, fences, bars, ladders). FAIL if any body part or held object passes THROUGH ` +
        `a thin structure instead of being clearly in front of or behind it, or if fingers/paws merge into ` +
        `rails or bars. Look carefully at every point where a character touches or overlaps such a structure. ` +
        `PASS only if all overlaps read as correct, clean occlusion.`
    );
    return { check: "contact", status: v.pass ? "pass" : "fail", reason: v.reason };
  },
};
