import { validateField } from "../validation";

// Build a validated CharacterBrief from studio inputs.
//
// FIREWALL (P-1): the hero's `name` is a STRUCTURED, validated field (letters
// allowlist) — safe to use in both the story and the art. The `description` is
// FREEFORM and is for ART ONLY; it is never woven into the plot. Here we apply
// structural guards (non-empty, length); CONTENT moderation of the description
// (the Claude input pass + the image output pass) runs at generate time in the
// provider, where the API key lives. Keeping name and description separate is
// the firewall: nothing the parent types as a visual brief can steer the plot.

export interface BriefInput {
  name: unknown;
  description: unknown;
  styleId: string;
}

export interface BuiltBrief {
  name: string;
  description: string;
  styleId: string;
}

export type BriefResult =
  | { ok: true; brief: BuiltBrief }
  | { ok: false; errors: Record<string, string> };

export const MAX_DESCRIPTION = 300;

export function buildCharacterBrief(
  input: BriefInput,
  validStyleIds: string[]
): BriefResult {
  const errors: Record<string, string> = {};

  // Name — structured + validated (shared by story + art).
  const nameRes = validateField(input.name, "name", { required: true });
  let name = "";
  if (nameRes.ok) name = nameRes.value;
  else errors.name = nameRes.message;

  // Description — freeform, ART ONLY. Structural guards only; content moderation is deferred to generate time.
  const description =
    typeof input.description === "string"
      ? input.description.replace(/\s+/g, " ").trim()
      : "";
  if (description.length === 0) {
    errors.description = "Describe your character in a few words.";
  } else if (description.length > MAX_DESCRIPTION) {
    errors.description = `Keep the description under ${MAX_DESCRIPTION} characters.`;
  }

  if (!validStyleIds.includes(input.styleId)) {
    errors.styleId = "Choose an art style.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, brief: { name, description, styleId: input.styleId } };
}
