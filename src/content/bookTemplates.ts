import type { CastRole } from "../lib/project/types";

// Book templates — skin 2 of D-023 (classics & occasions). A template is a
// prefilled project: cast + storyboard, ready to lock and illustrate. The
// parent supplies only the hero (their child's name + look); everything else
// is authored. This is the near-zero-creative-burden path (answers R-7).
//
// {hero} in any text is replaced with the validated hero name at instantiation.
//
// LEGAL (D-024): classics must be PUBLIC DOMAIN — verified per title before
// adding. No third-party illustration trade dress is referenced (D-016);
// character looks are described in our own words. Verified titles:
// - Alice in Wonderland: Carroll d. 1898, published 1865 — PD worldwide.
// - Aesop's fables (Tortoise & Hare): antiquity — PD worldwide.
// - Goldilocks: traditional; Southey's telling 1837 — PD worldwide.
// - The Three Little Pigs: traditional; Jacobs' telling 1890 — PD worldwide.
// - The Wonderful Wizard of Oz: Baum d. 1919, published 1900 — PD worldwide.
//   BOOK elements only: SILVER shoes, no MGM film trade dress (ruby slippers,
//   film character likenesses are NOT public domain).

export interface TemplateCastMember {
  role: CastRole;
  /** Fixed name for authored characters; the HERO's name comes from the parent. */
  name: string;
  /** Authored default look — the parent replaces the hero's, may keep the rest. */
  description: string;
}

export interface TemplateEnvironment {
  name: string;
  description: string;
}

export interface TemplateBeat {
  sceneDescription: string;
  text: string;
  /** Names (from cast below, or "hero") appearing in this beat. */
  castNames: string[];
  /** Recurring location (from environments below) — locked once, held across pages. */
  environmentName?: string;
}

export interface BookTemplate {
  id: string;
  kind: "occasion" | "classic";
  title: string; // {hero} allowed
  blurb: string;
  defaultStyleId: string;
  /** The hero is implicit in every template — parent-named and parent-described. */
  cast: TemplateCastMember[];
  /** Recurring locations; any place appearing on 2+ pages belongs here. */
  environments?: TemplateEnvironment[];
  beats: TemplateBeat[];
}

