import { FIELD_KINDS, type FieldKind, type FieldKindId } from "./fieldKinds";
import { looksLikeInjection } from "./injectionScreen";

export type FieldErrorCode =
  | "required"
  | "too_long"
  | "too_many_words"
  | "disallowed_characters"
  | "no_letters"
  | "injection_suspected";

export interface FieldOk {
  ok: true;
  /** Normalized, safe-to-use value. */
  value: string;
}

export interface FieldFail {
  ok: false;
  code: FieldErrorCode;
  message: string;
}

export type FieldResult = FieldOk | FieldFail;

/** NFC-normalize, fold curly apostrophes to straight, trim, collapse whitespace. */
export function normalize(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Deterministically validate one free-text field against its kind.
 * This is the first line of the input-safety layer — it runs before any value
 * reaches the AI, and its allowlist + caps are what make injection structurally
 * impossible rather than merely discouraged.
 */
export function validateField(
  raw: unknown,
  kindId: FieldKindId,
  options: { required?: boolean } = {}
): FieldResult {
  const kind: FieldKind = FIELD_KINDS[kindId];
  const required = options.required ?? false;

  const value = typeof raw === "string" ? normalize(raw) : "";

  if (value.length === 0) {
    return required
      ? { ok: false, code: "required", message: `${kind.label} is required.` }
      : { ok: true, value: "" };
  }

  if (value.length > kind.maxLength) {
    return {
      ok: false,
      code: "too_long",
      message: `${kind.label} must be ${kind.maxLength} characters or fewer.`,
    };
  }

  if (value.split(" ").length > kind.maxWords) {
    return {
      ok: false,
      code: "too_many_words",
      message: `${kind.label} must be ${kind.maxWords} words or fewer.`,
    };
  }

  if (!kind.allow.test(value)) {
    return {
      ok: false,
      code: "disallowed_characters",
      message: `${kind.label} may only contain ${kind.allowDescription}.`,
    };
  }

  if (!/\p{L}/u.test(value)) {
    return {
      ok: false,
      code: "no_letters",
      message: `${kind.label} must contain at least one letter.`,
    };
  }

  if (looksLikeInjection(value)) {
    return {
      ok: false,
      code: "injection_suspected",
      message: `${kind.label} contains text that isn't allowed. Please use a simple ${kind.label.toLowerCase()}.`,
    };
  }

  return { ok: true, value };
}
