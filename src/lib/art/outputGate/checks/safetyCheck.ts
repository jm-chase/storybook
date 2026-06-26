import type { CheckResult, ImageCheck } from "../types";

// ⚠️⚠️ LAUNCH GATE — DEV-ONLY STUB. See LAUNCH_GATES.md (LG-1). ⚠️⚠️
//
// This passes every image. A product that generates child-character imagery
// MUST replace this with a specialized abuse / CSAM screen (e.g. Thorn Safer,
// Hive, Google Cloud Vision SafeSearch) BEFORE any real user can generate or
// view an image. A general "is this inappropriate?" classifier is NOT sufficient.
//
// Replacement contract:
//   - Implement ImageCheck with name "safety".
//   - Run the candidate (and ideally the input description) through the provider.
//   - FAIL CLOSED: on provider error or timeout, return status "fail" — never
//     pass an unscreened image. (Unlike quality/consistency, which fail open.)
//   - Keep it first in the checks array so unsafe images are rejected before
//     any other work.

let warned = false;

export const safetyCheckStub: ImageCheck = {
  name: "safety",
  async run(): Promise<CheckResult> {
    if (!warned) {
      console.warn(
        "[output-gate] ⚠️ SAFETY NOT ENFORCED — using the dev stub. " +
          "Wire a real abuse/CSAM provider before launch (LAUNCH_GATES.md, LG-1)."
      );
      warned = true;
    }
    return { check: "safety", status: "pass", reason: "DEV STUB — safety not enforced" };
  },
};
