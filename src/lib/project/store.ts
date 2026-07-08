import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Project, ProjectSummary } from "./types";
import { summarize } from "./types";
import { getLocalUserId } from "../auth/user";

// Filesystem project store (R-6). Server-side only. Layout (tenant-shaped for
// B-8 — one directory per user, "local" until accounts exist):
//
//   projects/<userId>/<projectId>/project.json  — the Project document
//   projects/<userId>/<projectId>/images/<file> — locked reference images
//
// The root is a parameter (defaulting to the local user's directory) so tests
// run against a scratch dir and hosted builds pass userRoot(<session user>).
// All ids/filenames pass a strict allowlist before touching the filesystem —
// no caller-supplied path segments.

/** A user's project root — hosted routes pass userRoot(await getCurrentUserId()). */
export function userRoot(userId: string): string {
  assertSafeId(userId, "user id");
  return path.join(process.cwd(), "projects", userId);
}

const DEFAULT_ROOT = () => userRoot(getLocalUserId());

const SAFE_ID = /^[a-z0-9-]+$/;
const SAFE_FILENAME = /^[a-z0-9][a-z0-9.-]*$/;

function assertSafeId(id: string, what: string): void {
  if (!SAFE_ID.test(id)) throw new Error(`unsafe ${what}: ${JSON.stringify(id)}`);
}

function assertSafeFilename(name: string, what: string): void {
  if (!SAFE_FILENAME.test(name) || name.includes("..")) {
    throw new Error(`unsafe ${what}: ${JSON.stringify(name)}`);
  }
}

function projectDir(root: string, id: string): string {
  assertSafeId(id, "project id");
  return path.join(root, id);
}

export function newId(): string {
  return randomUUID();
}

export async function createProject(
  input: { title: string; styleId: string },
  root: string = DEFAULT_ROOT()
): Promise<Project> {
  const now = new Date().toISOString();
  const project: Project = {
    id: newId(),
    title: input.title,
    styleId: input.styleId,
    cast: [],
    environments: [],
    storyboard: [],
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };
  await fs.mkdir(path.join(projectDir(root, project.id), "images"), { recursive: true });
  await writeProjectFile(root, project);
  return project;
}

export async function getProject(id: string, root: string = DEFAULT_ROOT()): Promise<Project | null> {
  try {
    const raw = await fs.readFile(path.join(projectDir(root, id), "project.json"), "utf8");
    const project = JSON.parse(raw) as Project;
    // Documents written before these fields existed lack them — normalize.
    project.storyboard ??= [];
    project.environments ??= [];
    return project;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

/** Persist the project (bumps updatedAt). Returns the saved document. */
export async function saveProject(project: Project, root: string = DEFAULT_ROOT()): Promise<Project> {
  const saved: Project = { ...project, updatedAt: new Date().toISOString() };
  await writeProjectFile(root, saved);
  return saved;
}

export async function listProjects(root: string = DEFAULT_ROOT()): Promise<ProjectSummary[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(root);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
  const summaries: ProjectSummary[] = [];
  for (const id of entries) {
    if (!SAFE_ID.test(id)) continue;
    const p = await getProject(id, root);
    if (p) summaries.push(summarize(p));
  }
  // Most recently touched first — the picker's natural order.
  summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return summaries;
}

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

async function saveImage(
  projectId: string,
  stem: string,
  base64: string,
  mimeType: string,
  root: string
): Promise<string> {
  assertSafeId(stem, "image stem");
  const ext = EXT_BY_MIME[mimeType];
  if (!ext) throw new Error(`unsupported image mime type: ${mimeType}`);
  const file = `${stem}.${ext}`;
  const dir = path.join(projectDir(root, projectId), "images");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, file), Buffer.from(base64, "base64"));
  return file;
}

/** Write a cast member's locked reference image; returns the stored filename. */
export async function saveCastImage(
  projectId: string,
  castId: string,
  base64: string,
  mimeType: string,
  root: string = DEFAULT_ROOT()
): Promise<string> {
  assertSafeId(castId, "cast id");
  return saveImage(projectId, `cast-${castId}`, base64, mimeType, root);
}

/** Write an environment's locked reference image; returns the stored filename. */
export async function saveEnvironmentImage(
  projectId: string,
  envId: string,
  base64: string,
  mimeType: string,
  root: string = DEFAULT_ROOT()
): Promise<string> {
  assertSafeId(envId, "environment id");
  return saveImage(projectId, `env-${envId}`, base64, mimeType, root);
}

/** Write a beat's locked page art; returns the stored filename. */
export async function saveBeatImage(
  projectId: string,
  beatId: string,
  base64: string,
  mimeType: string,
  root: string = DEFAULT_ROOT()
): Promise<string> {
  assertSafeId(beatId, "beat id");
  return saveImage(projectId, `beat-${beatId}`, base64, mimeType, root);
}

/** Copy stored images between projects (series: locked refs carry over 1:1). */
export async function copyImages(
  srcProjectId: string,
  destProjectId: string,
  files: string[],
  root: string = DEFAULT_ROOT()
): Promise<void> {
  for (const file of files) {
    assertSafeFilename(file, "image filename");
    await fs.copyFile(
      path.join(projectDir(root, srcProjectId), "images", file),
      path.join(projectDir(root, destProjectId), "images", file)
    );
  }
}

export async function readImage(
  projectId: string,
  file: string,
  root: string = DEFAULT_ROOT()
): Promise<{ bytes: Buffer; mimeType: string } | null> {
  assertSafeFilename(file, "image filename");
  const ext = file.split(".").pop() ?? "";
  const mimeType = MIME_BY_EXT[ext];
  if (!mimeType) return null;
  try {
    const bytes = await fs.readFile(path.join(projectDir(root, projectId), "images", file));
    return { bytes, mimeType };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

async function writeProjectFile(root: string, project: Project): Promise<void> {
  const dir = projectDir(root, project.id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "project.json"), JSON.stringify(project, null, 2), "utf8");
}

/**
 * Persist a book-level continuity report (audit log — one JSON file per run,
 * newest discoverable by name). Returns the stored filename.
 */
export async function saveContinuityReport(
  projectId: string,
  report: unknown,
  root: string = DEFAULT_ROOT()
): Promise<string> {
  const dir = path.join(projectDir(root, projectId), "continuity");
  await fs.mkdir(dir, { recursive: true });
  const file = `${Date.now()}.json`;
  await fs.writeFile(path.join(dir, file), JSON.stringify(report, null, 2), "utf8");
  return file;
}
