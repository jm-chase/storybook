import type { MotifCatalog, Skeleton } from "./types";

// Deterministic skeleton renderer. Given a skeleton, the motif catalog, and a
// selection (motif ids + already-validated personalization values), it produces
// the finished story text by substituting slots into the fixed beat templates.
//
// This is deterministic on purpose: it has NO model call. In the full pipeline,
// a light Claude personalization pass may smooth wording within the same fixed
// structure, but the renderer proves the skeleton stands on its own — and lets
// us preview/test story quality with no API key.

export interface StorySelection {
  emotionId: string;
  feelingId: string;
  environmentId: string;
  lessonId: string;
  sidekickId: string;
  /** Already-validated personalization values, keyed by slot name. */
  personalization: Record<string, string>;
}

export interface RenderedStory {
  title: string;
  /** One string per beat (≈ per page). */
  pages: string[];
}

export type RenderResult =
  | { ok: true; story: RenderedStory }
  | { ok: false; errors: string[] };

function substitute(text: string, map: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key) =>
    Object.prototype.hasOwnProperty.call(map, key) ? map[key] : whole
  );
}

export function renderStory(
  skeleton: Skeleton,
  catalog: MotifCatalog,
  selection: StorySelection
): RenderResult {
  const errors: string[] = [];

  // 1. Validate that each selected motif id is allowed by this skeleton AND exists in the catalog.
  const checkMotif = (
    dim: keyof Skeleton["motifs"],
    id: string,
    table: Record<string, unknown>
  ) => {
    if (!skeleton.motifs[dim].includes(id) || !(id in table)) {
      errors.push(`Invalid ${dim} for "${skeleton.id}": "${id}".`);
    }
  };
  checkMotif("emotions", selection.emotionId, catalog.emotions);
  checkMotif("feelings", selection.feelingId, catalog.feelings);
  checkMotif("environments", selection.environmentId, catalog.environments);
  checkMotif("lessons", selection.lessonId, catalog.lessons);
  checkMotif("sidekicks", selection.sidekickId, catalog.sidekicks);

  // 2. Validate required personalization slots are present and non-empty.
  for (const slot of skeleton.personalization) {
    const value = selection.personalization[slot.name];
    if (slot.required && (!value || value.trim().length === 0)) {
      errors.push(`Missing required personalization: "${slot.name}".`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  // 3. Build the substitution map. Motif slots + personalization + derived labels.
  const map: Record<string, string> = {
    ...selection.personalization,
    sidekickLabel: catalog.sidekicks[selection.sidekickId].label,
    emotion: catalog.emotions[selection.emotionId].word,
    feeling: catalog.feelings[selection.feelingId].word,
    envOpening: catalog.environments[selection.environmentId].openingPhrase,
    lessonTurn: catalog.lessons[selection.lessonId].turnFragment,
  };

  // 4. Substitute. Two passes: the lesson fragment ({lessonTurn}) itself contains
  //    slots like {heroName}/{sidekickName}/{sidekickLabel}, expanded on pass two.
  const fill = (t: string) => substitute(substitute(t, map), map);

  const title = fill(skeleton.title);
  const pages = skeleton.beats.map(fill);

  // 5. Guard: no unfilled slots should remain (catches template/catalog drift).
  const leftover = [title, ...pages].join("\n").match(/\{(\w+)\}/g);
  if (leftover) {
    return {
      ok: false,
      errors: [`Unfilled slots remain: ${[...new Set(leftover)].join(", ")}.`],
    };
  }

  return { ok: true, story: { title, pages } };
}
