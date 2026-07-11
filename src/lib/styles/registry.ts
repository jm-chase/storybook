import { promises as fs } from "node:fs";
import path from "node:path";
import { HOUSE_STYLES, HOUSE_STYLE_BY_ID } from "../../content/houseStyles";
import { getLocalUserId } from "../auth/user";
import type { HouseStyle } from "../art/types";

// Style registry (2026-07-11): styles are no longer a hardcoded list. The five
// built-in house styles remain in content/houseStyles.ts; CUSTOM styles —
// minted from a user's own reference images — live on disk under the user's
// styles store and are merged in here. Every style consumer resolves through
// getStyleById / listStyles.
//
// Custom style layout: projects/<user>/styles/<styleId>/
//   style.json   — HouseStyle document (seedDir omitted; computed on load)
//   seed.jpg     — the style plate (seedRefs[0])
//   elements.jpg — the element vocabulary sheet (seedRefs[1])
//   ref-<n>.jpg  — the user's uploaded reference images (kept for the gallery)

const SAFE_ID = /^[a-z0-9-]+$/;

export function stylesDir(userId: string = getLocalUserId()): string {
  return path.join(process.cwd(), "projects", userId, "styles");
}

function styleDir(styleId: string, userId?: string): string {
  if (!SAFE_ID.test(styleId)) throw new Error(`unsafe style id: ${JSON.stringify(styleId)}`);
  return path.join(stylesDir(userId), styleId);
}

async function loadCustomStyle(styleId: string): Promise<HouseStyle | null> {
  if (!SAFE_ID.test(styleId)) return null;
  try {
    const raw = await fs.readFile(path.join(styleDir(styleId), "style.json"), "utf8");
    const doc = JSON.parse(raw) as HouseStyle;
    return { ...doc, id: styleId, custom: true, seedDir: styleDir(styleId) };
  } catch {
    return null;
  }
}

/** Resolve any style id — built-in or custom. */
export async function getStyleById(id: string): Promise<HouseStyle | null> {
  return HOUSE_STYLE_BY_ID[id] ?? (await loadCustomStyle(id));
}

/** All styles: built-ins first, then the user's custom styles. */
export async function listStyles(): Promise<HouseStyle[]> {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(stylesDir());
  } catch {
    /* no custom styles yet */
  }
  const customs: HouseStyle[] = [];
  for (const id of entries.filter((e) => SAFE_ID.test(e))) {
    const s = await loadCustomStyle(id);
    if (s) customs.push(s);
  }
  return [...HOUSE_STYLES, ...customs];
}

export async function isValidStyleId(id: unknown): Promise<boolean> {
  return typeof id === "string" && (await getStyleById(id)) !== null;
}

/** Persist a newly-minted custom style (files already written by the caller). */
export async function saveCustomStyle(style: HouseStyle): Promise<void> {
  const dir = styleDir(style.id);
  await fs.mkdir(dir, { recursive: true });
  const { seedDir: _drop, custom: _drop2, ...doc } = style;
  await fs.writeFile(path.join(dir, "style.json"), JSON.stringify(doc, null, 2), "utf8");
}

/** Write a file into a custom style's directory (seed/elements/refs). */
export async function writeStyleFile(styleId: string, file: string, bytes: Buffer): Promise<void> {
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(file)) throw new Error(`unsafe style filename: ${file}`);
  const dir = styleDir(styleId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, file), bytes);
}

/** Read a style asset (custom dir, or built-in assets/styleSeeds). */
export async function readStyleAsset(styleId: string, file: string): Promise<Buffer | null> {
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(file)) return null;
  const style = await getStyleById(styleId);
  if (!style) return null;
  const dir = style.seedDir ?? path.join(process.cwd(), "assets", "styleSeeds");
  try {
    return await fs.readFile(path.join(dir, file));
  } catch {
    return null;
  }
}
