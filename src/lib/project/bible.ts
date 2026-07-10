import type { BibleEntry, StoryBible } from "./types";

// North Star sanitation: shape + length limits for the story bible. Content
// screening happens at the route (its text feeds the reviewers' judgments).

const MAX_FIELD = 400;
const MAX_ENTRY = 240;
const MAX_ENTRIES = 12;

function cleanEntry(raw: unknown, pageCount: number): BibleEntry | null {
  const r = raw as Record<string, unknown>;
  const text = typeof r?.text === "string" ? r.text.replace(/\s+/g, " ").trim().slice(0, MAX_ENTRY) : "";
  if (!text) return null;
  const id = typeof r.id === "string" && /^[a-z0-9-]+$/.test(r.id) ? r.id : `b-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
  const pages = Array.isArray(r.pages)
    ? [...new Set(r.pages.map(Number).filter((p) => Number.isInteger(p) && p >= 1 && p <= pageCount))].sort((a, b) => a - b)
    : undefined;
  return { id, text, ...(pages && pages.length > 0 ? { pages } : {}) };
}

/** Sanitize a bible payload; returns the clean bible + every text for screening. */
export function sanitizeBible(input: unknown, pageCount: number): { bible: StoryBible; texts: Record<string, string> } {
  const r = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const field = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, MAX_FIELD) : "");
  const bible: StoryBible = {};
  const texts: Record<string, string> = {};

  for (const key of ["theme", "message", "voice", "artDirection"] as const) {
    const v = field(r[key]);
    if (v) {
      bible[key] = v;
      texts[key] = v;
    }
  }
  for (const key of ["motifs", "inspiration"] as const) {
    const list = (Array.isArray(r[key]) ? r[key] : [])
      .map((e) => cleanEntry(e, pageCount))
      .filter((e): e is BibleEntry => e !== null)
      .slice(0, MAX_ENTRIES);
    if (list.length > 0) {
      bible[key] = list;
      list.forEach((e, i) => (texts[`${key}${i + 1}`] = e.text));
    }
  }
  return { bible, texts };
}

/** Render the bible as compact context for the reviewers' instructions. */
export function bibleContext(bible: StoryBible | undefined): string {
  if (!bible) return "";
  const parts: string[] = [];
  if (bible.theme) parts.push(`THEME (what the story is really about): ${bible.theme}`);
  if (bible.message) parts.push(`MESSAGE (what the child should carry away): ${bible.message}`);
  if (bible.voice) parts.push(`VOICE: ${bible.voice}`);
  if (bible.artDirection) parts.push(`ART DIRECTION: ${bible.artDirection}`);
  if (bible.motifs?.length) parts.push(`MOTIFS: ${bible.motifs.map((m) => m.text).join(" · ")}`);
  if (parts.length === 0) return "";
  return (
    ` The book has a declared NORTH STAR — judge the work against it and flag pages that drift from it: ` +
    `<north_star>${parts.join(" | ")}</north_star>.`
  );
}
