# Project Status

_Living document — updated every session. Last updated: 2026-07-07._

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
- **Output Gate** (`src/lib/art/outputGate/`) — the seam every generated image passes through (D-021): `ImageCheck` + `runGate` (generate → check → accept clean / reroll failures to ≤3 variants or a budget). 4 unit tests.
  - **Concrete checks built + validated:** `qualityCheck` + `consistencyCheck` on Gemini vision (`gemini-2.5-flash`), `safetyCheckStub` (dev stub, LG-1). `defaultChecks()` = safety→quality→consistency. Shared `geminiClient` + `retry`.
  - **Validation (`npm run validate:gate`):** the quality check independently caught **both** defects James spotted — the 3-hands (04) and the too-small umbrella (02); consistency confirmed same-character throughout. Finding: consistency judge is lenient on subtle style drift → enforce style via locked seed (D-020), not the judge.
- **Launch-gate provision** (`LAUNCH_GATES.md`) — the must-do-before-real-users checklist, headlined by **LG-1** (replace the safety stub with a specialized abuse/CSAM provider; wiring contract included). Per James: documented as a launch gate, dev proceeds with the stub.
- **Slice 2 — server-side generation + studio chooser (DONE, proven end-to-end):**
  - `src/lib/art/generateCharacterVariants.ts` — generate candidates → run each through the gate → return clean variants + cost.
  - `src/app/api/generate-character/route.ts` — server route (keys off the client, W-1/LG-6); validates the brief, returns 3 variant data-URLs + attempts + cost.
  - `/studio` rewired: real Gemini generation via the endpoint, **choose-from-3** chooser (big preview + thumbnails), lock, cost line, error handling.
  - **Live test:** POST with "a baby African elephant" → HTTP 200, 3 clean variants, 3 attempts (no rerolls), **$0.117**, 62s. Freeform path + gate + chooser all verified. Latency (~60s) reinforces W-3 (needs progress streaming).
  - _Known dead code:_ `placeholderProvider` is now unused by the studio (left in place; could serve an offline demo).
- **Multi-character spike — VALIDATED (D-022/R-18):** `generateMultiCharacterScene` (multi-reference) + `scripts/multichar-spike.ts` (`npm run spike:multichar`). 3 distinct locked characters (hero/sidekick/adversary) co-appeared in 2- and 3-character scenes with **no identity bleed**, consistent style. $0.23. Multi-character is a v1 must-have and the approach is proven. Still to build: cast data model + role, per-character consistency check, studio cast-locking, storyboard "who's in this beat."

- **Cast support on a persisted project data model (R-6 partial / D-022) — DONE, 2026-07-06:**
  - `src/lib/project/` — `Project`/`CastMember` schema (role: hero/sidekick/adversary/friend, firewalled name/description, locked reference) + filesystem store (`projects/<id>/project.json` + `images/`, gitignored), strict id/filename allowlists (no traversal). 6 unit tests.
  - API routes: `GET/POST /api/projects`, `GET/PATCH /api/projects/[id]` (style locks once any cast member is locked — 409), `POST .../cast` (one-hero rule enforced), `PATCH/DELETE .../cast/[castId]`, `POST .../cast/[castId]/lock`, `GET .../images/[file]` (immutable cache).
  - `/studio` reworked into the **cast studio**: project picker + create → cast roster with role badges + locked thumbnails → add character → generate 3 (existing gate path) → choose → lock → persisted across restarts.
  - **Per-character consistency check (D-022 item 2):** `GateContext.references[]` — multi-character scenes verify EACH cast member against its own locked reference in one labelled vision call.
  - Verified: 39 tests pass, `tsc` clean, `next build` clean, full API loop smoke-tested live (create → add hero → validation 400s → lock → 409 style-change → image serves 200 → list shows locked count). Real-generation smoke **blocked by B-7** (billing regression), but the generation path itself is unchanged from proven Slice 2.
  - _Hosted note (documented in the lock route):_ v1 lock accepts the client's chosen data-URL; once deployed, lock must reference a server-held gate-passed candidate id (gate bypass otherwise).

