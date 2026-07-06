import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  createProject,
  getProject,
  saveProject,
  listProjects,
  saveCastImage,
  readImage,
  newId,
} from "./store";
import type { CastMember } from "./types";

// 1×1 transparent PNG.
const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

async function scratchRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "storybook-store-"));
}

test("create → get round-trips the project document", async () => {
  const root = await scratchRoot();
  const created = await createProject({ title: "Mia's Big Day", styleId: "painted-wonder" }, root);
  const fetched = await getProject(created.id, root);
  assert.deepEqual(fetched, created);
  assert.equal(fetched?.schemaVersion, 1);
  assert.deepEqual(fetched?.cast, []);
});

test("saveProject persists cast mutations and bumps updatedAt", async () => {
  const root = await scratchRoot();
  const p = await createProject({ title: "T", styleId: "painted-wonder" }, root);
  const member: CastMember = {
    id: newId(),
    role: "hero",
    name: "Mia",
    description: "a blond-haired, spunky 4-year-old girl",
  };
  const saved = await saveProject({ ...p, cast: [member] }, root);
  const fetched = await getProject(p.id, root);
  assert.equal(fetched?.cast.length, 1);
  assert.equal(fetched?.cast[0].role, "hero");
  assert.ok(saved.updatedAt >= p.updatedAt);
});

test("getProject returns null for unknown id", async () => {
  const root = await scratchRoot();
  assert.equal(await getProject(newId(), root), null);
});

test("listProjects returns summaries, most recent first", async () => {
  const root = await scratchRoot();
  const a = await createProject({ title: "A", styleId: "s" }, root);
  const b = await createProject({ title: "B", styleId: "s" }, root);
  // Touch A so it becomes most recent.
  await new Promise((r) => setTimeout(r, 5));
  await saveProject(a, root);
  const list = await listProjects(root);
  assert.equal(list.length, 2);
  assert.equal(list[0].id, a.id);
  assert.equal(list[1].id, b.id);
  assert.equal(list[0].castCount, 0);
  assert.equal(list[0].lockedCount, 0);
  void b;
});

test("cast image save → read round-trips bytes + mime", async () => {
  const root = await scratchRoot();
  const p = await createProject({ title: "T", styleId: "s" }, root);
  const castId = newId();
  const file = await saveCastImage(p.id, castId, TINY_PNG_B64, "image/png", root);
  assert.equal(file, `cast-${castId}.png`);
  const img = await readImage(p.id, file, root);
  assert.ok(img);
  assert.equal(img?.mimeType, "image/png");
  assert.equal(img?.bytes.toString("base64"), TINY_PNG_B64);
});

test("unsafe ids and filenames are rejected (no path traversal)", async () => {
  const root = await scratchRoot();
  await assert.rejects(() => getProject("../evil", root), /unsafe project id/);
  const p = await createProject({ title: "T", styleId: "s" }, root);
  await assert.rejects(() => saveCastImage(p.id, "../evil", TINY_PNG_B64, "image/png", root), /unsafe cast id/);
  await assert.rejects(() => readImage(p.id, "..%2Fproject.json", root), /unsafe image filename/);
  await assert.rejects(() => saveCastImage(p.id, newId(), TINY_PNG_B64, "image/gif", root), /unsupported image mime/);
});
