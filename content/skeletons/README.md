# Story skeletons

The **core creative product**. Each skeleton is a fixed beginning/middle/end structure with **named personalization slots** — written deliberately (informed by `STORY_CRAFT_NOTES.md`), not improvised per request.

A skeleton defines:
- The fixed narrative beats (text with `{slot}` placeholders).
- The named slots it exposes (e.g. `heroName`, `petName`) and their validation rules.
- Which fixed wizard options (theme, setting, sidekick, tone) it's valid for.
- The illustration scenes it maps to (in `assets/illustrations/<skeleton-id>/`).

The JSON schema derived from a skeleton's slots is what constrains generation (structured outputs) — the model can only return slot values, never free-form plot.

_No skeletons written yet — gated on the story-craft analysis, which is gated on reference-text upload (PROJECT_STATUS B-1)._
