// Vendor-agnostic art system. The ImageProvider seam lets us build the whole
// studio flow now with placeholders and drop a real model (Gemini / Firefly /
// FLUX — B-2) in later without touching the UI.

/** A house style we own (D-016): defined by our own attribute vocabulary, never a third-party name. */
export interface HouseStyle {
  id: string;
  /** Our brand name for the style. */
  name: string;
  /** One-line description for the picker. */
  blurb: string;
  /**
   * The attribute vocabulary we feed the image model. OUR words only — never
   * "in the style of <studio/artist>". This is the runtime style instruction.
   */
  promptFragment: string;
  /** Palette swatches for the picker card + placeholder art. */
  swatches: string[];
  /** Locked seed reference image ids — empty until we generate + lock real seeds (B-2). */
  seedRefs: string[];
}

/**
 * The brief that drives character art.
 * FIREWALL (P-1): `name` is structured + validated and may be used by the story;
 * `description` is freeform and is used by ART ONLY — it never reaches the plot.
 */
export interface CharacterBrief {
  name: string;
  description: string;
  styleId: string;
}

export interface ImageRef {
  /** data: URL now (placeholder); file/URL once a real provider is wired. */
  src: string;
  kind: "placeholder" | "generated";
  /** The prompt actually used — kept for audit + regeneration. */
  prompt?: string;
}

/**
 * The seam. A real provider (Gemini/Firefly/FLUX) implements this; today the
 * PlaceholderProvider does, so the studio flow runs end to end with no API key.
 * Content moderation of `brief.description` is the provider's responsibility at
 * generate time (the input + output safety passes, P-1).
 */
export interface ImageProvider {
  readonly id: string;
  generateCharacterSheet(
    brief: CharacterBrief,
    style: HouseStyle,
    seed?: number
  ): Promise<ImageRef>;
  // generateScene(...) — added when we build the storyboard step.
}
