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

## Decision I'm waiting on from you (one thing)

✅ Freeform (D-018), ✅ own-styles (D-016), ✅ shortlist delivered, ✅ studio shell + style-seed system built (`/studio`).

**The one open call: pick the image stack (B-2).** My framing:
- **Primary model** — *safety-first* **Adobe Firefly** (IP-indemnified — strongest legal cover for a paid kids' product) **vs** *iteration-feel* **Google Gemini image** (best at the describe→tweak→lock loop you want).
- **Premium tier** — **FLUX-LoRA** for "perfect-lock" consistency once a character is chosen.
- Then we verify current ToS/indemnity (B-4) before committing.

Once you pick, I wire it into the `ImageProvider` seam (no UI change), turn on the moderation passes, and generate the real locked style seeds.

---

## Running log

- **2026-06-24/25** — Kickoff. Scope + stack decided and confirmed. Repo scaffolded, all tracking docs created, decisions logged. Held the craft analysis pending reference uploads (the brief's explicit gate before any skeleton work).
- **2026-06-25** — Built the input-safety layer: deterministic validation + injection screen (`src/lib/validation`, 12 passing tests) and the Claude input-classifier pass (`src/lib/safety`, tool-forced structured output). Logged D-010 (structured output via forced tool call on SDK 0.68; migrate to `output_config.format` on SDK bump). Typecheck + build + tests all clean.
- **2026-06-25 (cont.)** — At James's direction, proceeded ref-free (D-012) to baseline output quality. Built the motif model (emotion/environment/lesson/feeling + sidekick, curated picklists — D-011), the first skeleton `the-big-new-thing` (ages 3–5, emotional-arc, 6 beats), and a deterministic renderer (no API key needed). 18 tests pass total, including all 7,776 motif combinations. Built the `/preview` browser book view with placeholder flat-vector art.
- **2026-06-25 (pivot)** — James reframed: **art is the primary product**, prose parked. New direction: freeform AI-generated **locked persistent** character/environment/style (not vector puppets); reference-image loop + LoRA premium; **own house styles only** (legal); lesson-explicitness dial. Logged D-014–017; flagged P-1 + new blockers B-2 (image stack, now top) + B-4 (legal review).
- **2026-06-25 (build)** — James confirmed: freeform OK (now D-018) and own-styles-only ("evoke the vibe, not names/characters" — D-016 confirmed). Delivered the image-stack shortlist. Built the **vendor-agnostic art shell**: `ImageProvider` seam + `placeholderProvider`, 5-style house registry (`houseStyles.ts`, attribute-only prompts), the name/description **firewall** (`brief.ts`), and the **`/studio`** describe→generate→iterate→lock character flow (placeholder art). 23 tests pass; typecheck + build clean. **Now waiting on James: the B-2 image-stack pick (Firefly vs Gemini primary; FLUX-LoRA premium).**
