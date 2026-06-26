# Story skeletons

The **core creative product**. Each skeleton is a fixed beginning/middle/end structure with **named personalization slots** — written deliberately (informed by `STORY_CRAFT_NOTES.md`), not improvised per request.

A skeleton defines:
- The fixed narrative beats (text with `{slot}` placeholders).
- The named slots it exposes (e.g. `heroName`, `petName`) and their validation rules.
- Which fixed wizard options (theme, setting, sidekick, tone) it's valid for.
- The illustration scenes it maps to (in `assets/illustrations/<skeleton-id>/`).

The JSON schema derived from a skeleton's slots is what constrains generation (structured outputs) — the model can only return slot values, never free-form plot.

**Machine-readable skeletons live in `src/content/skeletons/` as typed TS modules** (D-013) — they're imported by the pipeline and renderer. The motif catalog is `src/content/motifs.ts`. This dir holds the human-facing doc.

First skeleton: `the-big-new-thing` (ages 3–5, ref-free draft — see `STORY_CRAFT_NOTES.md` and D-012). Render a sample with `node --import tsx scripts/sample.ts`.
