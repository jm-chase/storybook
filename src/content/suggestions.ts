import type { CastRole } from "../lib/project/types";

// R-7 scaffolding: the product's promise is helping parents who can't
// verbalize craft — a blank textarea breaks that promise. These are curated
// "try one" starters: clicking fills the box, the parent edits from there.
// They only appear while the box is empty. Authored content — keep the voice
// concrete and visual (the model draws what's written).

export const CHARACTER_HINT =
  "Good descriptions name age or size, hair or fur, eye colour, and one signature item they always have.";

export const CHARACTER_CHIPS: Record<CastRole, string[]> = {
  hero: [
    "a blond-haired, spunky, brown-eyed 4-year-old boy in a green hoodie",
    "a curious little girl with springy black curls, red glasses, and a yellow satchel",
    "a small brave mouse in a paper sailor hat",
  ],
  sidekick: [
    "a cheerful baby African elephant with big friendly eyes",
    "a scruffy little terrier with one ear that never sits still",
    "a round hedgehog who carries a tiny lantern everywhere",
  ],
  adversary: [
    "a grumpy troll with wild orange hair, a mossy green cloak, and a gnarled staff",
    "a sly silver fox with a too-smooth smile and a velvet scarf",
    "a small storm cloud with a frowny face that follows people around",
  ],
  friend: [
    "a gap-toothed best friend with freckles and a striped beanie",
    "a gentle old lighthouse keeper with a white beard and a heavy peacoat",
    "a shy girl with a long braid who knows everything about bugs",
  ],
};

export interface SettingChip {
  name: string;
  description: string;
}

export const SETTING_CHIPS: SettingChip[] = [
  {
    name: "the old stone bridge",
    description: "an arched grey stone bridge over a slow stream, mossy stones, wooded banks",
  },
  {
    name: "a cozy attic bedroom",
    description: "a snug attic bedroom with a round window, sloped ceiling, fairy lights, and a patchwork quilt",
  },
  {
    name: "the whispering forest",
    description: "a sunlit forest clearing with tall silver birches, deep ferns, and drifting golden pollen light",
  },
];

/** Scene starters built from the names actually in this beat (or book). */
export function sceneChips(castNames: string[]): string[] {
  const [a, b] = castNames;
  if (!a) {
    return [
      "a quiet establishing view as the sun comes up",
      "rain beginning to fall on an empty winding path",
    ];
  }
  const chips = [
    `${a} tries something new and it goes wrong in a funny way`,
    `${a} takes one brave step forward at dusk`,
  ];
  if (b) {
    chips.push(
      `${a} and ${b} meet for the very first time`,
      `${a} and ${b} share something small and quiet as the sun sets`
    );
  }
  return chips;
}
