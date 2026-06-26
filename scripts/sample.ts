// Print a sample rendered story to stdout — no API key needed.
// Usage: node --import tsx scripts/sample.ts
import { renderStory } from "../src/lib/skeleton/render";
import { theBigNewThing } from "../src/content/skeletons/theBigNewThing";
import { CATALOG } from "../src/content/motifs";

const result = renderStory(theBigNewThing, CATALOG, {
  emotionId: "nervous",
  feelingId: "brave",
  environmentId: "big-school",
  lessonId: "small-steps",
  sidekickId: "little-fox",
  personalization: { heroName: "Mia", sidekickName: "Pip", detail: "a red scarf" },
});

if (!result.ok) {
  console.error("Render failed:", result.errors);
  process.exit(1);
}

console.log(`\n# ${result.story.title}\n`);
result.story.pages.forEach((page, i) => {
  console.log(`— Page ${i + 1} —`);
  console.log(page + "\n");
});
