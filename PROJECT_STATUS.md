# Project Status

_Living document — updated every session. Last updated: 2026-06-25._

## Built (functionally working right now)

- **Repo scaffold — verified.** Next.js (App Router) + TypeScript project structure, `package.json`, `tsconfig.json`, `next.config.mjs`, `.gitignore`, `.env.example`. Placeholder landing page renders the project framing. `npm install` clean (99 pkgs), `tsc --noEmit` clean, `next build` succeeds (Next 15.5.19).
- **Tracking docs.** README, this file, DECISIONS, ACCOUNTABILITY, GUIDE — all seeded.
- **Directory skeleton** for skeletons (`content/skeletons/`), illustration assets (`assets/illustrations/`), and generated output (`stories-output/`, gitignored).

Nothing is wired end-to-end yet. No generation, no safety code, no PDF code, no wizard UI beyond the placeholder.

## In Progress

- Nothing actively mid-edit. Clean stopping point.

## Next up (see ACCOUNTABILITY.md for the ordered re-entry plan)

1. Input validation + prompt-injection defense layer (`src/lib/validation`) — ref-independent, foundational, can start before the craft analysis.
2. Story-craft analysis → `STORY_CRAFT_NOTES.md` — **blocked on reference-text upload** (see below).

## BLOCKERS (non-code) — need James's input

These are not coding decisions. Each is logged here with context + options so it doesn't get buried.

### B-1. Reference texts for the story-craft analysis — **BLOCKING the craft step**
The craft analysis (and therefore the first skeleton) can't start until you upload the handful of reference children's books/texts representing different structural traditions (procedural/predictable, emotional-arc, quieter/ambiguous-ending, etc.).
- **Need from you:** the reference texts (paste, file drop, or paths).
- **Until then:** I can proceed on the validation layer and scaffold, but not on skeletons.

### B-2. Image-generation vendor + IP/licensing — needed before building the illustration library
The flat-vector scene library is generated once as an offline asset step, then reused. Two open questions:
- **Which image model/tool** generates the library.
- **Commercial + print usage rights** for assets sold inside a paid product (and whether outputs are clean for that use).
- **Options:** (a) pick a model now and validate its commercial terms; (b) defer — the pipeline reads from a static `assets/illustrations/` folder, so this can be decided in parallel without blocking code. Currently deferred (option b).

### B-3. Working product name
Folder/working name is `storybook` for now. Shortlist to bring you: Storyloom, Tucked In, Little Chapters, Pagewright, Bedtime Press. Your pick gets logged in DECISIONS.md (D-007, open).

## Notes / risks

- Dependency versions in `package.json` are caret ranges; first `npm install` will resolve exact versions — confirm `next dev` + `tsc --noEmit` are clean before building on top.
