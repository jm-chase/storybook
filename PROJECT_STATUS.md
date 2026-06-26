# Project Status

_Living document — updated every session. Last updated: 2026-06-25._

## Built (functionally working right now)

- **Repo scaffold — verified.** Next.js (App Router) + TypeScript project structure, `package.json`, `tsconfig.json`, `next.config.mjs`, `.gitignore`, `.env.example`. Placeholder landing page renders the project framing. `npm install` clean (99 pkgs), `tsc --noEmit` clean, `next build` succeeds (Next 15.5.19).
- **Tracking docs.** README, this file, DECISIONS, ACCOUNTABILITY, GUIDE — all seeded.
- **Directory skeleton** for skeletons (`content/skeletons/`), illustration assets (`assets/illustrations/`), and generated output (`stories-output/`, gitignored).
- **Input validation + prompt-injection defense layer** (`src/lib/validation/`) — deterministic per-field rules (Unicode letter allowlist, length + word caps, instruction-pattern screen), shared field-kind definitions, and a `validateInputs()` aggregator. **12 unit tests pass** (`npm test`), typecheck + build clean. This is the structural core of input safety: narrow fields physically can't carry an injection payload.
- **Claude input-classifier pass** (`src/lib/safety/`) — `moderateInput()` runs validated free-text through `claude-opus-4-8` with forced-tool structured output; values are passed only inside a delimited data block and the system prompt treats them strictly as data. _Built and typechecks; **not yet run against the live API** (no key in `.env.local` tonight)._
- **Motif model + first skeleton + deterministic renderer** (`src/content/`, `src/lib/skeleton/`):
  - Curated motif catalog (`motifs.ts`): emotion, feeling, environment, lesson, sidekick — 6 options each, ages 3–5 (D-011).
  - First skeleton `the-big-new-thing` (`skeletons/theBigNewThing.ts`) — a 6-beat procedural emotional-arc story (ref-free draft, D-012). Opening emotion → closing feeling arc; implicit lesson; authored environment phrases.
  - `render.ts` — deterministic slot-fill, **no API call**, so we can preview story quality without a key. **6 render tests pass, including all 7,776 motif combinations rendering with zero unfilled slots.** Sample output looks good (see `scripts/sample.ts`).

- **Browser book preview** (`/preview` route + `src/components/SceneArt.tsx`) — the parent-preview surface. Lays the story out page-by-page like a booklet with **placeholder flat-vector art**, live controls for every motif + personalization field, re-renders on change, and runs the real validation layer on the text inputs. Run `npm run dev` → http://localhost:3000/preview. Art is placeholder pending B-2; layout/text/motif steering are real.
- **Art system shell (vendor-agnostic) + character studio** (`src/lib/art/`, `src/content/houseStyles.ts`, `/studio`) — the art-first build:
  - **`ImageProvider` seam** (`types.ts`) — the interface a real model (Gemini/Firefly/FLUX) will implement. `placeholderProvider.ts` implements it now (SVG placeholders that vary by style + seed), so the whole flow runs with no API key.
  - **House-style registry** (`houseStyles.ts`) — our 5 own styles (D-016), each with its own attribute `promptFragment` (no third-party names) + palette + empty `seedRefs` (real locked seeds pending B-2).
  - **Firewall** (`brief.ts`, P-1) — structured validated `name` (shared with story) vs freeform `description` (art only, never plot). 5 tests.
  - **`/studio`** — describe → pick style → generate → **iterate** → **lock** character. Live at http://localhost:3000/studio. Placeholder art; the seam, firewall, and style system are real. Environment/storyboard are labeled stubs.
  - 23 tests pass total.
- **Gemini image provider + consistency spike (staged)** (`src/lib/art/geminiProvider.ts`, `consistencyJudge.ts`, `scripts/consistency-spike.ts`) — real `gemini-2.5-flash-image` calls (character sheet + reference-conditioned scenes), verified against `@google/genai` 2.10. Optional Claude-vision judge. Runs on `npm run spike:consistency` once `GEMINI_API_KEY` is set. Typechecks; preflight is graceful without a key.
- **Stack & architecture review** (`STACK_REVIEW.md`) — full tooling/architecture tradeoffs + top weak points (server-side keys W-1, abuse/CSAM moderation W-2, async generation W-3, thin provider seam W-4, no data model W-5).

Not yet wired end-to-end: no Claude personalization pass, no output-moderation pass (layer 2), no print-ready PDF export (the booklet *file*; the on-screen preview exists), no full wizard flow.

