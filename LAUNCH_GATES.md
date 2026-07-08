# Launch Gates

_Things that MUST be true before any **real user** can generate or view content. Development proceeds without them (with clearly-marked stubs); **launch does not.** This is the pre-flight checklist for going live._
_Created 2026-06-26._

| ID | Gate | Status |
|---|---|---|
| **LG-1** | Safety / abuse / CSAM screen (replace the dev stub) | 🟡 **real fail-closed vision screen live (2026-07-07); specialist CSAM provider still required** |
| LG-2 | Input moderation on the freeform character description | ✅ **built + wired on every freeform route, live-verified (2026-07-07)** |
| LG-3 | Legal: ToS + content liability + IP-similarity handling | ⛔ not started |
| LG-4 | Privacy / COPPA: accounts, minimal data, retention | ⛔ not started |
| LG-5 | Abuse + cost controls: auth, rate limits, budget caps | ⛔ not started |
| LG-6 | Server-side keys enforced (no client-side model calls) | 🟡 in progress |

---

## LG-1 — Safety / abuse / CSAM screen ← the headline gate

**Today (updated 2026-07-07):** `safetyCheck` is a **real, fail-closed Gemini-vision policy screen** — first in `defaultChecks()` AND in the refine gate, strict children's-content policy (sexual/suggestive, child exploitation, gore, horror, hate symbols, drugs, weapons, self-harm), and any provider error/timeout/unparseable verdict **rejects the image** (fail-closed live-proven with a broken key). `SAFETY_PROVIDER=stub` is the offline-dev opt-out (warns loudly). The old pass-everything stub is deleted.

**Before launch (what keeps this 🟡):** a general vision classifier is a real layer but **not sufficient** for a product that generates child-character imagery — add a specialist CSAM provider as a second arm inside the same check (the fail-closed wiring is the drop-in point). This is an account/contract call for James.

**Candidate providers** (decide + verify terms — this is a real cost/contract call):
- **Thorn Safer** — purpose-built CSAM detection/classification.
- **Hive** — moderation incl. CSAM/abuse classes.
- **Google Cloud Vision SafeSearch** / **AWS Rekognition Moderation** — general moderation tiers (likely a *layer*, not the whole answer).
- Likely **defense-in-depth**: specialized CSAM screen + a general moderation layer + our quality/consistency checks.

**Wiring contract** (so the swap is a drop-in):
1. Implement `ImageCheck` with `name: "safety"` (see `src/lib/art/outputGate/types.ts`).
2. Screen **both** the generated image **and** the input description (pair with LG-2).
3. **FAIL CLOSED:** on provider error/timeout, return `status: "fail"` — never pass an unscreened image. (Quality/consistency fail *open*; safety must not.)
4. Keep it **first** in `defaultChecks()` so unsafe content is rejected before any other work.
5. Provider creds via env (server-side only).

**Done when:** no code path can surface a generated image to a user without a passing real-safety verdict, and the stub is deleted.

---

## LG-2 — Input moderation on the freeform text — ✅ DONE 2026-07-07
`moderateFreeform` (`src/lib/safety/moderateFreeform.ts`, Gemini, injection-hardened data-block design carried over from the Claude classifier) screens **every** parent-entered freeform string before it is saved or reaches the image model: titles, character names+descriptions, scene descriptions + page text, setting descriptions, fix instructions, template hero fields, manuscript pages — wired into all 12 write routes, **fail-closed** (classifier error → 503, nothing saved), `INPUT_MODERATION=off` for offline dev. Live-verified: violent/gore flagged, **"Elsa from Frozen" flagged (IP)**, "Taylor Swift" flagged (real person), injection-shaped text treated as data, ordinary story conflict (grumpy troll) passes; route-level test returned 400 on a "Mickey Mouse" cast description. The Claude classifier (`moderateInput`) remains for when an Anthropic key exists.

## LG-3 — Legal
ToS + content-liability terms; an **output IP-similarity** stance (a freeform description can yield a recognizable protected character even with our own styles — R-4); use the **IP-indemnified** model (Adobe Firefly) for production generation (D-019). Verify commercial terms/indemnity for every provider in the stack (B-4).

## LG-4 — Privacy / COPPA
Parent-only accounts; minimal data; **no child photos** (confirmed); data retention + redaction. Note freeform descriptions can contain PII the parent types — treat as sensitive. (B-4.)

## LG-5 — Abuse + cost controls
Generation endpoints cost money per call — an unauthenticated/unthrottled endpoint is a direct cost-attack vector. Require auth + rate limits + per-user / per-book generation **budget caps** (ties to the gate's `maxAttempts` and the cost model in `cost.ts`).

## LG-6 — Server-side keys
All model calls run in Next route handlers / server actions; secret keys never reach the browser (`STACK_REVIEW.md` W-1). The shared `geminiClient` is built for server use; the studio must call *our* endpoint, not the model directly.
