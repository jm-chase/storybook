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

/** A labelled locked reference — one per cast member appearing in the image. */
export interface NamedReference {
  /** e.g. "the hero Mia" — used in the vision-check instruction. */
  label: string;
  base64: string;
  mimeType: string;
}

export interface GateContext {
  brief: CharacterBrief;
  style: HouseStyle;
  /**
   * What kind of image is being gated. Checks scope their clauses by this:
   * a character SHEET legitimately sits on a plain background (no border
   * check) and depicts no action (no action-fidelity check). Default: "scene".
   */
  kind?: "character-sheet" | "environment" | "scene";
  /** The locked character reference, for consistency checks (absent for the first/reference image). */
  referenceBase64?: string;
  /**
   * Multi-character scenes (D-022): EACH cast member's own locked reference.
   * When present, the consistency check verifies every listed character
   * appears on-model — takes precedence over referenceBase64.
   */
  references?: NamedReference[];
}

export interface ImageCheck {
  /** Short stable name, surfaced in CheckResult.check. */
  readonly name: string;
  run(candidate: ImageCandidate, ctx: GateContext): Promise<CheckResult>;
}
