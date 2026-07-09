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
  /** Chosen + locked page art. */
  art?: LockedImage;
}

/** Free spatial layout of the infinite storyboard board: item id (beat / cast /
 * environment) → canvas position. Purely presentational — reading order lives
 * in `storyboard`, and the board syncs it from the pages' left-to-right x. */
export interface BoardLayout {
  positions: Record<string, { x: number; y: number }>;
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
