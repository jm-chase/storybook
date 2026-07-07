import type { Project, CastMember, EnvironmentSetting } from "./types";

// Series — "same cast, new adventure" (D-023's retention lever). A new book
// inherits the source's style, cast, and settings — locked references and all
// (they're immutable, D-015, so the copies stay identical) — with a FRESH
// storyboard. Member/setting ids are kept so reference image filenames map
// 1:1; ids only need to be unique within a project.

export interface SeriesClone {
  cast: CastMember[];
  environments: EnvironmentSetting[];
  /** images/<file> names to copy from the source project (locked refs only). */
  imageFiles: string[];
}

export function cloneForSeries(source: Project): SeriesClone {
  const imageFiles: string[] = [];
  const cast = source.cast.map((m) => {
    if (m.locked) imageFiles.push(m.locked.file);
    return { ...m, locked: m.locked ? { ...m.locked } : undefined };
  });
  const environments = source.environments.map((e) => {
    if (e.locked) imageFiles.push(e.locked.file);
    return { ...e, locked: e.locked ? { ...e.locked } : undefined };
  });
  return { cast, environments, imageFiles };
}
