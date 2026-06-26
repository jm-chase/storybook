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

Not yet wired end-to-end: no Claude personalization pass, no output-moderation pass (layer 2), no print-ready PDF export (the booklet *file*; the on-screen preview exists), no full wizard flow.

## In Progress

- Nothing actively mid-edit. Clean stopping point.

## Next up (see ACCOUNTABILITY.md for the ordered re-entry plan)

1. **James's read on the first skeleton + motif model** — does the prose land? Are emotion/environment/lesson/feeling the right axes, and the curated values the right ones? This steers everything downstream.
2. Then, ref-independent options: (a) Claude personalization pass (light wording smoothing within the fixed structure); (b) output-moderation pass (layer 2); (c) the wizard UI that drives motif selection.
3. **Story-craft analysis** → `STORY_CRAFT_NOTES.md` — still blocked on reference-text upload (B-1); will revalidate the ref-free skeleton.

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