- **THE SPINE IS COMPLETE — first real book end-to-end (2026-07-07):**
  - **Storyboard slice:** `StoryBeat` in the project model (sceneDescription firewalled art-only; `text` typeset never model-rendered; `castIds` = who's in the beat), beat validation (`beats.ts`, 6 tests), `generateSceneVariants` (0-cast establishing shots / multi-cast via labelled refs, through the gate with per-character consistency), beats CRUD + generate + lock routes, storyboard UI in `/studio` (beat cards, cast chips, choose-from-3 per page via shared `VariantChooser`).
  - **PDF export:** `renderBookPdf` (@react-pdf/renderer — 8in-square cover + full-page art + typeset text panel; partial books export as text pages), `GET /api/projects/[id]/pdf`, download button. Verified: 4-page PDF, correct dims/title. _R-9 remains: 1024² ≈ 128 DPI at 8in — home-print fine, POD needs the upscale pass._
  - **E2E validation (`npm run validate:e2e`, $0.74):** created "Mia and the Grumpy Troll" — locked hero+sidekick+adversary, generated 3 pages incl. two 3-character scenes. **Visual inspection: all characters on-model in every page, zero identity bleed, style held; the gate rerolled exactly one defective candidate autonomously.** Finding: the *bridge* changed stone→wood between pages — **environment locking is the next consistency frontier** (expected; same mechanism as cast).
  - **Skin 2 — classics & occasions (first pass):** `bookTemplates.ts` (2 occasion templates + *{hero} in Wonderland*, public-domain per D-024, all content-linted by test), `instantiateTemplate` (3 tests), `POST /api/projects/from-template`, template picker in `/studio` ("you just add your child"). Smoke-tested: Mia in Wonderland created with Alice + White Rabbit pre-cast, 6 authored beats.
  - 42 tests pass; tsc + build clean.
- **Cast point-to-fix (2026-07-07, live-verified):** `POST .../cast/[castId]/refine` (streams, edit-fidelity gate); generic `RefineWorkspace` now serves both page art and locked cast references (✏️ Fix on locked cast cards). Verified: flower added behind the troll's ear, all else faithful. Pages keep their art until regenerated (stated in UI).
- **Consistency eval harness — R-11 RESOLVED (2026-07-07):** `npm run eval:consistency` — versioned battery (2 briefs × 3 scenes × 2 styles) scored by the gate's own checks, JSON report per model to `eval-output/`. **Baseline (gemini-2.5-flash-image): consistency 6/6, quality 5/6** (one garbled-signage-text defect — the class the gate rerolls in production). Use before any prompt/model change (e.g. trying `gemini-3.1-flash-image`).
- **Series — "same cast, new adventure" (2026-07-07, live-verified):** `cloneForSeries` (deep clone of cast + settings incl. locked refs; beat art excluded; 2 tests) + `copyImages` + `POST /api/projects/[id]/series` + studio button (appears once any cast member is locked). Verified: sequel project inherited 3 locked characters + the locked bridge + style with an empty storyboard; copied references serve. The D-023 retention lever exists.
- **R-7 scaffolding — RESOLVED first pass (2026-07-07):** curated "try one" starter chips (`src/content/suggestions.ts`) on every blank creative box — character descriptions per role (+ coaching hint: age/hair/eyes/signature item), scene starters built from the actual cast names in the beat, and setting chips that fill name+description together. Chips appear only while the box is empty; clicking fills it for editing. The "help parents who can't verbalize it" promise now has its first concrete surface.
- **Model A/B via the harness (2026-07-07): stay on gemini-2.5-flash-image for now.** `gemini-3.1-flash-image` scored the same (consistency 6/6, quality 5/6 — defect was malformed hands vs 2.5's garbled signage). Visual diff: 3.1 renders richer/denser watercolor BUT (a) returned **landscape** by default — breaks our square-page pipeline unless we request an aspect ratio, (b) over-locked the outfit (raincoat in bed; 2.5 correctly switched to pajamas), (c) busier compositions. An upgrade needs aspect-ratio config + identity/wardrobe prompt work + full re-eval; also verify 3.1's actual per-image price (harness cost line assumes 2.5's $0.039). Reports in `eval-output/`.
- **GUIDE.md rewritten (2026-07-07)** to describe the actual art-first, one-engine/three-skins product (was still the pre-pivot prose system).
- **Progress streaming — W-3 RESOLVED (2026-07-07, live-verified):** the gate emits per-attempt events (`GateProgress`: generating/checking/accepted/rejected + reason), all four generate endpoints stream **NDJSON** ({progress}… then {done}/{error}; 4xx validation stays plain JSON), and the studio's chooser narrates the wait live ("🎨 Drawing option 2 of 3… 🔍 Checking… ↻ Caught a flaw — redrawing…"). Timestamped live test: events arrived incrementally across a 37s generation. e2e script is stream-aware.
- **Print upscale — R-9 first pass (2026-07-07):** page art is upscaled to **2400px (300 DPI at 8in trim)** with sharp/lanczos and embedded as q90 JPEG at PDF-export time (originals untouched). Verified: 4-page PDF at print resolution, 4.9MB. Remaining R-9: bleed, imposition, CMYK/POD spec; optional AI upscaler for premium.
- **Environment locking (2026-07-07, live-verified):** `EnvironmentSetting` on the project (validated short name + firewalled description + locked reference), `beat.environmentId`, `generateEnvironmentVariants` (establishing view, gated), env add/generate/lock/delete routes, scenes condition on the locked setting (`SETTING_INSTRUCTION` + ref image, both single- and multi-character), "The settings" studio section + where-does-it-happen select on beats (setting change clears page art). **Live test ($0.39):** locked "the old stone bridge," regenerated pages 1+3 — same stonework/moss/banks/trees across both pages while lighting followed each scene (rainy dusk vs golden sunset). The stone→wood drift class is closed. Env consistency is enforced by conditioning (not yet judged post-hoc — acceptable v1).
- **Point-to-fix — Slice 3, THE MAGIC (2026-07-07, live-verified):** `editImage` (targeted instruction edit) + `refineImageVariants` — the gate swaps character-consistency for an **edit-fidelity check** (result must differ from the original ONLY by the requested change). `POST .../beats/[beatId]/refine` + ✏️ UI on locked pages (say it plainly → choose → relock). **Live test:** "add a small red ladybug resting on the bridge railing" on the 3-character page → 3 clean variants, $0.117, ladybug present, everything else pixel-faithful. Follow-up: same refine for locked cast references; true tap-coordinates later.
- **Style-seed locking — D-020 refinement 1 RESOLVED (2026-07-07, live-verified):** curated **style plates** (one per house style, same neutral meadow subject; 2 candidates each via `npm run seeds:candidates` ~$0.39, hand-curated — `bright-and-round` #1 rejected for kawaii faces on scenery = content-leakage risk) checked in at `assets/styleSeeds/<styleId>.jpg` (512px q85, 29–110KB). `getStyleSeed()` loads + caches; the provider's new **labeled-reference structure** puts the seed FIRST on every character/scene/environment generation with a style-only instruction ("match technique/texture/palette… do NOT copy its subject"). Deliberately unseeded: refine (original is its own anchor) + eval `generateScene` (battery comparability). **Live validation (`npm run validate:seeds`, $0.08):** painted-wonder badger sheet + unrelated night-bakery scene — style held perfectly, zero meadow/bridge/tree leakage, both passed the gate first attempt. Style no longer depends on prompt text alone.
- **Caption-space composition (2026-07-07, live-verified):** beats WITH page text now generate art composed for the caption panel — focal action in the upper two-thirds, lower region simple painted ground/water/grass (`captionSpace` threaded route→orchestrator→provider; wordless pages unaffected). First wording ("keep the bottom uncluttered") backfired — the model left a literal blank band + frame (the D-020 border-drift class); reworded to demand edge-to-edge full bleed. Live test: badger street scene, full-bleed, action top-two-thirds, bottom = plain cobblestones. $0.08 total.
- **POD bleed export — R-9 mostly resolved (2026-07-07):** `GET /api/projects/[id]/pdf?bleed=1` + "🖨️ Print-shop PDF (with bleed)" button — 0.125in bleed per edge (8.25in page, art to the bleed line, text panel inset past the trim), upscale target scales with page size (2475px @300 DPI). Verified on the demo book: 594×594pt vs 576×576pt trim, 6 pages each. CMYK left to the POD service (KDP/Lulu/IngramSpark accept RGB). Remaining R-9: imposition only if we ever self-print signatures; per-service spec check when a POD target is picked.
- **Identity/wardrobe separation — D-020 refinement 2 RESOLVED (2026-07-07, live-verified):** scene prompts now lock IDENTITY (face/hair/eyes/colours/markings/proportions) while allowing scene-appropriate clothing changes; the gate's consistency judge tolerates them too (was hard-failing on "different outfit" in the single-ref form). Live test ($0.04): badger locked in raincoat+boots → bedtime scene rendered sleepwear-appropriate (rain gear off), identity + style held, gate passed first attempt. Both D-020 refinements are now closed — the consistency engine's known gaps list is empty.
- **Skin 3 — indie-author manuscript mode (thin) + beat editing (2026-07-07):** `beatsFromManuscript` (blank-line page split, caps, sceneDescription defaults to the page text; 2 tests), `POST /api/projects/from-manuscript`, "Illustrate your manuscript" section in the picker. **Beat-edit UI** (all skins): edit scene/text/cast per page; text-only edits keep the locked art, scene/cast edits clear it (verified live both ways). All three D-023 skins now exist on the one engine.

Not yet wired end-to-end: no Claude personalization pass, no output-moderation pass (layer 2), no full wizard flow. Remaining print gap: POD prepress (bleed/imposition/CMYK — rest of R-9).

## In Progress

- Nothing actively mid-edit. Clean stopping point.

## Direction pivot (2026-06-25)

Product is now **art-first** (D-014). Prose is parked. The existing prose skeleton + browser preview stand as a working scaffold/proof, but the next phase is the **illustration engine**: freeform character → AI-generated locked persistent reference → house style → environment → storyboard → output-moderated → locked book → print. Safety re-architects around firewalled+moderated freeform input (P-1, pending James's okay).

## Next up — THE NEW PLAN (D-023, adopted 2026-07-06)

**Master plan: one engine, three front-ends.** The engine (locked cast + house styles + Output Gate + storyboard + print pipeline) is the asset; three product skins sit on it: (1) **parent studio**, (2) **classics & occasions** (public-domain only — D-024), (3) **indie-author B2B**. Spine first, skins after.

**Build sequence (36-hour push started 2026-07-06):**
1. ✅ **Cast support on a real data model (R-6/D-022)** — done 2026-07-06.
2. ✅ **Storyboard + scene generation** — done 2026-07-07, validated live.
3. ✅ **PDF export** (booklet layout; R-9 upscale still open) → **first real book end-to-end, $0.74**. The spine exists.
4. **Skins:** ✅ skin 2 first pass (occasions + Wonderland). Next: skin 3 (manuscript-in author flow, thin).
5. ✅ ALL DONE 2026-07-07: environment locking, point-to-fix/inpaint, style-seed locking, progress streaming (W-3), print upscale first pass (R-9), series ("same cast, new adventure"). Remaining engine work: POD prepress (rest of R-9), identity/wardrobe prompt separation (D-020 refinement 2), composition prompts.
6. (Deferred) Story-craft analysis (B-1) once references arrive; launch gates (`LAUNCH_GATES.md`) before real users.

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

### B-7. Google billing REGRESSED — blocks all real generation (NEW, 2026-07-06) — ⏳ NEEDS JAMES
Billing was enabled 2026-06-26 ($25 credit) and the spikes ran. On 2026-07-06 every paid call fails again: image model → `429 free_tier limit: 0`; even plain text `gemini-2.5-flash` → `403 PERMISSION_DENIED`. The key itself is **valid** (the free models-list endpoint works). So the Google project's billing/quota standing lapsed — credit expired/paused, billing account suspended, or the API was restricted on the project.
- **Fix (no code change):** check the project at aistudio.google.com / console.cloud.google.com → Billing; re-enable pay-as-you-go or attach a live billing account, then re-try `/studio` generation.
- **Side-find while probing:** `gemini-3.1-flash-image` and `gemini-3-pro-image` are now available — likely successors to 2.5-flash-image. Model id is env-configurable (`GEMINI_IMAGE_MODEL`), so we can A/B them the moment billing is back.

### B-6. Google billing — blocks the consistency spike (RESOLVED 2026-06-26; superseded by B-7)
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
