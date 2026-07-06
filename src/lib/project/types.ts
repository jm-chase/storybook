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

export interface Project {
  id: string;
  title: string;
  /** Project-level house style (D-016) — one style per book. */
  styleId: string;
  cast: CastMember[];
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
  updatedAt: string;
}

export function summarize(p: Project): ProjectSummary {
  return {
    id: p.id,
    title: p.title,
    styleId: p.styleId,
    castCount: p.cast.length,
    lockedCount: p.cast.filter((c) => c.locked).length,
    updatedAt: p.updatedAt,
  };
}