export const BOOK_TEMPLATES: BookTemplate[] = [
  {
    id: "big-new-sibling",
    kind: "occasion",
    title: "{hero} and the Brand-New Baby",
    blurb: "For the big brother or sister to be — being big is a kind of magic.",
    defaultStyleId: "painted-wonder",
    cast: [],
    beats: [
      {
        sceneDescription: "the hero peeks over the edge of a bassinet at a tiny sleeping newborn, morning light through the window",
        text: "Someone new was home. Someone very, very small.",
        castNames: ["hero"],
      },
      {
        sceneDescription: "the hero sits cross-legged looking a little left out while grown-ups' legs crowd around the bassinet in the background",
        text: "Everyone whispered. Everyone tiptoed. Nobody had time to play.",
        castNames: ["hero"],
      },
      {
        sceneDescription: "the hero shows the baby a beloved worn teddy bear, holding it up proudly beside the crib",
        text: "“This is Bear,” said {hero}. “He was mine when I was little. Littler.”",
        castNames: ["hero"],
      },
      {
        sceneDescription: "the baby's tiny hand wraps around the hero's finger, close-up, both faces soft and calm",
        text: "The baby held on tight. And didn't let go.",
        castNames: ["hero"],
      },
      {
        sceneDescription: "the hero gently rocks the bassinet, standing tall and proud, evening light, a quiet heroic pose",
        text: "Small things need big people. And {hero} was the biggest of all.",
        castNames: ["hero"],
      },
    ],
  },
  {
    id: "first-day-of-school",
    kind: "occasion",
    title: "{hero}'s First Big Day",
    blurb: "The first-day-of-school story — brave is doing it anyway.",
    defaultStyleId: "bright-and-round",
    cast: [],
    beats: [
      {
        sceneDescription: "the hero stands at the front door wearing a backpack that looks slightly too big, morning sun, one shoe untied",
        text: "The backpack was ready. The shoes were ready. {hero} was… almost ready.",
        castNames: ["hero"],
      },
      {
        sceneDescription: "the hero pauses at the school gate, other children streaming past, the building looming large but friendly",
        text: "The school was big. The door was big. The day felt very, very big.",
        castNames: ["hero"],
      },
      {
        sceneDescription: "the hero takes one brave step through the classroom door, chin up",
        text: "One step. That's how every big day starts.",
        castNames: ["hero"],
      },
      {
        sceneDescription: "the hero and a new friend build a tall block tower together, both laughing",
        text: "By snack time, the big day had turned into a good one.",
        castNames: ["hero"],
      },
      {
        sceneDescription: "the hero runs out of the school gates at pickup, arms wide, backpack bouncing, huge smile",
        text: "“Can I go back TOMORROW?” asked {hero}.",
        castNames: ["hero"],
      },
    ],
  },
  {
    id: "down-the-rabbit-hole",
    kind: "classic",
    title: "{hero} in Wonderland",
    blurb: "Your child tumbles into the classic — alongside Alice herself. (Public domain, retold.)",
    defaultStyleId: "wobbly-world",
    cast: [
      {
        role: "friend",
        name: "Alice",
        description:
          "a curious storybook girl with neat fair hair held by a simple band, a plain blue pinafore dress over a white apron, and bright inquisitive eyes",
      },
      {
        role: "sidekick",
        name: "the White Rabbit",
        description: "a flustered white rabbit in a little waistcoat, clutching a large golden pocket watch",
      },
    ],
    beats: [
      {
        sceneDescription: "the hero and Alice sit on a riverbank under a tree on a drowsy golden afternoon as the White Rabbit dashes past checking his pocket watch",
        text: "It was the sort of afternoon where nothing ever happens. Until a rabbit ran by — with a watch.",
        castNames: ["hero", "Alice", "the White Rabbit"],
      },
      {
        sceneDescription: "the hero and Alice tumble slowly down a deep whimsical rabbit hole lined with floating teacups, books, and lanterns",
        text: "Down, down, down they fell. “Do you suppose it goes all the way through?” wondered Alice.",
        castNames: ["hero", "Alice"],
      },
      {
        sceneDescription: "the hero and Alice stand in a round hall of many tiny doors, Alice holding a little golden key, a tiny bottle labeled only with a paper tag on a glass table",
        text: "A hall of doors, a golden key, and a bottle that said DRINK ME. (They were very careful. Mostly.)",
        castNames: ["hero", "Alice"],
      },
      {
        sceneDescription: "the hero, Alice, and the White Rabbit hurry through a garden of enormous flowers, the rabbit pointing at his watch",
        text: "“Late! Late!” cried the Rabbit. Nobody knew for what. That made it more exciting.",
        castNames: ["hero", "Alice", "the White Rabbit"],
      },
      {
        sceneDescription: "the hero and Alice share a long whimsical tea party table set with mismatched teapots and cakes, warm afternoon light",
        text: "There is always room for tea in Wonderland. And always, always room for one more friend.",
        castNames: ["hero", "Alice"],
      },
      {
        sceneDescription: "the hero wakes under the riverbank tree at sunset, a white rabbit-shaped cloud in the sky, Alice's book lying open in the grass",
        text: "Was it a dream? The clouds weren't telling.",
        castNames: ["hero"],
      },
    ],
  },
  {
    id: "tortoise-and-hare",
    kind: "classic",
    title: "{hero} and the Great Race",
    blurb: "Aesop's slow-and-steady classic — with your child as the race judge. (Public domain, retold.)",
    defaultStyleId: "storybook-ink",
    cast: [
      {
        role: "friend",
        name: "Tortoise",
        description:
          "a calm old tortoise with a mossy-green domed shell, kind heavy-lidded eyes, and steady wrinkled legs",
      },
      {
        role: "sidekick",
        name: "Hare",
        description:
          "a lanky boastful brown hare with long swept-back ears, a cocky grin, and one eyebrow always raised",
      },
    ],
    beats: [
      {
        sceneDescription: "the hero holds a checkered flag between the tortoise and the hare at a chalk starting line on a country lane, animals of the meadow gathered to watch",
        text: "“A race?” laughed Hare. “Against YOU?” Tortoise just smiled. {hero} raised the flag.",
        castNames: ["hero", "Tortoise", "Hare"],
      },
      {
        sceneDescription: "the hare rockets away down the lane in a cloud of dust while the tortoise takes one slow careful step, the hero watching wide-eyed",
        text: "ZOOM went Hare. Step… went Tortoise. Step. Step. Step.",
        castNames: ["hero", "Tortoise", "Hare"],
      },
      {
        sceneDescription: "the hare naps smugly under a shady oak tree at the halfway stone, arms behind his head, one ear flopped over his eyes",
        text: "“Plenty of time,” yawned Hare. And the afternoon was warm. And the grass was soft…",
        castNames: ["Hare"],
      },
      {
        sceneDescription: "the tortoise plods past the sleeping hare without a single glance, the hero tiptoeing alongside with a finger to their lips",
        text: "Step. Step. Step. {hero} didn't say a word.",
        castNames: ["hero", "Tortoise", "Hare"],
      },
      {
        sceneDescription: "the hare wakes and sprints in a panic as the tortoise crosses the finish-line ribbon, the hero cheering with both arms up",
        text: "Hare ran faster than fast. But slow and steady had already won.",
        castNames: ["hero", "Tortoise", "Hare"],
      },
      {
        sceneDescription: "the tortoise and the hare share blackberries with the hero on the finish line in golden evening light, the checkered flag planted in the grass",
        text: "“Next time,” said Hare, “no naps.” “Next time,” said Tortoise, “more blackberries.”",
        castNames: ["hero", "Tortoise", "Hare"],
      },
    ],
  },
  {
    id: "goldilocks",
    kind: "classic",
    title: "{hero} and the Three Bears",
    blurb: "Porridge, chairs, and beds — just right, with your child along. (Public domain, retold.)",
    defaultStyleId: "painted-wonder",
    cast: [
      {
        role: "friend",
        name: "Goldilocks",
        description:
          "a small bold girl with a cloud of golden curls, rosy cheeks, a simple country dress and scuffed boots",
      },
      {
        role: "sidekick",
        name: "Little Bear",
        description: "a round-eared honey-brown bear cub with a friendly open face and a too-small red chair he loves",
      },
    ],
    beats: [
      {
        sceneDescription: "the hero and Goldilocks discover a cozy cottage deep in a sun-dappled forest, its door standing open, smoke curling from the chimney",
        text: "Deep in the woods stood a little house. The door was open. (It really shouldn't have been.)",
        castNames: ["hero", "Goldilocks"],
      },
      {
        sceneDescription: "the hero and Goldilocks stand before three steaming porridge bowls on a wooden table — a huge one, a middle one, and a tiny one",
        text: "Too hot. Too cold. And one — just right. “We should ask first,” whispered {hero}. Too late.",
        castNames: ["hero", "Goldilocks"],
      },
      {
        sceneDescription: "Goldilocks sits in a tiny broken chair looking sheepish while the hero tries to fix it, two bigger chairs standing behind",
        text: "Too hard. Too soft. And one — just… CRACK.",
        castNames: ["hero", "Goldilocks"],
      },
      {
        sceneDescription: "the hero and Goldilocks fast asleep in a small wooden bed under a patchwork quilt, moonlight through a round window",
        text: "Too high. Too lumpy. And one — just right. Just right is very good for sleeping.",
        castNames: ["hero", "Goldilocks"],
      },
      {
        sceneDescription: "a friendly bear cub peers at the waking hero and Goldilocks over the edge of the bed, his big parents' shadows in the doorway",
        text: "“Someone,” said a small bear voice, “is sleeping in MY bed.”",
        castNames: ["hero", "Goldilocks", "Little Bear"],
      },
      {
        sceneDescription: "the hero, Goldilocks, and the bear cub share a new pot of porridge together at the table, the mended little chair wearing a bow",
        text: "So they said sorry. And fixed the chair. And porridge, it turns out, is even better shared.",
        castNames: ["hero", "Goldilocks", "Little Bear"],
      },
    ],
  },
  {
    id: "three-little-pigs",
    kind: "classic",
    title: "{hero} and the Three Little Pigs",
    blurb: "Straw, sticks, bricks — and one out-of-breath wolf. (Public domain, retold.)",
    defaultStyleId: "wobbly-world",
    // Continuity notes (learned from the first Finn run): all three pigs are
    // CAST (houses need owners); the wolf's description is anatomy-neutral —
    // puffed cheeks are a per-scene action, not identity; every scene names
    // motion and blow DIRECTION; recurring locations are environments.
    cast: [
      {
        role: "friend",
        name: "Straw Pig",
        description: "a small skinny cheerful pig in a floppy straw sun hat and a yellow neckerchief",
      },
      {
        role: "friend",
        name: "Stick Pig",
        description: "a middle-sized earnest pig with round wire glasses and a buttoned green vest",
      },
      {
        role: "friend",
        name: "Brick Pig",
        description:
          "a sturdy sensible pig in denim overalls with a trowel in her pocket and a proud, patient smile",
      },
      {
        role: "adversary",
        name: "the Wolf",
        description: "a scraggly grey wolf in a blue bandana and patched brown overalls, more windbag than scary",
      },
    ],
    environments: [
      {
        name: "the straw house",
        description:
          "a small wobbly cottage built entirely of golden straw bales, with a shaggy thatched roof and a crooked straw chimney, standing on a sunny green meadow beside a winding dirt lane with hedgerows",
      },
      {
        name: "the meadow lane",
        description:
          "a sunny green meadow with soft rolling hills, a winding dirt lane, scattered wildflowers, and hedgerows under a bright blue sky",
      },
      {
        name: "the brick house",
        description:
          "a sturdy little house built of warm red bricks with a grey slate roof, a stout chimney, a wooden door, and a tidy green lawn",
      },
    ],
    beats: [
      {
        sceneDescription:
          "Straw Pig proudly pats the wall of his finished straw house while the hero walks around it inspecting it doubtfully, and the wolf peeks over a hedge far in the background",
        text: "The first house was straw. It went up before lunch. “Hmm,” said {hero}.",
        castNames: ["hero", "Straw Pig", "the Wolf"],
        environmentName: "the straw house",
      },
      {
        sceneDescription:
          "the wolf, cheeks puffed like balloons, blows a mighty gust STRAIGHT AT the straw house as it bursts apart into flying golden wisps, while the hero and Straw Pig sprint away mid-stride",
        text: "“I'll HUFF and I'll PUFF—” And he did. Oh, he did.",
        castNames: ["hero", "Straw Pig", "the Wolf"],
        environmentName: "the straw house",
      },
      {
        sceneDescription:
          "the wolf blows a huge gust DIRECTLY AT a rattling house of sticks so hard the sticks whirl apart, while Stick Pig and the hero run down the lane, the hero pointing ahead toward a distant brick house",
        text: "Sticks flew like a magic trick. “The brick house!” shouted {hero}. “RUN!”",
        castNames: ["hero", "Stick Pig", "the Wolf"],
        environmentName: "the meadow lane",
      },
      {
        sceneDescription:
          "the wolf, red-faced with cheeks puffed to bursting, blows with all his might STRAIGHT AT the sturdy brick house, leaning into the gust, while the hero and Brick Pig watch calmly from the window inside",
        text: "He huffed. He puffed. He huffed-and-puffed. The bricks did not care one bit.",
        castNames: ["hero", "Brick Pig", "the Wolf"],
        environmentName: "the brick house",
      },
      {
        sceneDescription:
          "the wolf lies flat on his back on the lawn, dizzy and completely out of breath, while the hero kneels beside him holding out a glass of lemonade and Brick Pig stands over him with hands on hips",
        text: "All that puffing makes a wolf thirsty. “Truce?” he wheezed. “Truce,” said {hero}.",
        castNames: ["hero", "Brick Pig", "the Wolf"],
        environmentName: "the brick house",
      },
      {
        sceneDescription:
          "the hero and Brick Pig lay bricks for a new little house at sunset while the wolf, wearing a tiny hard hat, carries a stack of bricks toward them, everyone busy and mid-motion",
        text: "The fourth house was brick too. Built by everyone. Blown down by no one.",
        castNames: ["hero", "Brick Pig", "the Wolf"],
        environmentName: "the meadow lane",
      },
    ],
  },
  {
    id: "road-to-oz",
    kind: "classic",
    title: "{hero} and the Road of Yellow Brick",
    blurb: "Brains, heart, courage — Baum's classic road, walked with your child. (Public domain, retold from the 1900 book.)",
    defaultStyleId: "torn-and-bright",
    cast: [
      {
        role: "friend",
        name: "Dorothy",
        description:
          "a kind farm girl with brown braids, a simple blue-and-white checked gingham dress, and shining SILVER shoes",
      },
      {
        role: "sidekick",
        name: "Scarecrow",
        description:
          "a cheerful floppy scarecrow of straw and patched blue cloth, a painted friendly face, and a pointed hat",
      },
    ],
    beats: [
      {
        sceneDescription: "the hero and Dorothy stand at the start of a road paved with yellow brick winding through a bright strange countryside, a little dog trotting ahead",
        text: "The road was yellow. The bricks were bright. And it went exactly one way: somewhere.",
        castNames: ["hero", "Dorothy"],
      },
      {
        sceneDescription: "the hero and Dorothy help the scarecrow down from his pole in a cornfield, straw sticking out everywhere",
        text: "“If I only had a brain,” sighed the Scarecrow, “I'd think of a way down.” {hero} thought of one first.",
        castNames: ["hero", "Dorothy", "Scarecrow"],
      },
      {
        sceneDescription: "the hero, Dorothy, and the scarecrow cross a deep field of enormous scarlet poppies, holding hands in a chain, eyelids heavy",
        text: "The poppies smelled like naptime. “Don't stop walking,” whispered Dorothy. They didn't.",
        castNames: ["hero", "Dorothy", "Scarecrow"],
      },
      {
        sceneDescription: "the hero, Dorothy, and the scarecrow catch first sight of a glittering green city on the horizon at the end of the yellow brick road",
        text: "And there it was — a city green as summer, bright as morning. Almost there. Almost.",
        castNames: ["hero", "Dorothy", "Scarecrow"],
      },
      {
        sceneDescription: "the hero, Dorothy, and the scarecrow rest on the yellow bricks sharing bread and apples, silver shoes gleaming, the green city glowing behind them",
        text: "“Brains are good,” said the Scarecrow. “Friends are better,” said Dorothy. {hero} agreed with both.",
        castNames: ["hero", "Dorothy", "Scarecrow"],
      },
      {
        sceneDescription: "the hero waves goodbye at the city gates as Dorothy's silver shoes sparkle, the yellow brick road stretching home behind them into the sunset",
        text: "Every road goes two ways, you know. One way is somewhere. The other way is home.",
        castNames: ["hero", "Dorothy"],
      },
    ],
  },
];

export const TEMPLATE_BY_ID: Record<string, BookTemplate> = Object.fromEntries(
  BOOK_TEMPLATES.map((t) => [t.id, t])
);
