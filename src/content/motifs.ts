import type { MotifCatalog } from "../lib/skeleton/types";

// Curated motif catalog (ages 3–5). These are SELECTIONS, not free text — that's
// what keeps the no-freeform-box safety rule intact while still giving lots of
// expressive combinations. Values are written to read naturally in the beat
// templates and to stay gentle and age-appropriate.

export const CATALOG: MotifCatalog = {
  // Opening emotions — the gentle "wobble" the hero starts with. All fit "felt ___".
  emotions: {
    nervous: { id: "nervous", word: "nervous" },
    shy: { id: "shy", word: "shy" },
    worried: { id: "worried", word: "worried" },
    unsure: { id: "unsure", word: "unsure" },
    jittery: { id: "jittery", word: "jittery" },
    small: { id: "small", word: "small" },
  },

  // Closing feelings — the "earned" feeling that replaces the emotion. All fit "felt ___".
  feelings: {
    brave: { id: "brave", word: "brave" },
    proud: { id: "proud", word: "proud" },
    calm: { id: "calm", word: "calm" },
    happy: { id: "happy", word: "happy" },
    strong: { id: "strong", word: "strong" },
    ready: { id: "ready", word: "ready" },
  },

  // Environments — each carries an authored opening phrase + an illustration scene tag.
  environments: {
    "big-school": {
      id: "big-school",
      label: "the big school",
      openingPhrase: "the big school with its tall blue doors",
      sceneTag: "school",
    },
    "deep-wood": {
      id: "deep-wood",
      label: "the deep wood",
      openingPhrase: "the deep wood where the tall trees whisper",
      sceneTag: "wood",
    },
    seaside: {
      id: "seaside",
      label: "the seaside",
      openingPhrase: "the seaside where the cold waves roll in",
      sceneTag: "seaside",
    },
    "snowy-hills": {
      id: "snowy-hills",
      label: "the snowy hills",
      openingPhrase: "the snowy hills, white and hushed",
      sceneTag: "snow",
    },
    "new-house": {
      id: "new-house",
      label: "the new house",
      openingPhrase: "the new house with all its big empty rooms",
      sceneTag: "house",
    },
    "night-garden": {
      id: "night-garden",
      label: "the night garden",
      openingPhrase: "the night garden under the very first stars",
      sceneTag: "night-garden",
    },
  },

  // Lessons — embodied implicitly at the turn beat, never stated as "the moral is...".
  lessons: {
    "ask-for-help": {
      id: "ask-for-help",
      label: "it's okay to ask for help",
      turnFragment:
        "“Will you help me?” {heroName} asked {sidekickName}. Asking made the bigness feel smaller.",
    },
    "trying-is-brave": {
      id: "trying-is-brave",
      label: "trying is brave, even when it's hard",
      turnFragment:
        "Trying felt wobbly. But wobbly is just brave that has not happened yet.",
    },
    "new-becomes-favourite": {
      id: "new-becomes-favourite",
      label: "new things can become favourite things",
      turnFragment:
        "Maybe, thought {heroName}, the newest things can turn into the favourite things.",
    },
    "everyone-wobbles": {
      id: "everyone-wobbles",
      label: "everyone feels wobbly sometimes",
      turnFragment:
        "Everyone feels wobbly at the edge of something big. Even grown-ups. Even a {sidekickLabel}.",
    },
    "small-steps": {
      id: "small-steps",
      label: "small steps add up",
      turnFragment:
        "{heroName} remembered: nobody has to do it all at once. Just one small step, and then another.",
    },
    "being-kind": {
      id: "being-kind",
      label: "being kind makes things easier",
      turnFragment:
        "{heroName} gave {sidekickName} a gentle squeeze. A little kindness made the bigness softer.",
    },
  },

  // Sidekicks — the companion's kind. The parent names it via the sidekickName slot. All fit "a ___".
  sidekicks: {
    "little-fox": { id: "little-fox", label: "little fox" },
    "brave-bear": { id: "brave-bear", label: "brave bear" },
    "small-owl": { id: "small-owl", label: "small owl" },
    "sleepy-cat": { id: "sleepy-cat", label: "sleepy cat" },
    "bright-bird": { id: "bright-bird", label: "bright bird" },
    "soft-rabbit": { id: "soft-rabbit", label: "soft rabbit" },
  },
};
