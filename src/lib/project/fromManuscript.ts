import { MAX_PAGE_TEXT, MAX_SCENE_DESCRIPTION } from "./beats";
import { newId } from "./store";
import type { StoryBeat } from "./types";

// Skin 3 (D-023) — indie-author mode, thin v1: paste a manuscript, one page
// per blank-line-separated block, and get a storyboard prefilled with the
// page text. Each beat's sceneDescription DEFAULTS to the page text (the
// author owns both) and should be refined per page; cast is assigned in the
// studio afterwards.

export const MAX_MANUSCRIPT_PAGES = 40;

export type ManuscriptResult =
  | { ok: true; beats: StoryBeat[] }
  | { ok: false; error: string };

export function beatsFromManuscript(manuscript: unknown): ManuscriptResult {
  if (typeof manuscript !== "string" || manuscript.trim().length === 0) {
    return { ok: false, error: "Paste your manuscript — one page per paragraph (blank line between pages)." };
  }

  const pages = manuscript
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);

  if (pages.length === 0) {
    return { ok: false, error: "No pages found — separate pages with a blank line." };
  }
  if (pages.length > MAX_MANUSCRIPT_PAGES) {
    return { ok: false, error: `That's ${pages.length} pages — the maximum is ${MAX_MANUSCRIPT_PAGES}.` };
  }
  const over = pages.findIndex((p) => p.length > MAX_PAGE_TEXT);
  if (over >= 0) {
    return { ok: false, error: `Page ${over + 1} is over ${MAX_PAGE_TEXT} characters — split it with a blank line.` };
  }

  return {
    ok: true,
    beats: pages.map((text) => ({
      id: newId(),
      sceneDescription: text.slice(0, MAX_SCENE_DESCRIPTION),
      text,
      castIds: [],
    })),
  };
}
