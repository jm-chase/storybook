import type { CastRole } from "../lib/project/types";

// Book templates — skin 2 of D-023 (classics & occasions). A template is a
// prefilled project: cast + storyboard, ready to lock and illustrate. The
// parent supplies only the hero (their child's name + look); everything else
// is authored. This is the near-zero-creative-burden path (answers R-7).
//
// {hero} in any text is replaced with the validated hero name at instantiation.
//
// LEGAL (D-024): classics must be PUBLIC DOMAIN — verified per title before
// adding. Alice in Wonderland: Carroll d. 1898, published 1865 — public domain
// worldwide. No third-party illustration trade dress is referenced (D-016);
// character looks are described in our own words.

export interface TemplateCastMember {
  role: CastRole;
  /** Fixed name for authored characters; the HERO's name comes from the parent. */
  name: string;
  /** Authored default look — the parent replaces the hero's, may keep the rest. */
  description: string;
}

export interface TemplateBeat {
  sceneDescription: string;
  text: string;
  /** Names (from cast below, or "hero") appearing in this beat. */
  castNames: string[];
}

export interface BookTemplate {
  id: string;
  kind: "occasion" | "classic";
  title: string; // {hero} allowed
  blurb: string;
  defaultStyleId: string;
  /** The hero is implicit in every template — parent-named and parent-described. */
  cast: TemplateCastMember[];
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
];

export const TEMPLATE_BY_ID: Record<string, BookTemplate> = Object.fromEntries(
  BOOK_TEMPLATES.map((t) => [t.id, t])
);
