import type { Project } from "./types";

// Beat input validation. `sceneDescription` is freeform and firewalled exactly
// like a character description (D-018): it drives ART ONLY. `text` is the
// page's prose — it is typeset at layout time and NEVER sent to the image
// model, so it needs only length/shape guards, not prompt hygiene.

export const MAX_SCENE_DESCRIPTION = 300;
export const MAX_PAGE_TEXT = 500;

export interface BeatInput {
  sceneDescription: unknown;
  text: unknown;
  castIds: unknown;
  environmentId?: unknown;
}

export type BeatResult =
  | { ok: true; value: { sceneDescription: string; text: string; castIds: string[]; environmentId?: string } }
  | { ok: false; errors: Record<string, string> };

export function validateBeatInput(input: BeatInput, project: Project): BeatResult {
  const errors: Record<string, string> = {};

  const sceneDescription =
    typeof input.sceneDescription === "string" ? input.sceneDescription.replace(/\s+/g, " ").trim() : "";
  if (sceneDescription.length === 0) {
    errors.sceneDescription = "Describe what happens in this scene.";
  } else if (sceneDescription.length > MAX_SCENE_DESCRIPTION) {
    errors.sceneDescription = `Keep the scene under ${MAX_SCENE_DESCRIPTION} characters.`;
  }

  // Empty text is allowed — wordless pages are a real picture-book device.
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (text.length > MAX_PAGE_TEXT) {
    errors.text = `Keep the page text under ${MAX_PAGE_TEXT} characters.`;
  }

  let castIds: string[] = [];
  if (input.castIds !== undefined) {
    if (!Array.isArray(input.castIds) || input.castIds.some((c) => typeof c !== "string")) {
      errors.castIds = "castIds must be a list of cast member ids.";
    } else {
      castIds = [...new Set(input.castIds as string[])];
      const known = new Set(project.cast.map((c) => c.id));
      const unknown = castIds.filter((c) => !known.has(c));
      if (unknown.length > 0) {
        errors.castIds = "One of those characters isn't in this book's cast.";
      }
    }
  }

  let environmentId: string | undefined;
  if (input.environmentId !== undefined && input.environmentId !== null && input.environmentId !== "") {
    if (typeof input.environmentId !== "string" || !project.environments.some((e) => e.id === input.environmentId)) {
      errors.environmentId = "That setting isn't in this book.";
    } else {
      environmentId = input.environmentId;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { sceneDescription, text, castIds, environmentId } };
}
