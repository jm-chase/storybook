// Defense-in-depth screen for instruction-shaped text.
//
// The character allowlist (fieldKinds.ts) already blocks most injection payloads
// by rejecting punctuation, tags, and length. But a name/detail field still
// permits letters and spaces, so a short letters-only phrase like
// "ignore previous instructions" or "you are now" would pass the allowlist.
// This screen catches those. It runs on the already-normalized value.
//
// False positives are acceptable here: the field is short and re-enterable, and
// these phrases effectively never appear in a real child's name or detail.

const INJECTION_PATTERNS: RegExp[] = [
  /\bignore\b.*\b(previous|prior|above|earlier|all)\b/i,
  /\bdisregard\b/i,
  /\b(forget|override)\b.*\b(everything|all|previous|instruction|rule)/i,
  /\byou are now\b/i,
  /\bact as\b/i,
  /\bpretend (to be|you)\b/i,
  /\bsystem prompt\b/i,
  /\bnew instructions?\b/i,
];

/** Returns true if the value looks like an attempt to inject instructions. */
export function looksLikeInjection(value: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(value));
}
