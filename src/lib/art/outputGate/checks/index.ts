import type { ImageCheck } from "../types";
import { safetyCheck } from "./safetyCheck";
import { qualityCheck } from "./qualityCheck";
import { consistencyCheck } from "./consistencyCheck";
import { contactCheck } from "./contactCheck";

export { qualityCheck } from "./qualityCheck";
export { consistencyCheck } from "./consistencyCheck";
export { safetyCheck } from "./safetyCheck";
export { contactCheck } from "./contactCheck";
export { visionVerdict, type Verdict } from "./geminiVision";

/**
 * The default gate: safety → quality → consistency.
 * Safety is FIRST (reject unsafe before any other work) and FAILS CLOSED.
 * It runs a real Gemini-vision policy screen (SAFETY_PROVIDER=stub is the
 * dev-only opt-out); a specialist CSAM provider still joins it before launch
 * (LAUNCH_GATES.md, LG-1).
 */
export function defaultChecks(): ImageCheck[] {
  return [safetyCheck, qualityCheck, contactCheck, consistencyCheck];
}
