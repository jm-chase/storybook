// The project/book data model (R-6, D-022, D-023). A Project is the persistent
// unit of work: one book, one house style, a locked CAST. This is the spine all
// three product skins (parent studio / classics / author B2B) share — only the
// text source differs, so the model stays text-source-agnostic.
//
// v1 persistence is the local filesystem (D-001); the schema is kept flat and
// JSON-serializable so a cloud store can replace the filesystem with no reshape.

export type CastRole = "hero" | "sidekick" | "adversary" | "friend";

export const CAST_ROLES: CastRole[] = ["hero", "sidekick", "adversary", "friend"];

/** A locked, persisted reference image for a cast member. */
export interface LockedImage {
  /** Filename inside the project's images/ dir (never a path). */
  file: string;
  mimeType: string;
  /** ISO timestamp. */
  lockedAt: string;
}

export interface CastMember {
  id: string;
  role: CastRole;
  /** Structured + validated — shared with the story (firewall, D-018). */
  name: string;
  /** Freeform — drives ART ONLY, never the plot (firewall, D-018). */
  description: string;
  /** Present once the parent has chosen + locked a reference. */
  locked?: LockedImage;
  /**
   * Feature manifest (settei, 2026-07-10): the canonical CHECKLIST extracted
   * from the locked reference — identity features that must hold in every
   * view (beard, hairline, markings) and the exact wardrobe items. Scene
   * prompts state it; the consistency judge verifies it item by item.
   */
  manifest?: { identity: string[]; wardrobe: string[] };
  /**
   * Character card (settei): one composite model sheet derived from the
   * locked reference — turnaround views, action poses, expressions — passed
   * to scenes INSTEAD of the single-pose reference.
   */
  card?: LockedImage;
}

/** A persistent setting (D-020 refinement): described once, locked as a
 * reference, then every scene set there conditions on it — same mechanism as
 * cast. Fixes the "bridge turned from stone to wood" class of drift. */
export interface EnvironmentSetting {
  id: string;
  /** Short label, validated (shortDetail kind) — e.g. "the old stone bridge". */
  name: string;
  /** Freeform — drives ART ONLY (firewall, D-018). */
  description: string;
  locked?: LockedImage;
  /**
   * Parts sheet (2026-07-10): the setting's individual objects drawn
   * separately, derived from the locked reference. Passed alongside it so
   * scenes RECOMPOSE the space from parts instead of tracing the plate
   * (the "stickers on a backdrop" fix).
   */
  components?: LockedImage;
}

/** Production metadata for a page/panel (storyboard tooling — PRD 2026-07-09).
 * Pure planning notes: never sent to the image model, never typeset in the
 * book; they live in the shot list and the board inspector. */
export interface BeatProduction {
  /** Camera direction, e.g. "low angle, wide". */
  camera?: string;
  /** Shot/blocking notes. */
  shotNotes?: string;
  /** Timing note, e.g. "slow page turn" / "2s". */
  timing?: string;
  /** Spoken-dialogue note (for animatic/read-aloud planning). */
  dialogue?: string;
}

/** One page/spread of the book: who's in it, what happens visually, the page text. */
export interface StoryBeat {
  id: string;
  /**
   * What happens VISUALLY in this scene — drives the art prompt (firewalled
   * like CastMember.description: art only, never plot logic elsewhere).
   */
  sceneDescription: string;
  /** The page's prose. Typeset separately at layout time — NEVER sent to the image model (no rendered text). */
  text: string;
  /** Which cast members appear ("who's in this beat", D-022). Order = reference order. */
  castIds: string[];
  /** Where this beat takes place — an EnvironmentSetting id, if assigned. */
  environmentId?: string;
  /** Production notes (shot list / board inspector). */
  production?: BeatProduction;
  /**
   * Color script (CRAFT_BAR G1, the Yasuda discipline): this page's light,
   * palette, and mood in a short phrase — e.g. "dusk; warm lamplight against
   * deep blue; hushed". FEEDS THE ART PROMPT. Editing it does not clear
   * locked art; it applies on the next generation.
   */
  colorScript?: string;
  /**
   * Acting note (settei package): each character's emotion, physical state,
   * and the action's progress for THIS page — arcs across the book. FEEDS
   * THE ART PROMPT like colorScript (no art-clear on edit).
   */
  acting?: string;
  /** Chosen + locked page art. */
  art?: LockedImage;
}

/** One entry in a bible list (motif / inspiration): the idea plus the pages
 * where it lives, so the philosophy links back into the book. */
export interface BibleEntry {
  id: string;
  text: string;
  /** 1-based page numbers this entry points at. */
  pages?: number[];
}

/**
 * The NORTH STAR (2026-07-10): the story bible — the central mission the
 * artist, writer, and narrator keep reverting to. Not decoration: the
 * narrative and director reviews JUDGE THE BOOK AGAINST IT, and the color
 * script consults the art direction.
 */
export interface StoryBible {
  /** What the story is REALLY about — one sentence, the emotional truth. */
  theme?: string;
  /** What a child should feel and carry away. */
  message?: string;
  /** The narrator's voice — how the words should sound read aloud. */
  voice?: string;
  /** The visual philosophy — light, palette temperament, composition values. */
  artDirection?: string;
  /** Recurring images/symbols and what they mean, linked to pages. */
  motifs?: BibleEntry[];
  /** Touchstones, references, sparks. */
  inspiration?: BibleEntry[];
}

/** A free-floating sticky note on the board (position lives in positions). */
export interface BoardNote {
  id: string;
  text: string;
}

/** Free spatial layout of the infinite storyboard board: item id (beat / cast /
 * environment / note) → canvas position. Purely presentational — reading order
 * lives in `storyboard`, and the board syncs it from the pages' left-to-right x. */
export interface BoardLayout {
  positions: Record<string, { x: number; y: number }>;
  notes?: BoardNote[];
}

export interface Project {
  id: string;
  title: string;
  /** Project-level house style (D-016) — one style per book. */
  styleId: string;
  cast: CastMember[];
  /** The book's persistent settings. */
  environments: EnvironmentSetting[];
  /** The book's pages, in reading order. */
  storyboard: StoryBeat[];
  /** Saved infinite-board layout (optional; defaults are computed). */
  board?: BoardLayout;
  /** Image boards (CRAFT_BAR G6): loose concept images made BEFORE the story
   * commits — mood, place, a single resonant image. Inspiration, not canon:
   * they condition nothing and appear as cards on the infinite board. */
  imageboard?: LockedImage[];
  /** The North Star — theme, message, voice, art direction, motifs. */
  bible?: StoryBible;
  createdAt: string;
  updatedAt: string;
  schemaVersion: 1;
}

/** Lightweight listing shape for the project picker. */
export interface ProjectSummary {
  id: string;
  title: string;
  styleId: string;
  castCount: number;
  lockedCount: number;
  beatCount: number;
  /** Beats with locked page art. */
  artCount: number;
  updatedAt: string;
}

export function summarize(p: Project): ProjectSummary {
  return {
    id: p.id,
    title: p.title,
    styleId: p.styleId,
    castCount: p.cast.length,
    lockedCount: p.cast.filter((c) => c.locked).length,
    beatCount: p.storyboard.length,
    artCount: p.storyboard.filter((b) => b.art).length,
    updatedAt: p.updatedAt,
  };
}