## In Progress

- Nothing actively mid-edit. Clean stopping point.

## Direction pivot (2026-06-25)

Product is now **art-first** (D-014). Prose is parked. The existing prose skeleton + browser preview stand as a working scaffold/proof, but the next phase is the **illustration engine**: freeform character → AI-generated locked persistent reference → house style → environment → storyboard → output-moderated → locked book → print. Safety re-architects around firewalled+moderated freeform input (P-1, pending James's okay).

## Next up

**A senior-eng pressure test was run 2026-06-25 — see `RISKS.md`.** Headline: we've built UI breadth but the central claim (character consistency across pages) is unvalidated and moderation is unbuilt. De-risk-first sequence:

1. ✅ Image stack decided (D-019: both, Gemini-first then Firefly). ✅ Studio shell + style system built.
2. **R-1 — consistency eval spike (Gemini):** ✅✅ **RUN — core bet validated (D-020).** Character identity held across 6 varied scenes; ~$0.27. Remaining (not blockers): lock style via seed image (1/6 drifted), separate identity from wardrobe, upscale for print (1024² → R-9). Spike is resumable + throttled + prints a live cost table.
3. **R-2 — moderation layer** (Claude input pass + image output pass + final-book pass). Hard gate before any real model usage.
4. If consistency holds: full provider seam (`generateScene` multi-ref, R-5) + project/book data model + save (R-6).
5. **Thinnest MVP:** one character, one style, one environment, 4–6 fixed storyboard pages, real+moderated+locked → one printable PDF. Then breadth (freeform scaffolding, Firefly, pacing/lesson dial, print hardening).
6. (Deferred) Story-craft analysis (B-1) once references arrive.

## BLOCKERS (non-code) — need James's input

These are not coding decisions. Each is logged here with context + options so it doesn't get buried.

### B-1. Reference texts for the story-craft analysis — **BLOCKING the craft step**
The craft analysis (and therefore the first skeleton) can't start until you upload the handful of reference children's books/texts representing different structural traditions (procedural/predictable, emotional-arc, quieter/ambiguous-ending, etc.).
- **Need from you:** the reference texts (paste, file drop, or paths).
- **Until then:** I can proceed on the validation layer and scaffold, but not on skeletons.

### B-2. Image-generation stack — NOW THE TOP BLOCKER (reborn after the 2026-06-25 pivot, D-014/015)
The product is now art-first: freeform character → AI-generated, locked, persistent reference art (D-014). Picking the image stack gates the character-lock prototype. What matters for us:
- **Character-reference quality** (can it hold a custom character across scenes?)
- **Commercial-use license + IP indemnification** (paid product — provider ToS + who owns/indemnifies outputs)
- **Print resolution** (~300 DPI; native res + upscale path)
- **Cost per book** (per-creation generation, not per-render)
- **Next action:** James asked for / Claude to bring a shortlist scoring candidates on the above. Then pick → prototype the describe→generate→iterate→lock loop.

### B-6. Google billing — blocks the consistency spike (NEW, 2026-06-26)
The spike ran and **validated the integration** (auth ✅, network ✅, SDK call ✅) but hit `HTTP 429, free_tier_requests limit: 0` — Gemini image generation (Nano Banana) is **paid-tier only**, and the key's Google project is on the free tier.
- **Fix (no code change):** enable billing / pay-as-you-go on the project for this API key at aistudio.google.com, then re-run `npm run spike:consistency`.
- **Status:** ⏳ waiting on James to enable billing. Code is ready; one command from results.

### B-4. Legal review — own-styles + AI-art commercial use (NEW, 2026-06-25)
- Confirm the **own-house-styles** posture (D-016) holds up: we never prompt protected names; do our generated style seeds stay clear of recognizable third-party trade dress?
- Confirm **commercial usage rights + indemnification** for whichever image stack we pick (B-2).
- COPPA still: parent-only, minimal data, **no child photos in v1** (confirmed by James; photo upload is a maybe-later).

### B-3. Working product name
Folder/working name is `storybook` for now. Shortlist to bring you: Storyloom, Tucked In, Little Chapters, Pagewright, Bedtime Press. Your pick gets logged in DECISIONS.md (D-007, open).

## Notes / risks

- Dependency versions in `package.json` are caret ranges; first `npm install` will resolve exact versions — confirm `next dev` + `tsc --noEmit` are clean before building on top.
