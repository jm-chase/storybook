import type { Skeleton } from "../../lib/skeleton/types";
import { CATALOG } from "../motifs";

// "The Big New Thing" — ages 3–5, an emotional-arc skeleton about facing a new,
// uncertain experience. Fixed 6-beat procedural structure; motifs steer the
// content within it: opening emotion → closing feeling is the arc, the lesson is
// embodied at beat 4, the environment supplies the place, the sidekick is the
// companion. Short sentences, a repeated refrain ("A big new thing"), low stakes.
//
// REF-FREE DRAFT (2026-06-25): written without the reference-text craft analysis,
// at James's request, to baseline unguided output quality. The `tradition` field
// is a self-described placeholder to be revisited once STORY_CRAFT_NOTES exists.

export const theBigNewThing: Skeleton = {
  id: "the-big-new-thing",
  title: "{heroName} and the Big New Thing",
  ageBand: "3-5",
  theme: "facing something new and uncertain",
  tradition:
    "procedural emotional-arc (self-described, ref-free) — short predictable sentences, a repeated refrain, low-stakes threshold conflict, implicit lesson",

  beats: [
    // 1 — Ordinary world + opening emotion + refrain established
    "This morning, {heroName} woke up early. Today was the day of something big and new at {envOpening}. {heroName} felt {emotion}. Close by sat {sidekickName}, a {sidekickLabel} who went everywhere with {heroName}. “A big new thing,” whispered {heroName}. “A big new thing,” whispered {sidekickName}.",

    // 2 — The approach; emotion intensifies; comfort object introduced; refrain
    "Step by step, the two of them set off toward the big new thing. The closer they came, the more {heroName} felt {emotion}. {heroName} reached for {detail} and held it tight. “A big new thing,” they said together, soft and slow.",

    // 3 — The wobble at the threshold (low stakes)
    "At the very edge, {heroName} stopped. {heroName}'s feet did not want to move. It looked so big. It looked so new. {heroName} squeezed {detail} and took one deep, slow breath.",

    // 4 — The little step; the lesson, embodied implicitly
    "{lessonTurn} So {heroName} took one small step. Just one. {sidekickName} took one small step too.",

    // 5 — The turn; the feeling begins to replace the emotion
    "And do you know what happened? The big new thing said hello. It was not so scary after all. Little by little, {heroName} began to feel {feeling}.",

    // 6 — Resolution; feeling established; refrain echoed and resolved
    "By the time the day was done, the big new thing was not new anymore. It was {heroName}'s thing now. {heroName} felt {feeling} the whole way home, with {sidekickName} on one side and {detail} held safe. “Not so big after all,” smiled {heroName}.",
  ],

  personalization: [
    { name: "heroName", kind: "name", required: true, label: "Child's name" },
    { name: "sidekickName", kind: "name", required: true, label: "Sidekick's name" },
    {
      name: "detail",
      kind: "shortDetail",
      required: true,
      label: "A special thing they bring (e.g. a red scarf)",
    },
  ],

  // This skeleton accepts every catalog option in each dimension.
  motifs: {
    emotions: Object.keys(CATALOG.emotions),
    feelings: Object.keys(CATALOG.feelings),
    environments: Object.keys(CATALOG.environments),
    lessons: Object.keys(CATALOG.lessons),
    sidekicks: Object.keys(CATALOG.sidekicks),
  },
};
