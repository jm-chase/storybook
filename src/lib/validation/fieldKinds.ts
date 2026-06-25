// Validation profiles for the narrow free-text fields a parent can fill in.
//
// The allowlist + length/word caps are the PRIMARY structural defense against
// prompt injection: a field that only accepts a short name physically cannot
// carry an instruction payload (no punctuation, no tags, tight length, few
// words). The injection screen (injectionScreen.ts) and the Claude classifier
// pass (../safety/moderateInput.ts) are defense-in-depth layered on top.
//
// A story skeleton declares which slots it exposes and which kind each slot is;
// this file is the shared source of truth for what each kind permits, so the
// wizard UI and the generator validate identically.

export type FieldKindId = "name" | "shortDetail";

export interface FieldKind {
  id: FieldKindId;
  /** Human label for wizard hints and error messages. */
  label: string;
  /** Allowed characters, as a Unicode-aware regex matching the WHOLE trimmed value. */
  allow: RegExp;
  /** Plain-language description of what's allowed (wizard hint + error text). */
  allowDescription: string;
  /** Max length after normalization. */
  maxLength: number;
  /** Max whitespace-separated tokens — keeps values to a few words. */
  maxWords: number;
}

// Letters (any script), combining marks (accents), spaces, hyphens, apostrophes.
// Deliberately excludes digits, punctuation, brackets, slashes, and tag chars —
// none of which belong in a child's name or a one-or-two-word detail, and all of
// which are common in injection / markup payloads.
const LETTERS_SPACES_HYPHEN_APOSTROPHE = /^[\p{L}\p{M}'\- ]+$/u;

export const FIELD_KINDS: Record<FieldKindId, FieldKind> = {
  name: {
    id: "name",
    label: "Name",
    allow: LETTERS_SPACES_HYPHEN_APOSTROPHE,
    allowDescription: "letters, spaces, hyphens, and apostrophes",
    maxLength: 30,
    maxWords: 3,
  },
  shortDetail: {
    id: "shortDetail",
    label: "Detail",
    allow: LETTERS_SPACES_HYPHEN_APOSTROPHE,
    allowDescription: "letters, spaces, hyphens, and apostrophes",
    maxLength: 40,
    maxWords: 6,
  },
};
