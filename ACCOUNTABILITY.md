# Accountability

_For James. Where we are, what's next, and what I'm waiting on you for._
_Last updated: 2026-06-25._

---

## Tonight's session (2026-06-24 → 25)

- [x] Clarifying questions answered (scope, language, illustrations, age band)
- [x] Stack proposed with tradeoffs, confirmed by James
- [x] Repo initialized (`C:\Users\james\Projects\storybook`, git)
- [x] Four tracking docs created: README, PROJECT_STATUS, DECISIONS, ACCOUNTABILITY
- [x] GUIDE.md created (plain-language system walkthrough)
- [x] DECISIONS.md seeded with everything settled tonight (D-001…D-009)
- [x] Scaffold verified: `npm install` clean, `tsc --noEmit` clean, `next build` succeeds
- [ ] _Not done tonight (correctly deferred):_ story-craft analysis, first skeleton, validation layer — see "Next session"

- [x] Built the input validation + prompt-injection defense layer (`src/lib/validation`), 12 passing unit tests
- [x] Built the Claude input-classifier pass (`src/lib/safety`), tool-forced structured output (typechecks; not yet run live)

**You can close the laptop here.** Everything is committed; nothing is half-finished. The deterministic safety layer is tested; the Claude classifier is built but unverified against the live API (needs a key).

---

## Next session — clear re-entry point

1. **Story-craft analysis** → `STORY_CRAFT_NOTES.md`. **Only possible once you upload the reference texts** (B-1 below). This gates the first skeleton.
2. If refs aren't ready, the ref-independent options are: (a) drop your `ANTHROPIC_API_KEY` in `.env.local` and I live-verify `moderateInput()` end to end; (b) build the symmetric **output-moderation pass** (layer 2) — same structure, takes the finished story.

---

## Decisions / inputs I owe you (surfaced so they don't get buried)

| # | What I need | Why it matters | Status |
|---|---|---|---|
| **B-1** | **Upload the reference children's books/texts** | Gates the craft analysis and the first skeleton — can't start either without them | ⏳ Waiting on you |
| **D-007** | Pick a working name (or approve one): Storyloom · Tucked In · Little Chapters · Pagewright · Bedtime Press | Brand; unblocks naming the product surface | ⏳ Waiting on you |
| **B-2** | Decide image-gen vendor + confirm commercial/print IP rights | Needed before building the illustration library (not before code — pipeline reads a static asset folder) | ⏳ Deferred, parallel-track |

None of these block next session's steps 1–2. B-1 blocks step 3.

---

## ✅ B-7 RESOLVED (2026-07-07) — James's prepay AI Studio billing confirmed live; all generation working again.

**THE SPINE IS DONE (2026-07-07):** describe cast → lock → storyboard → gated multi-character scenes → print PDF. First real book generated end-to-end for **$0.74** (`npm run validate:e2e`): "Mia and the Grumpy Troll", 3 locked characters, 3 pages, zero identity bleed, one autonomous gate reroll. PDF verified (4 pages, 8in square). Skin 2 shipped (occasions + *{hero} in Wonderland*). A ready-to-illustrate "Mia in Wonderland" project is waiting in `/studio`.

---

## What I need from you (one action + one fyi)

