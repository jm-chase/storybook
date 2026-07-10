import type { CheckResult, GateContext, ImageCandidate, ImageCheck } from "../types";
import { visionVerdict } from "./geminiVision";

// Quality check (D-021): catches the AI "tells" so the parent never has to.
// Covers anatomy errors, out-of-proportion key props (e.g. the too-small
// umbrella), garbled/unwanted text, borders/frames (the D-020 drift class that
// slipped through on the Finn book), and described-action fidelity (the wolf
// must actually be blowing AT the house). A fail triggers an auto-reroll.

const BASE_CLAUSES =
  "You are inspecting a single children's picture-book illustration for production defects. " +
  "FAIL it if you see ANY of these: " +
  "(1) anatomy errors — extra or missing limbs, hands, or fingers; a third arm/hand; malformed or distorted faces; " +
  "(2) a key prop badly out of proportion — e.g. an umbrella far too small or too large for the character; " +
  "(3) garbled, misspelled, or unwanted text rendered inside the illustration";

// Scene-only clauses. A character SHEET legitimately sits on a plain empty
// background (border clause would false-positive — it burned the reroll
// budget on the second Finn run) and depicts no action.
const BORDER_CLAUSE =
  "; (4) a drawn border, frame, or blank margin strip around the artwork — a full-bleed illustration must fill the image edge-to-edge";
const ACTION_CLAUSE = (sceneDescription: string) =>
  `; (5) the scene's key described action is missing or physically incoherent — e.g. a character described as ` +
  `blowing at or pushing a thing is facing away from it or disconnected from the effect ` +
  `(the scene description: ${JSON.stringify(sceneDescription)})`;

// Applies to SCENES and ENVIRONMENTS both — a spatially-broken setting
// reference poisons every page set there and deadlocks the scene gate
// (found live 2026-07-10: a stairwell reference with grass indoors made all
// six scene attempts fail for inherited indoor grass).
const SPATIAL_CLAUSE = (description: string) =>
  `; (6) SPATIAL/PHYSICAL LOGIC broken — a character standing ON furniture (a table, a shelf) when the ` +
  `description doesn't call for it, or floating without contact with the ground; characters or objects pasted ` +
  `OVER other objects they should be behind or beside (a door overlapping a table, furniture interpenetrating); ` +
  `wrong scale against doors or furniture; an INDOOR space with outdoor ground (grass, wildflowers, garden ` +
  `rocks) growing inside, or the reverse, unless the description asks for it; and ELEVATION logic — the view ` +
  `through windows must match the location's height (a tower-top or upper-floor room cannot have ground-level ` +
  `gardens, grass, or tree trunks directly outside its windows) ` +
  `(the description: ${JSON.stringify(description)})`;

export const qualityCheck: ImageCheck = {
  name: "quality",
  async run(candidate: ImageCandidate, ctx: GateContext): Promise<CheckResult> {
    const kind = ctx.kind ?? "scene";
    let instruction = BASE_CLAUSES;
    if (kind !== "character-sheet") instruction += BORDER_CLAUSE;
    if (kind === "scene") instruction += ACTION_CLAUSE(ctx.brief.description);
    if (kind === "scene" || kind === "environment") instruction += SPATIAL_CLAUSE(ctx.brief.description);
    instruction += ". PASS it only if it is clean, well-formed, and free of these defects.";
    const v = await visionVerdict([candidate], instruction);
    return { check: "quality", status: v.pass ? "pass" : "fail", reason: v.reason };
  },
};
