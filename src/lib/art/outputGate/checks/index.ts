import type { ImageCheck } from "../types";
import { safetyCheckStub } from "./safetyCheck";
import { qualityCheck } from "./qualityCheck";
import { consistencyCheck } from "./consistencyCheck";

export { qualityCheck } from "./qualityCheck";
export { consistencyCheck } from "./consistencyCheck";
export { safetyCheckStub } from "./safetyCheck";
export { visionVerdict, type Verdict } from "./geminiVision";

/**
 * The default gate: safety → quality → consistency.
 * Safety is FIRST (reject unsafe before any other work) and is currently a
 * dev-only stub (LAUNCH_GATES.md, LG-1 — replace before launch).
 */
export function defaultChecks(): ImageCheck[] {
  return [safetyCheckStub, qualityCheck, consistencyCheck];
}
