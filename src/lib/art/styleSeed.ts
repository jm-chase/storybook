import { promises as fs } from "node:fs";
import path from "node:path";
import type { HouseStyle } from "./types";

// Locked style seeds (D-020 refinement 1): a curated "style plate" per house
// style, checked in under assets/styleSeeds/ and passed as a STYLE-ONLY
// reference on every generation. Style stops depending on prompt text alone —
// the drift we saw in the R-1 spike (1/6 scenes) is what this closes.
// Missing seed ⇒ null ⇒ generation proceeds prompt-only (graceful).

export interface StyleSeed {
  base64: string;
  mimeType: string;
}

const SEED_DIR = () => path.join(process.cwd(), "assets", "styleSeeds");

const cache = new Map<string, StyleSeed | null>();

async function loadSeed(styleId: string, file: string | undefined): Promise<StyleSeed | null> {
  if (!file) return null;
  const key = `${styleId}:${file}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let seed: StyleSeed | null = null;
  try {
    const bytes = await fs.readFile(path.join(SEED_DIR(), file));
    seed = { base64: bytes.toString("base64"), mimeType: "image/jpeg" };
  } catch {
    seed = null;
  }
  cache.set(key, seed);
  return seed;
}

/** The style plate (seedRefs[0]) — palette/linework/texture reference. */
export async function getStyleSeed(style: HouseStyle): Promise<StyleSeed | null> {
  return loadSeed(style.id, style.seedRefs[0]);
}

/** The element-vocabulary sheet (seedRefs[1]) — how this style draws sky,
 * clouds, sun, trees, grass, bushes, flowers, rocks, and water. */
export async function getElementSheet(style: HouseStyle): Promise<StyleSeed | null> {
  return loadSeed(style.id, style.seedRefs[1]);
}
