# Guide — How the whole system fits together

_Plain-language walkthrough so you can explain this product to someone without re-reading code. Updated as the architecture solidifies._
_Last updated: 2026-06-25._

---

## The one-sentence version

A parent answers a structured wizard; the AI personalizes a pre-written story skeleton (never inventing the plot); two safety checks run; the parent previews the finished, illustrated story; and it exports as a fold-and-staple PDF booklet.

## The pipeline, end to end

```
 Reference texts ──► STORY CRAFT ANALYSIS ──► SKELETON SELECTION ──► WIZARD
 (real books)        (structural notes)       (which structure for     (parent picks
                                               which theme/age)          theme, setting,
                                                                         sidekick, tone,
                                                                         + narrow fields)
                                                                              │
                                                                              ▼
        PDF BOOKLET ◄── ILLUSTRATION ◄── SAFETY (out) ◄── PERSONALIZATION ◄── SAFETY (in)
        (imposed,       ASSEMBLY          moderation       (Claude fills        (validate +
         fold & staple) (scene library    pass on the      skeleton slots,      moderate the
                         + name/text       finished story   theme-locked)        free-text
                         composited)                                             fields)
                              │                                                    │
                              └──────────────► PARENT PREVIEW ◄────────────────────┘
                                               (always shown before export)
```

### 1. Story craft analysis _(one-time, upstream)_
Before any skeleton is written, we study a handful of real children's books for **structure** (not style): sentence rhythm, pacing of conflict/resolution, type of conflict (procedural vs emotional), how explicit the moral is, repetition patterns, and how text and illustration relate. This goes in `STORY_CRAFT_NOTES.md`. It's structural learning only — the skeletons we write are original.

### 2. Skeleton selection _(design-time)_
Using those notes, we decide — and log in DECISIONS.md — which structural tradition informs which theme/age-band (e.g. "the 3–5 'starting school' skeleton uses short sentences and procedural conflict"). Then we write the skeleton: the fixed beginning/middle/end beats with **named slots** where personalization goes. Skeletons are the core creative product; they live in `content/skeletons/` and are written deliberately, not improvised per request.

### 3. The wizard _(parent-facing)_
The parent never sees a blank prompt box. They pick from fixed lists — theme, setting, sidekick, tone — and fill a small number of **narrow** labeled fields (child's name, one specific detail like a pet's name). That's the only input the system takes.

### 4. Safety, layer 1 — input
Before anything reaches the AI, each free-text field is checked two ways:
- **Deterministic validation:** allowed characters and length only (a name field accepts letters/spaces/hyphens, nothing else). This is why prompt injection can't work structurally — there's no field that accepts instruction-shaped text.
- **Classifier pass:** a Claude call screens the (now narrow) free-text for anything inappropriate.

Validated fields are treated as **data woven into the story**, never as instructions to the model.

### 5. Personalization _(the AI's only job)_
Claude (`claude-opus-4-8`) fills the skeleton's named slots, constrained by a JSON schema (structured outputs). Because the schema only has slots — no "story body" field — the model **cannot** author its own plot. It personalizes within the fixed structure. That constraint is what keeps the output from feeling like generic AI slop.

### 6. Safety, layer 2 — output
A separate Claude moderation pass reads the **fully assembled** story and must pass it before it can be rendered to a preview or PDF. Input was checked; now the finished artifact is checked.

### 7. Illustration assembly
Each skeleton has a small, reusable library of flat-vector scene illustrations (built once, offline, then reused). The system composites the child's name and story text onto the right scenes — it does **not** generate a fresh image per story. This is how the art stays consistent and stays cheap, and how it exports at print resolution.

### 8. Parent preview
The parent always sees the complete, illustrated story before any export option appears. No auto-print, no skipping this step.

### 9. PDF booklet export
The pages are laid out (`@react-pdf/renderer`) and then **imposed** into booklet signatures (`pdf-lib`) — reordered and placed 2-up so that printing double-sided, folding, and stapling produces a real little booklet, not loose pages. Print-on-demand later swaps only this imposition step for a vendor's page spec.

---

## Why it's built this way (the load-bearing choices)

- **Structured wizard, not a prompt box** → the whole safety model rests on input being constrained data, not free instruction.
- **Theme-locked skeletons** → quality and predictability; the AI personalizes, it doesn't improvise plot.
- **Two separate safety layers** → input is narrow and pre-checked; the output artifact is independently re-checked.
- **Reusable illustration library** → consistency + cost + print quality, which per-instance AI images can't deliver.
- **Local-first v1** → ship a real booklet fast; accounts/hosting/POD layer on later without a rewrite.

See DECISIONS.md for the dated reasoning behind each.
