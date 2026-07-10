# The Craft Bar — Ghibli-grade process for this studio

_Created 2026-07-09 at James's direction: score the product against the creative
process and editorial rigor of Studio Ghibli, then close the gaps. This file is
the rubric, the scorecard, and the build list. Sources at bottom._

## The process we are holding ourselves to

What the research says Ghibli actually does, distilled to nine pillars:

1. **Image boards before story.** Miyazaki begins with loose watercolor
   *image boards* — mood, place, a single resonant image — not a script. The
   film grows out of pictures; story crystallizes around them.
2. **The e-konte is the single source of truth.** The storyboard IS the
   screenplay: drawing + dialogue + camera + timing in one artifact, and the
   story is allowed to change at the board.
3. **Layout discipline.** Every cut's composition is planned deliberately —
   camera, framing, and staging are authored decisions, not defaults.
4. **Color is a named discipline.** Michiyo Yasuda chose palettes per scene in
   consultation with the director — color follows time-of-day, material truth,
   and emotion, and it ARCs across the film.
5. **Backgrounds are place-craft.** Kazuo Oga's backgrounds are observed,
   layered, specific places — the world is a character.
6. **"Ma" — deliberate stillness.** Quiet beats between actions are what let
   emotion build; "if you have non-stop action, it's just busyness."
7. **Respect for children.** No dumbed-down stakes, no cardboard villains —
   "if you look at everything just as good or evil, you can't grasp the true
   nature of things."
8. **Observation of real life.** Character acting — gesture, weight, hesitation
   — comes from watching real people; specificity is the soul of the acting.
9. **Director-led correction.** One exacting eye reviews everything; retakes
   until it is right.

## Scorecard (2026-07-09, before the gap build)

| Component | Score /5 | Judgment against the bar |
|---|---|---|
| Character consistency engine (locked refs, per-char gate) | 4.5 | Strong — the hard problem is solved and validated |
| Setting consistency (locked environments) | 4 | Places persist; not yet "a character" |
| Style system (seeds + element vocabulary) | 4 | Real house-style discipline |
| Output Gate (safety/quality/consistency, fail-closed safety) | 4 | Catches defects; doesn't judge aesthetics |
| Editorial reviews (continuity + narrative) | 3.5 | Two real editor passes; no *director's* eye (acting/emotion/composition), no retake loop culture |
| Story generation | 3 | Competent arcs; lacks image-first ideation, ma, thematic depth pressure |
| Storyboard tooling (camera/shot/timing, shot list) | 3 | Notes exist but are **non-binding** — at Ghibli the layout drives the cut |
| Character acting/expression | 2.5 | Prompts demand motion, not specific *felt* acting |
| Pacing / "ma" | 2 | Narrative review checks arc, never asks for stillness |
| Image-board ideation | 1 | Nothing supports pictures-before-story |
| **Color design** | **1.5** | **Biggest gap** — one style palette per book; no per-page color script, no palette arc across the story |
| Pre-print editorial rigor | 2.5 | Reviews are optional and unbadged; nothing stands between a never-reviewed book and the print button |

## Gap build list (all built 2026-07-09 unless noted)

- **G1 Color script (Yasuda).** Per-page `colorScript` (time-of-day + palette +
  mood), AI-proposed for the whole book as an ARC, editable, and FED INTO the
  art prompt.
- **G2 Layout binding (e-konte).** `production.camera` becomes art-affecting:
  the camera/framing note is appended to the scene prompt. Shot notes, timing,
  and dialogue stay planning-only.
- **G3 Acting direction.** Scene prompts demand a specific, readable emotion
  and physical acting per character for THIS moment — not generic cheerfulness.
- **G4 Ma.** The narrative reviewer flags relentless pacing and recommends a
  quiet beat; the story engine is asked to write one quiet page per book.
- **G5 Director's review.** A third reviewer — the exacting eye: per-page
  scores on emotional truth, acting, composition, and wonder, with a concrete
  retake list wired to point-to-fix.
- **G6 Image boards.** Loose concept images generated from a premise BEFORE
  cast/story lock-in, living on the infinite board as inspiration cards.
- **G7 Pre-flight.** Print & export shows the editorial checklist (pages
  locked, continuity, narrative, director) with live status before the POD
  buttons.
- **G8 Story depth.** The story engine is pushed on Miyazaki's terms:
  adversaries with understandable wants, sensory observed detail, children
  treated as intelligent.

Deferred (bigger than this pass): outline-color variation per lighting
(Yasuda's cel technique), true layout drawings as a distinct artifact,
observation/reference photo attachment, retake history analytics.

## Sources

- [The Image Boards of Hayao Miyazaki — Animation Obsessive](https://animationobsessive.substack.com/p/the-image-boards-of-hayao-miyazaki)
- [What are Storyboards or Ekonte? — Discover Ghibli](https://discoverghibli.com/what-are-storyboards-or-ekonte/)
- [How Hayao Miyazaki builds a story — Story Field Notes](https://storyfieldnotes.substack.com/p/how-hayao-miyazaki-builds-a-story)
- [Michiyo Yasuda — Wikipedia](https://en.wikipedia.org/wiki/Michiyo_Yasuda)
- [Kazuo Oga's painting process — Open Culture](https://www.openculture.com/2021/01/a-look-inside-the-painting-process-of-the-studio-ghibli-artist-kazuo-oga.html)
- [Miyazaki on 'Ma' — ScreenCraft](https://screencraft.org/blog/hayao-miyazaki-says-ma-is-an-essential-storytelling-tool/)
- [Miyazaki's philosophy — Popverse](https://www.thepopverse.com/hayao-miyazaki-studio-ghilbi-quotes-quote) · [Orion Magazine](https://orionmagazine.org/article/the-worlds-of-hayao-miyazaki/)
