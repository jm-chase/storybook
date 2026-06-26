# Launch Gates

_Things that MUST be true before any **real user** can generate or view content. Development proceeds without them (with clearly-marked stubs); **launch does not.** This is the pre-flight checklist for going live._
_Created 2026-06-26._

| ID | Gate | Status |
|---|---|---|
| **LG-1** | Safety / abuse / CSAM screen (replace the dev stub) | ⛔ **stub in place** |
| LG-2 | Input moderation on the freeform character description | ⛔ not started |
| LG-3 | Legal: ToS + content liability + IP-similarity handling | ⛔ not started |
| LG-4 | Privacy / COPPA: accounts, minimal data, retention | ⛔ not started |
| LG-5 | Abuse + cost controls: auth, rate limits, budget caps | ⛔ not started |
| LG-6 | Server-side keys enforced (no client-side model calls) | 🟡 in progress |

---

## LG-1 — Safety / abuse / CSAM screen ← the headline gate

**Today:** `src/lib/art/outputGate/checks/safetyCheck.ts` is a **dev-only stub** (`safetyCheckStub`) that passes everything and logs `SAFETY NOT ENFORCED`. It sits first in `defaultChecks()`.

**Before launch:** replace the stub with a specialized provider. A general "is this inappropriate?" vision classifier is **not sufficient** for a product that generates child-character imagery.

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

## LG-2 — Input moderation on the freeform character description
The freeform "describe your character" box (D-018) is firewalled to art only, but its *text* still needs a content pass before it reaches the image model: block sexual/violent/hateful content, **and** requests for real people / celebrities / branded or copyrighted characters ("draw Elsa"). Claude text classifier (extend `moderateInput`). Pairs with LG-1 (the input half of safety).

## LG-3 — Legal
ToS + content-liability terms; an **output IP-similarity** stance (a freeform description can yield a recognizable protected character even with our own styles — R-4); use the **IP-indemnified** model (Adobe Firefly) for production generation (D-019). Verify commercial terms/indemnity for every provider in the stack (B-4).

## LG-4 — Privacy / COPPA
Parent-only accounts; minimal data; **no child photos** (confirmed); data retention + redaction. Note freeform descriptions can contain PII the parent types — treat as sensitive. (B-4.)

## LG-5 — Abuse + cost controls
Generation endpoints cost money per call — an unauthenticated/unthrottled endpoint is a direct cost-attack vector. Require auth + rate limits + per-user / per-book generation **budget caps** (ties to the gate's `maxAttempts` and the cost model in `cost.ts`).

## LG-6 — Server-side keys
All model calls run in Next route handlers / server actions; secret keys never reach the browser (`STACK_REVIEW.md` W-1). The shared `geminiClient` is built for server use; the studio must call *our* endpoint, not the model directly.
