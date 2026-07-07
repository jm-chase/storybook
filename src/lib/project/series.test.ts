import { test } from "node:test";
import assert from "node:assert/strict";
import { cloneForSeries } from "./series";
import type { Project } from "./types";

const source: Project = {
  id: "p1",
  title: "Book One",
  styleId: "painted-wonder",
  cast: [
    { id: "h1", role: "hero", name: "Mia", description: "a girl", locked: { file: "cast-h1.png", mimeType: "image/png", lockedAt: "2026-07-07T00:00:00.000Z" } },
    { id: "s1", role: "sidekick", name: "Tembo", description: "an elephant" }, // unlocked — copies without an image
  ],
  environments: [
    { id: "e1", name: "the bridge", description: "a stone bridge", locked: { file: "env-e1.png", mimeType: "image/png", lockedAt: "2026-07-07T00:00:00.000Z" } },
  ],
  storyboard: [
    { id: "b1", sceneDescription: "x", text: "y", castIds: ["h1"], art: { file: "beat-b1.png", mimeType: "image/png", lockedAt: "2026-07-07T00:00:00.000Z" } },
  ],
  createdAt: "2026-07-07T00:00:00.000Z",
  updatedAt: "2026-07-07T00:00:00.000Z",
  schemaVersion: 1,
};

test("clones cast + settings with locks, lists only reference images (no beat art)", () => {
  const clone = cloneForSeries(source);
  assert.equal(clone.cast.length, 2);
  assert.equal(clone.cast[0].locked?.file, "cast-h1.png");
  assert.equal(clone.cast[1].locked, undefined);
  assert.equal(clone.environments[0].locked?.file, "env-e1.png");
  assert.deepEqual(clone.imageFiles.sort(), ["cast-h1.png", "env-e1.png"]);
});

test("clone is deep — mutating it leaves the source untouched", () => {
  const clone = cloneForSeries(source);
  clone.cast[0].name = "Changed";
  clone.cast[0].locked!.file = "changed.png";
  clone.environments[0].description = "changed";
  assert.equal(source.cast[0].name, "Mia");
  assert.equal(source.cast[0].locked?.file, "cast-h1.png");
  assert.equal(source.environments[0].description, "a stone bridge");
});
