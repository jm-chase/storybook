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

## Decisions I'm waiting on from you (top priority — art-first pivot)

The 2026-06-25 pivot makes illustration the primary product (D-014). Before I build the art engine I need:

1. **P-1 — okay the freeform character box?** It reverses your original "no freeform box" rule. Reconciliation: firewall it to the art pipeline (plot stays locked), extract a validated name/traits for the words, moderate both ends. Safety becomes "moderation + firewall," not "structurally impossible." Yes?
2. **D-016 — okay own-house-styles-only?** We never prompt protected names (Ghibli/Seuss/Carle/HP/LOTR) in production — we build & lock our own styles. Legal-safe + better branding. Yes?
3. **B-2 — want the image-stack shortlist next?** Scored on character-reference quality, commercial license + IP indemnification, print DPI, cost per book.
4. **Next build:** prototype the describe→generate→iterate→lock character loop (needs vendor + key), or the vendor-agnostic studio shell + locked-style-seed system now?

_(Earlier prose/motif read is now lower priority — prose is parked per your call.)_

---

## Running log

- **2026-06-24/25** — Kickoff. Scope + stack decided and confirmed. Repo scaffolded, all tracking docs created, decisions logged. Held the craft analysis pending reference uploads (the brief's explicit gate before any skeleton work).
- **2026-06-25** — Built the input-safety layer: deterministic validation + injection screen (`src/lib/validation`, 12 passing tests) and the Claude input-classifier pass (`src/lib/safety`, tool-forced structured output). Logged D-010 (structured output via forced tool call on SDK 0.68; migrate to `output_config.format` on SDK bump). Typecheck + build + tests all clean.
- **2026-06-25 (cont.)** — At James's direction, proceeded ref-free (D-012) to baseline output quality. Built the motif model (emotion/environment/lesson/feeling + sidekick, curated picklists — D-011), the first skeleton `the-big-new-thing` (ages 3–5, emotional-arc, 6 beats), and a deterministic renderer (no API key needed). 18 tests pass total, including all 7,776 motif combinations. Built the `/preview` browser book view with placeholder flat-vector art.
- **2026-06-25 (pivot)** — James reframed: **art is the primary product**, prose parked. New direction: freeform AI-generated **locked persistent** character/environment/style (not vector puppets); reference-image loop + LoRA premium; **own house styles only** (legal); lesson-explicitness dial. Logged D-014–017; flagged P-1 (freeform reverses the no-freeform-box rule — pending James's okay) and new blockers B-2 (image stack, now top) + B-4 (legal review). Existing prose scaffold/preview stand as proof. **Now waiting on James: P-1, D-016, B-2 shortlist, and next-build choice.**
