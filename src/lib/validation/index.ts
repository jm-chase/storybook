// Public entry point for the deterministic input-validation layer (safety 1a).
//
// A skeleton declares its personalization slots as InputField[]; the wizard and
// generator both run them through validateInputs() to get either clean values
// or per-field errors. Clean values then go to the Claude classifier pass
// (../safety/moderateInput.ts) before any generation.

import { validateField, type FieldFail } from "./validateField";
import { type FieldKindId } from "./fieldKinds";

export { FIELD_KINDS } from "./fieldKinds";
export type { FieldKind, FieldKindId } from "./fieldKinds";
export {
  validateField,
  normalize,
  type FieldResult,
  type FieldOk,
  type FieldFail,
  type FieldErrorCode,
} from "./validateField";
export { looksLikeInjection } from "./injectionScreen";

/** One personalization slot the parent fills in, as declared by a skeleton. */
export interface InputField {
  /** Slot name, e.g. "childName". */
  name: string;
  kind: FieldKindId;
  required?: boolean;
  /** Raw user input (unknown until validated). */
  raw: unknown;
}

export interface ValidatedInputs {
  /** True only if every field passed. */
  ok: boolean;
  /** Clean values, keyed by slot name (present for passing fields). */
  values: Record<string, string>;
  /** Per-field failures, keyed by slot name. */
  errors: Record<string, FieldFail>;
}

/** Validate a full set of declared fields. Never throws on bad input. */
export function validateInputs(fields: InputField[]): ValidatedInputs {
  const values: Record<string, string> = {};
  const errors: Record<string, FieldFail> = {};

  for (const field of fields) {
    const result = validateField(field.raw, field.kind, {
      required: field.required,
    });
    if (result.ok) {
      values[field.name] = result.value;
    } else {
      errors[field.name] = result;
    }
  }

  return { ok: Object.keys(errors).length === 0, values, errors };
}
