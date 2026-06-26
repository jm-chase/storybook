import type { CharacterBrief, HouseStyle } from "../types";

// The Output Gate (D-021): every generated image passes through a set of checks
// — safety, quality (anatomy + prop proportion + text leakage), consistency —
// before a parent ever sees it. Failing candidates are rerolled. This file is
// the vendor- and provider-agnostic seam; concrete checks implement ImageCheck.

export interface ImageCandidate {
  base64: string;
  mimeType: string;
}

export type CheckStatus = "pass" | "fail";

export interface CheckResult {
  /** Which check produced this (e.g. "quality", "consistency", "safety"). */
  check: string;
  status: CheckStatus;
  /** Why it failed (shown in logs / used to steer a reroll). */
  reason?: string;
}

export interface GateContext {
  brief: CharacterBrief;
  style: HouseStyle;
  /** The locked character reference, for consistency checks (absent for the first/reference image). */
  referenceBase64?: string;
}

export interface ImageCheck {
  /** Short stable name, surfaced in CheckResult.check. */
  readonly name: string;
  run(candidate: ImageCandidate, ctx: GateContext): Promise<CheckResult>;
}
