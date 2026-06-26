import { test } from "node:test";
import assert from "node:assert/strict";

import { renderStory, type StorySelection } from "./render";
import { theBigNewThing } from "../../content/skeletons/theBigNewThing";
import { CATALOG } from "../../content/motifs";

const baseSelection: StorySelection = {
  emotionId: "nervous",
  feelingId: "brave",
  environmentId: "big-school",
  lessonId: "small-steps",
  sidekickId: "little-fox",
  personalization: { heroName: "Mia", sidekickName: "Pip", detail: "a red scarf" },
};

test("renders a complete story with all slots filled", () => {
  const result = renderStory(theBigNewThing, CATALOG, baseSelection);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.story.title, "Mia and the Big New Thing");
  assert.equal(result.story.pages.length, theBigNewThing.beats.length);
  // No unfilled slots anywhere.
  for (const page of result.story.pages) {
    assert.doesNotMatch(page, /\{\w+\}/, `unfilled slot in: ${page}`);
  }
});

test("weaves personalization and motif words into the prose", () => {
  const result = renderStory(theBigNewThing, CATALOG, baseSelection);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const text = result.story.pages.join("\n");
  assert.match(text, /Mia/);
  assert.match(text, /Pip/);
  assert.match(text, /a red scarf/);
  assert.match(text, /felt nervous/); // opening emotion
  assert.match(text, /feel brave/); // closing feeling
  assert.match(text, /tall blue doors/); // environment phrase
});

test("nested lesson fragment expands its own slots (two-pass substitution)", () => {
  const result = renderStory(theBigNewThing, CATALOG, {
    ...baseSelection,
    lessonId: "everyone-wobbles", // fragment contains {sidekickLabel}
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const text = result.story.pages.join("\n");
  assert.match(text, /Even a little fox/);
  assert.doesNotMatch(text, /\{sidekickLabel\}/);
});

test("rejects a motif id not allowed by the skeleton", () => {
  const result = renderStory(theBigNewThing, CATALOG, {
    ...baseSelection,
    emotionId: "furious", // not in the catalog
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.errors[0], /Invalid emotions/);
});

test("rejects missing required personalization", () => {
  const result = renderStory(theBigNewThing, CATALOG, {
    ...baseSelection,
    personalization: { heroName: "Mia", sidekickName: "Pip" }, // detail missing
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.errors[0], /detail/);
});

test("every catalog combination renders cleanly (no template/catalog drift)", () => {
  let count = 0;
  for (const emotionId of theBigNewThing.motifs.emotions)
    for (const feelingId of theBigNewThing.motifs.feelings)
      for (const environmentId of theBigNewThing.motifs.environments)
        for (const lessonId of theBigNewThing.motifs.lessons)
          for (const sidekickId of theBigNewThing.motifs.sidekicks) {
            const result = renderStory(theBigNewThing, CATALOG, {
              emotionId,
              feelingId,
              environmentId,
              lessonId,
              sidekickId,
              personalization: {
                heroName: "Mia",
                sidekickName: "Pip",
                detail: "a red scarf",
              },
            });
            assert.equal(result.ok, true, `failed: ${emotionId}/${lessonId}`);
            count++;
          }
  // 6 × 6 × 6 × 6 × 6 = 7776 combinations, all clean.
  assert.equal(count, 7776);
});
