# Storybook (working name — TBD)

A **parent-authored, AI-assisted, print-first** personalized children's storybook generator.

A parent uses a **structured wizard** (not a freeform prompt box) to co-author a personalized children's story — choosing a curated theme, setting, sidekick, and tone, plus a few narrow personalization fields (child's name, one or two specific details). The AI fills in personalization **within a pre-written story skeleton** for the chosen theme — it does not invent plot from scratch. The finished story is illustrated in a consistent, limited style and exported as a **print-ready PDF booklet** (fold-and-staple at home). Print-on-demand is a planned later phase, not v1.

This is a **parent-facing creative tool**, not a child-facing chatbot. The output is a static document. That framing drives the safety architecture.

---

## Core constraints (condensed — see the brief for full detail)

**Safety / content**
- No freeform prompt box. All input is structured: fixed themes, settings, sidekicks, tones + a small number of **narrow** labeled free-text fields.
- Free-text fields are treated strictly as **data**, never instructions. Prompt-injection defense is structural (allowlisted characters / length caps), not just "please ignore."
- Generation is **theme-locked** at the system level: the model personalizes within a fixed skeleton, it does not author open-ended plot.
- **Two-layer safety:** (1) validate/moderate free-text input before it reaches generation; (2) moderate the fully generated story before any preview or export.
- Parent always sees a **full preview** before any export. No auto-print, no skipping preview.
- COPPA-conservative from day one: parent account only (none in v1), minimal data, **no third-party tracking / ad / analytics SDKs**.

**Story quality**
- Story skeletons (beginning/middle/end beats, pacing) are the **core creative product** — written/refined deliberately, not AI-improvised per request.
- A **story-craft analysis** step precedes writing any skeleton (see `STORY_CRAFT_NOTES.md`, produced from uploaded reference texts).

**Illustration**
- Consistent, limited style (flat vector). Character consistency via a **reusable per-skeleton scene library** with personalization layered on top — not a unique AI image per story instance.
- Print-quality export (resolution / DPI / color) considered from the start.

**Output**
- v1 deliverable: print-ready PDF with **booklet imposition** for home double-sided printing + stapling.
- Print-on-demand (e.g. Lulu, Blurb) is a later phase — don't build fulfillment now, don't architect anything that blocks it.

**Gamification (future, not v1)**
- No loot-box / randomized rewards, no scarcity/FOMO/countdowns, no streak-loss punishment, no pay-to-skip-frustration. Any future mechanics must be deterministic and pressure-free.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| App shell | **Next.js (App Router) + TypeScript**, run locally | One language for wizard UI + pipeline + PDF; deploys later with no rewrite |
| Generation | **Claude API (`claude-opus-4-8`)** + structured outputs | Theme-locked slot-filling; schema makes "write your own plot" structurally impossible |
| Safety | Two-layer, single-vendor | Deterministic input validation + Claude classifier (in); Claude moderation pass (out) |
| Illustration | Pre-generated flat-vector scene library, composited | Style consistency, ~zero per-book cost, print-DPI clean |
| PDF | **`@react-pdf/renderer`** + **`pdf-lib`** | react-pdf lays out pages; pdf-lib imposes booklet signatures. Pure JS, no headless browser |
| Storage | Local filesystem (JSON) | Local-first v1: no DB, no auth, no hosting |

---

## Run locally

> Not yet wired end-to-end — this is the scaffold. Once dependencies are installed:

```bash
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm install
npm run dev                  # http://localhost:3000
```

---

## Repo map

```
src/app/            Next.js App Router (wizard UI + API routes)
src/lib/            Generation, safety/validation, PDF assembly modules
content/skeletons/  Story skeletons (the core creative product)
assets/illustrations/  Per-skeleton flat-vector scene libraries
stories-output/     Generated stories (gitignored — parent-owned data)
```

## Project docs

- **PROJECT_STATUS.md** — what's built / in progress / blocked (updated every session)
- **DECISIONS.md** — dated log of every ambiguous call and why
- **ACCOUNTABILITY.md** — session checklist, next-session re-entry point, decisions owed
- **GUIDE.md** — plain-language walkthrough of how the whole system fits together
- **STORY_CRAFT_NOTES.md** — structural analysis of reference texts (created during the craft step)

Current status at a glance: see **PROJECT_STATUS.md**.
