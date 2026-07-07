import type { HouseStyle } from "../lib/art/types";

// Our own house styles (D-016). Each `promptFragment` is OUR attribute
// vocabulary — never a third-party name. `seedRefs` names a curated style
// plate under assets/styleSeeds/, passed as a style-only reference on every
// generation (D-020 refinement 1). Names/blurbs are tunable.

export const HOUSE_STYLES: HouseStyle[] = [
  {
    id: "painted-wonder",
    name: "Painted Wonder",
    blurb: "Soft watercolor, warm light, gentle and tender.",
    promptFragment:
      "soft hand-painted watercolor, gentle rounded characters, luminous natural light, lush atmospheric backgrounds, warm and tender mood",
    swatches: ["#aac6c2", "#e7cfa6", "#cf9f7a", "#7d9a8f"],
    seedRefs: ["painted-wonder.jpg"],
  },
  {
    id: "storybook-ink",
    name: "Storybook Ink",
    blurb: "Crosshatch ink, earthy and a little wild.",
    promptFragment:
      "textured crosshatch ink linework, earthy muted palette, expressive characterful creatures, hand-drawn warmth, a slightly wild energy",
    swatches: ["#6f5b43", "#9c8a5e", "#3f4a3a", "#c0a87f"],
    seedRefs: ["storybook-ink.jpg"],
  },
  {
    id: "torn-and-bright",
    name: "Torn & Bright",
    blurb: "Cut-paper collage, bold and tactile.",
    promptFragment:
      "torn tissue-paper collage texture, bold saturated color blocks, simple iconic shapes, a tactile handmade feel",
    swatches: ["#e4572e", "#f3a712", "#2a9d8f", "#3d348b"],
    seedRefs: ["torn-and-bright.jpg"],
  },
  {
    id: "bright-and-round",
    name: "Bright & Round",
    blurb: "Clean flat vector, cheerful and friendly.",
    promptFragment:
      "clean flat vector shapes, big expressive eyes, cheerful saturated palette, friendly rounded forms, a modern picture-book look",
    swatches: ["#ff8c42", "#ffd166", "#06d6a0", "#118ab2"],
    seedRefs: ["bright-and-round.jpg"],
  },
  {
    id: "wobbly-world",
    name: "Wobbly World",
    blurb: "Loose wobbly line, playful and comedic.",
    promptFragment:
      "loose wobbly hand-drawn line, playful impossible shapes, a punchy limited palette, rhythmic and comedic energy",
    swatches: ["#ef476f", "#ffd166", "#06d6a0", "#073b4c"],
    seedRefs: ["wobbly-world.jpg"],
  },
];

export const HOUSE_STYLE_BY_ID: Record<string, HouseStyle> = Object.fromEntries(
  HOUSE_STYLES.map((s) => [s.id, s])
);
