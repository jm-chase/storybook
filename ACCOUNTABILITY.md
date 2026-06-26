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

## What I need from you (one action + one fyi)

1. **Add `GEMINI_API_KEY` to `.env.local`** (copy from `.env.example`), then run **`npm run spike:consistency`**. Open `spike-output/index.html` and eyeball whether the 6 scenes are the *same Mia*. (If your `ANTHROPIC_API_KEY` is also in `.env.local`, you'll get an automated same-character score too.) That one run de-risks the most important assumption in the product. ~$0.27.
2. **FYI — image stack settled** (D-019): both, Gemini-first then Firefly, FLUX-LoRA premium. Cost is now known (~$0.039/image → <$1/book).

**✅ RESOLVED (2026-06-26):** billing on ($25 credit), spike ran to completion. **Core bet validated (D-020)** — Mia held consistent across 6 varied scenes. Spike now throttled (6s) + resumable + prints a live cost table. Cost ~$0.27 for 7 images; per-book projections: lean $0.31 / typical $0.94 / heavy $1.87.

## Decision I'm waiting on from you (one: the safety provider)

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
- **2026-06-26 (spike run)** — **Core bet VALIDATED (D-020).** Mia held consistent across 6 varied scenes on `gemini-2.5-flash-image`; R-1 downgraded from blocker. Added throttle (6s) + retry (429/503) + resume + a live cost table + `cost.ts` (per-image/page/iteration projections). Confirmed 1024² output → upscaling needed for print (R-9). Refinements logged: style-seed locking, identity/wardrobe separation, incidental-text handling. **Next: James to choose the next build (recommend: moderation layer + server-side generation).**
