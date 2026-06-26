import type { FieldKindId } from "../validation";

// A skeleton is the core creative product: a fixed beat structure with named
// slots. Motifs are curated, selectable dimensions the parent sets to steer the
// story WITHIN that fixed structure — never free text, so the no-freeform-box
// safety rule holds. emotion (opening) → feeling (closing) form the emotional
// arc; lesson is embodied implicitly via an authored fragment (not stated as a
// moral); environment supplies authored place fragments; sidekick is a companion
// the parent also names via a personalization slot.

export interface EmotionMotif {
  id: string;
  /** Fits the frame "felt ___": nervous, shy, worried, ... */
  word: string;
}

export interface FeelingMotif {
  id: string;
  /** Fits the frame "felt ___": brave, proud, calm, ... */
  word: string;
}

export interface EnvironmentMotif {
  id: string;
  /** Short label for the wizard, e.g. "the big school". */
  label: string;
  /** Authored opening phrase woven into beat 1, e.g. "the big school with its tall blue doors". */
  openingPhrase: string;
  /** Tag selecting which illustration scene-set to use. */
  sceneTag: string;
}

export interface LessonMotif {
  id: string;
  /** Short label for the wizard, e.g. "small steps add up". */
  label: string;
  /** Authored fragment that embodies the lesson implicitly at the turn beat. */
  turnFragment: string;
}

export interface Sidekick {
  id: string;
  /** Fits the frame "a ___": little fox, brave bear, ... */
  label: string;
}

/** All motif options available across skeletons. A skeleton opts into a subset by id. */
export interface MotifCatalog {
  emotions: Record<string, EmotionMotif>;
  feelings: Record<string, FeelingMotif>;
  environments: Record<string, EnvironmentMotif>;
  lessons: Record<string, LessonMotif>;
  sidekicks: Record<string, Sidekick>;
}

/** A free-text slot the parent fills, validated by the validation layer's field kinds. */
export interface PersonalizationSlot {
  /** Token name used in beat templates, e.g. "heroName". */
  name: string;
  kind: FieldKindId;
  required: boolean;
  /** Wizard label. */
  label: string;
}

export interface Skeleton {
  id: string;
  /** Templated title, may contain slots, e.g. "{heroName} and the Big New Thing". */
  title: string;
  ageBand: "3-5";
  /** The situation this skeleton dramatizes. */
  theme: string;
  /** Structural tradition this skeleton draws on. Ref-free placeholder until STORY_CRAFT_NOTES exists. */
  tradition: string;
  /** Beat templates with {slot} placeholders. One beat ≈ one page. */
  beats: string[];
  personalization: PersonalizationSlot[];
  /** Which catalog option ids are valid for this skeleton. */
  motifs: {
    emotions: string[];
    feelings: string[];
    environments: string[];
    lessons: string[];
    sidekicks: string[];
  };
}
