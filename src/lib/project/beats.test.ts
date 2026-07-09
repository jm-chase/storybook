import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBeatInput, MAX_SCENE_DESCRIPTION, MAX_PAGE_TEXT } from "./beats";
import type { Project } from "./types";

const project: Project = {
  id: "p1",
  title: "T",
  styleId: "painted-wonder",
  cast: [
    { id: "hero-1", role: "hero", name: "Mia", description: "a girl" },
    { id: "troll-1", role: "adversary", name: "Grum", description: "a troll" },
  ],
  environments: [{ id: "env-1", name: "the old stone bridge", description: "an arched stone bridge over a stream" }],
  storyboard: [],
  createdAt: "2026-07-06T00:00:00.000Z",
  updatedAt: "2026-07-06T00:00:00.000Z",
  schemaVersion: 1,
};

test("valid beat passes, whitespace collapsed, castIds deduped", () => {
  const r = validateBeatInput(
    { sceneDescription: "  Mia meets   the troll on the bridge ", text: " Hello. ", castIds: ["hero-1", "troll-1", "hero-1"] },
    project
  );
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.sceneDescription, "Mia meets the troll on the bridge");
    assert.equal(r.value.text, "Hello.");
    assert.deepEqual(r.value.castIds, ["hero-1", "troll-1"]);
  }
});

test("empty page text is allowed (wordless pages)", () => {
  const r = validateBeatInput({ sceneDescription: "a quiet forest", text: "", castIds: [] }, project);
  assert.ok(r.ok);
});

test("missing scene description fails", () => {
  const r = validateBeatInput({ sceneDescription: "   ", text: "x", castIds: [] }, project);
  assert.ok(!r.ok);
  if (!r.ok) assert.match(r.errors.sceneDescription, /Describe/);
});

test("over-length fields fail", () => {
  const r1 = validateBeatInput({ sceneDescription: "x".repeat(MAX_SCENE_DESCRIPTION + 1), text: "", castIds: [] }, project);
  assert.ok(!r1.ok);
  const r2 = validateBeatInput({ sceneDescription: "ok", text: "x".repeat(MAX_PAGE_TEXT + 1), castIds: [] }, project);
  assert.ok(!r2.ok);
});

test("unknown cast id fails", () => {
  const r = validateBeatInput({ sceneDescription: "ok", text: "", castIds: ["nobody"] }, project);
  assert.ok(!r.ok);
  if (!r.ok) assert.match(r.errors.castIds, /isn't in this book's cast/);
});

test("non-array castIds fails", () => {
  const r = validateBeatInput({ sceneDescription: "ok", text: "", castIds: "hero-1" }, project);
  assert.ok(!r.ok);
});

test("environmentId: known passes, unknown fails, empty means none", () => {
  const ok = validateBeatInput({ sceneDescription: "ok", text: "", castIds: [], environmentId: "env-1" }, project);
  assert.ok(ok.ok);
  if (ok.ok) assert.equal(ok.value.environmentId, "env-1");
  const none = validateBeatInput({ sceneDescription: "ok", text: "", castIds: [], environmentId: "" }, project);
  assert.ok(none.ok);
  if (none.ok) assert.equal(none.value.environmentId, undefined);
  const bad = validateBeatInput({ sceneDescription: "ok", text: "", castIds: [], environmentId: "nowhere" }, project);
  assert.ok(!bad.ok);
});

test("reorderStoryboard: valid permutation reorders; bad inputs rejected", async () => {
  const { reorderStoryboard } = await import("./beats");
  const mk = () => ({
    ...project,
    storyboard: [
      { id: "b1", sceneDescription: "one", text: "", castIds: [] },
      { id: "b2", sceneDescription: "two", text: "", castIds: [] },
      { id: "b3", sceneDescription: "three", text: "", castIds: [] },
    ],
  });
  const p = mk();
  assert.ok(reorderStoryboard(p, ["b3", "b1", "b2"]).ok);
  assert.deepEqual(p.storyboard.map((b) => b.id), ["b3", "b1", "b2"]);

  assert.ok(!reorderStoryboard(mk(), ["b1", "b2"]).ok, "missing id must fail");
  assert.ok(!reorderStoryboard(mk(), ["b1", "b2", "b2"]).ok, "duplicate must fail");
  assert.ok(!reorderStoryboard(mk(), ["b1", "b2", "bX"]).ok, "unknown id must fail");
  assert.ok(!reorderStoryboard(mk(), "b1").ok, "non-array must fail");
});
