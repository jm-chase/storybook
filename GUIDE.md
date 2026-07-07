# Guide — How the whole system fits together

_Plain-language walkthrough so you can explain this product to someone without re-reading code. Updated as the architecture solidifies._
_Last updated: 2026-07-07 (rewritten after the art-first pivot D-014 and the one-engine/three-skins plan D-023)._

---

## The one-sentence version

One **illustration engine** — locked persistent characters, locked settings, a house art style, a quality gate on every image, and a print-ready PDF at the end — worn by three product skins: a parent co-authoring studio, prefilled classics & occasion books, and a manuscript-in/illustrated-book-out service for indie authors.

## The engine, end to end

```
 DESCRIBE            LOCK THE CAST              LOCK THE SETTINGS         STORYBOARD
 "a blond, spunky ─► generate 3 clean options ─► same mechanism for  ─►  pages: scene +
  4-year-old girl"    (behind the gate),          places ("the old        typeset text +
  name = separate,    parent picks one, LOCKED    stone bridge")          who's in it +
  validated field     forever as the reference                            where it happens
                                                                              │
                                                                              ▼
 PRINT PDF ◄────── PAGE ART, page by page ◄──────────────────────────────────┘
 (cover + pages,   each scene generated WITH the locked cast refs + setting ref,
  art upscaled     through the OUTPUT GATE (safety → quality → per-character
  to 300 DPI,      consistency), auto-rerolled until 3 clean options exist;
  text typeset,    parent chooses one per page, then can ✏️ POINT-TO-FIX
  never AI-drawn)  ("make the umbrella bigger") — targeted edit, gate-enforced
```

Everything generates **server-side** (the API key never reaches the browser) and **streams progress live** ("🎨 drawing option 2 of 3… 🔍 checking… ↻ caught a flaw — redrawing…"), so the parent watches the gate work for them.

### The locks (why pages stay consistent)

- **Cast lock** — each character (hero / sidekick / adversary / friend) is generated once from a freeform description, chosen from 3, then frozen as a reference image. Every scene passes those references to the model with "keep EACH character exactly, don't blend." Validated: 3 characters co-appear with zero identity bleed.
- **Setting lock** — same mechanism for places. Validated: the same stone bridge held across different pages, scenes, and lighting.
- **Style lock** — one house style per book (our own named styles, attribute vocabulary only — never third-party names, D-016). The style freezes the moment the first character locks.

### The Output Gate (every image passes or is redrawn)

1. **Safety** — currently a fail-loud dev stub; a specialized provider is a launch gate (LG-1), not a dev gate.
2. **Quality** — anatomy defects (extra hands), out-of-proportion props, leaked text. This check has independently caught real defects a human spotted.
3. **Consistency** — every character in the frame is compared against its own locked reference; scenes that drift get rerolled. For point-to-fix edits this becomes **edit fidelity**: the result must differ from the original *only* by the requested change.

### The iteration model (D-021)

The parent iterates in **intent**, never prompt-craft: choose from 3, or point at a thing and say it plainly. We own prompts, composition, defect QA, and rerolls. "Direct your illustrator, not debug the AI."

### Text

Page text is the parent's/author's words, **typeset at layout time** — never rendered by the image model (so no garbled AI lettering). Art and words are separate tracks that meet on the page.

## The three skins (D-023) — one engine, descending creative burden

1. **Parent studio** — full co-authoring: describe cast, lock settings, write pages, generate art. For creative parents.
2. **Classics & occasions** — prefilled books (new sibling, first day of school, *{hero} in Wonderland* — public domain only, D-024): the parent adds only their child's name + look; cast and pages arrive written.
3. **Indie-author studio (B2B)** — paste a manuscript, one paragraph per page; the storyboard arrives prefilled; assign cast, refine scenes, generate, export. Authors own their text, pay real money, and human illustration costs $3–15k — this is the enterprise story.

## Safety posture (what changed from the original brief)

The original "no freeform box, ever" rule was consciously reversed (D-018) for character/setting/scene **descriptions**, reconciled by a **firewall**: freeform text drives ART ONLY and never steers the plot; names are separate, strictly-validated fields; and every *output* image passes the gate. Before real users, the launch gates in `LAUNCH_GATES.md` apply (specialized CSAM screening, input moderation, rate/cost caps, server-held lock candidates).

## Economics (measured, not estimated)

~$0.039/image. A full real book (3 locked characters + 3 gated pages) cost **$0.74** end to end. Heavy iteration books project $1–3. Gate rerolls and vision checks are included in those numbers.

## What's deliberately NOT built yet

Prose generation (skeletons exist but are parked — D-014; references B-1 still pending), accounts/payments/hosting (D-001 local-first), POD prepress (bleed/CMYK/imposition — R-9 remainder), style-seed locking, and everything in `LAUNCH_GATES.md`.

See `DECISIONS.md` for the dated reasoning behind every call, `PROJECT_STATUS.md` for exact build state, and `RISKS.md` for the pressure-test register.