1. **Add `GEMINI_API_KEY` to `.env.local`** (copy from `.env.example`), then run **`npm run spike:consistency`**. Open `spike-output/index.html` and eyeball whether the 6 scenes are the *same Mia*. (If your `ANTHROPIC_API_KEY` is also in `.env.local`, you'll get an automated same-character score too.) That one run de-risks the most important assumption in the product. ~$0.27.
2. **FYI — image stack settled** (D-019): both, Gemini-first then Firefly, FLUX-LoRA premium. Cost is now known (~$0.039/image → <$1/book).

**✅ RESOLVED (2026-06-26):** billing on ($25 credit), spike ran to completion. **Core bet validated (D-020)** — Mia held consistent across 6 varied scenes. Spike now throttled (6s) + resumable + prints a live cost table. Cost ~$0.27 for 7 images; per-book projections: lean $0.31 / typical $0.94 / heavy $1.87.

## Next session — re-entry

Slice 1 is essentially done: the Output Gate works and the quality check **proved itself** by catching both defects James spotted (3-hands + small umbrella). Safety is a documented launch-gate stub (`LAUNCH_GATES.md` LG-1).

**✅ Slice 2 DONE & proven** — server-side `/api/generate-character` runs Gemini through the gate and returns 3 clean variants; `/studio` rewired to the choose-from-3 chooser. Live test: "a baby African elephant" → 3 clean options, $0.117, 62s. See it at **http://localhost:3000/studio** (dev server running, bg `bxolgsit0`).

**Multi-character (R-18/D-022): ✅ VALIDATED** — hero+sidekick+adversary co-appear with no identity bleed (`npm run spike:multichar`, $0.23). It's a v1 must-have and the approach is proven. Architecture this unlocks: **cast data model + role, per-character consistency check, studio cast-locking, storyboard "who's in this beat."**

**✅ DECIDED (2026-07-06): the new plan is D-023 — one engine, three front-ends** (parent studio / classics & occasions / indie-author B2B), spine-first. D-024: no in-copyright novels (Narnia is out); public-domain classics are skin 2. **36-hour push underway:** cast support + data model → storyboard + scenes → PDF → skins.
- Pending refinements still queued behind the spine: point-to-fix (Slice 3), style-seed locking, identity/wardrobe separation, rule-of-thirds prompts, print upscaling; and W-3 (progress streaming) — felt at ~60s/generate.

Open calls for James (not blockers): pick the **safety provider** (LG-1) and the **production model** (Firefly, LG-3) when convenient — launch gates, not dev gates.

---

## (resolved) Decision — the safety provider

Iteration model + Output Gate are decided (D-021) and the **gate framework is built + tested**. Build sequence from here:
- **Slice 1 (in progress):** ✅ gate framework. Next: concrete **quality** + **consistency** checks via Gemini vision (we can validate the quality check catches the 3-hands on `04-scene` using images we already have — ~free), and move generation **server-side** (W-1).
- **Slice 2:** wire the studio character step → real Gemini behind the gate, with the **choose-from-3** variant chooser.
- **Slice 3 (the magic):** **point-to-fix / inpaint**.
- **Slice 4:** fold in spike refinements — **style-seed locking**, **identity/wardrobe separation**, composition (rule-of-thirds) in the prompt templates; print **upscaling** (R-9).

**The one decision (W-2): the safety arm of the gate.** A general vision classifier (Gemini/Claude) is fine for *dev*, but a child-imagery product needs a **specialized abuse/CSAM screen before real users** (e.g. Thorn Safer, Hive, Cloud Vision SafeSearch). My recommendation: build now with a clearly-stubbed safety check (dev only, logs "NOT ENFORCED"), and make the specialized provider a **launch gate**, not a dev gate. **OK to proceed that way, or do you want to pick the safety provider now?**

---

## Running log

- **2026-06-24/25** — Kickoff. Scope + stack decided and confirmed. Repo scaffolded, all tracking docs created, decisions logged. Held the craft analysis pending reference uploads (the brief's explicit gate before any skeleton work).
- **2026-06-25** — Built the input-safety layer: deterministic validation + injection screen (`src/lib/validation`, 12 passing tests) and the Claude input-classifier pass (`src/lib/safety`, tool-forced structured output). Logged D-010 (structured output via forced tool call on SDK 0.68; migrate to `output_config.format` on SDK bump). Typecheck + build + tests all clean.
- **2026-06-25 (cont.)** — At James's direction, proceeded ref-free (D-012) to baseline output quality. Built the motif model (emotion/environment/lesson/feeling + sidekick, curated picklists — D-011), the first skeleton `the-big-new-thing` (ages 3–5, emotional-arc, 6 beats), and a deterministic renderer (no API key needed). 18 tests pass total, including all 7,776 motif combinations. Built the `/preview` browser book view with placeholder flat-vector art.
- **2026-06-25 (pivot)** — James reframed: **art is the primary product**, prose parked. New direction: freeform AI-generated **locked persistent** character/environment/style (not vector puppets); reference-image loop + LoRA premium; **own house styles only** (legal); lesson-explicitness dial. Logged D-014–017; flagged P-1 + new blockers B-2 (image stack, now top) + B-4 (legal review).
- **2026-06-25 (build)** — James confirmed: freeform OK (now D-018) and own-styles-only ("evoke the vibe, not names/characters" — D-016 confirmed). Delivered the image-stack shortlist. Built the **vendor-agnostic art shell**: `ImageProvider` seam + `placeholderProvider`, 5-style house registry (`houseStyles.ts`, attribute-only prompts), the name/description **firewall** (`brief.ts`), and the **`/studio`** describe→generate→iterate→lock character flow (placeholder art). 23 tests pass; typecheck + build clean.
- **2026-06-26** — Image stack decided (D-019). Built + staged the R-1 spike (real Gemini provider, verified against `@google/genai` 2.10). Wrote `STACK_REVIEW.md` (architecture tradeoffs + weak points). Key added; first run blocked on free-tier quota (B-6) → James enabled billing.
- **2026-06-26 (spike run)** — **Core bet VALIDATED (D-020).** Mia held consistent across 6 varied scenes. Added throttle + retry + resume + cost table. 1024² → upscaling needed (R-9).
- **2026-06-26 (iteration design + gate)** — Agreed the iteration model (D-021): parent iterates in intent (choose-from-3 + point-to-fix), we own craft/QA/rerolls; "moderation layer" → **Output Gate** (safety+quality+consistency+auto-reroll). Built the gate framework (4 tests) + concrete quality/consistency checks (Gemini vision) + safety dev stub. **Validated the gate caught both defects James flagged** (3-hands + small umbrella). Wrote `LAUNCH_GATES.md` (LG-1 safety provider as the headline launch gate, per James's request). Extracted shared `geminiClient` + `retry`. 27 tests pass.
- **2026-07-07 (series + R-7 chips)** — **Series shipped** (clone locked cast/settings/style → fresh storyboard; live-verified with "Mia and the Midnight Garden") and **R-7 first pass shipped** (curated starter chips + coaching hints on every blank creative box; scene chips use the beat's actual cast names). 47 tests.
- **2026-07-07 (model A/B)** — First harness payoff: `gemini-3.1-flash-image` ties on scores but defaults to landscape, over-locks wardrobe, and renders busier — **staying on 2.5-flash-image**; upgrade path documented (aspect config + wardrobe prompts + re-eval + price check).
- **2026-07-07 (cast fix + eval harness + guide)** — Cast point-to-fix (✏️ on locked characters, live-verified: flower behind the troll's ear). **R-11 resolved:** `eval:consistency` harness; baseline consistency 6/6, quality 5/6 (garbled-signage defect — the gate's reroll class). GUIDE.md rewritten for the real product.
- **2026-07-07 (progress streaming, W-3 resolved)** — Gate progress events → NDJSON streaming on all 4 generate endpoints → live narration in the studio chooser. Verified with timestamped stream (events across 37s). The 60–120s silent wait is gone.
- **2026-07-07 (print upscale, R-9)** — PDF export now upscales page art to 300 DPI at trim (sharp/lanczos → q90 JPEG). Verified on the demo book.
- **2026-07-07 (environment locking)** — Settings are now first-class locked references, same mechanism as cast: model + routes + studio section + beat assignment; scenes condition on the locked setting image. Live-verified on the demo book ($0.39): "the old stone bridge" held identical across two pages with different scenes/lighting. 45 tests.
- **2026-07-07 (point-to-fix, Slice 3)** — The "most magic" control, live-verified: `editImage` + edit-fidelity gate (changed ONLY the asked thing) + refine route + ✏️ UI. Test edit ("add a small red ladybug…") on a 3-character page: perfect targeted change, all else faithful, $0.117.
- **2026-07-07 (skin 3 + beat editing)** — Manuscript mode: paste → pages → prefilled storyboard (`from-manuscript` route + picker UI, tests). Beat-edit UI with honest art semantics (text edit keeps art; scene/cast edit clears it — verified live). **All three product skins now run on the one engine.** Note: production `next build` while dev server runs corrupts `.next` — restart dev after builds. 44 tests.
- **2026-07-07 (the spine + skin 2)** — B-7 resolved (prepay AI Studio billing). Built the **storyboard** (StoryBeat model + validation, `generateSceneVariants` 0/1/multi-cast through the gate, beats CRUD/generate/lock routes, storyboard UI with shared `VariantChooser`) and **PDF export** (`renderBookPdf`, 8in-square booklet, download button). **Ran the first real end-to-end book** (`npm run validate:e2e`, $0.74): 3 locked characters, 3 pages incl. two 3-character scenes — visually verified on-model everywhere, one autonomous reroll. Finding: environment (the bridge) drifted stone→wood → environment locking is the next consistency frontier. Shipped **skin 2 first pass**: 2 occasion templates + public-domain *{hero} in Wonderland* (content-linted by tests), `from-template` route + picker UI. 42 tests, tsc + build clean.
- **2026-07-06 (new plan + cast support)** — **D-023 adopted: one engine, three front-ends** (parent studio / classics & occasions / indie-author B2B), spine-first; **D-024:** no in-copyright novels (Narnia ruled out — derivative work), public-domain classics instead. Built **cast support on a persisted project model** (R-6 partial): `src/lib/project` schema + filesystem store (6 tests, traversal-guarded), full project/cast/lock/image API, `/studio` → cast studio (picker → roster → add → generate 3 → choose → lock), per-character consistency check in the gate (`GateContext.references[]`). 39 tests, tsc + build clean, live API loop smoke-tested. **B-7 discovered:** Google billing regressed — all paid calls fail (429/403) though the key is valid; real-generation smoke blocked until James re-enables billing. Side-find: Gemini 3.x image models now listed — trial via `GEMINI_IMAGE_MODEL` once billing is back.
- **2026-06-26 (Slice 2)** — **Server-side generation + studio chooser, proven end-to-end.** `generateCharacterVariants` (generate→gate→clean variants), `/api/generate-character` route (keys server-side, W-1/LG-6), `/studio` rewired to choose-from-3. Live test ("baby African elephant"): 3 clean variants, $0.117, 62s. Freeform + gate + chooser all verified. Latency ~60s → W-3 (progress streaming) now a felt need. **Next: Slice 3 — point-to-fix / inpaint.**
