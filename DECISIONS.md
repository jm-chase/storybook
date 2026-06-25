# Decisions Log

Dated record of every ambiguous call and the reasoning. Newest at the bottom of each status group. Open decisions (waiting on James) are flagged.

---

## Decided

### D-001 — v1 is local-first, single-user (2026-06-24)
**Decision:** v1 runs locally on James's machine — no accounts, no auth, no hosting, no database.
**Why:** Fastest path to a real printable booklet (the thing that proves the concept). Defers COPPA account surface and infra until there's a product worth shipping. Next.js deploys later with no rewrite.
**Alternatives considered:** deployed-no-accounts; deployed-with-accounts. Both add infra/COPPA surface now for no v1 benefit.

### D-002 — Stack is TypeScript / Next.js (App Router) (2026-06-24)
**Decision:** One TypeScript codebase (Next.js App Router) for wizard UI, generation pipeline, and PDF assembly.
**Why:** James chose "no preference — you pick." Single language to read/maintain solo; best ecosystem for the wizard + PDF work; grows into the deployed product without a rewrite. Python would mean juggling two languages once the UI gets real.

### D-003 — Generation model is `claude-opus-4-8`, theme-locked via structured outputs (2026-06-24)
**Decision:** Use the Claude API (`claude-opus-4-8`) for personalization. The model fills named slots inside a fixed skeleton, constrained by a per-skeleton JSON schema (structured outputs). It cannot return free-form plot.
**Why:** Theme-lock enforced structurally, not by instruction — there's no field for the model to author a story in. Opus 4.8 is the current default per the API reference.

### D-004 — Two-layer safety, single-vendor (2026-06-24)
**Decision:** (1) Input layer: deterministic per-field validation (character allowlists, length caps, injection-pattern screen) → then a Claude classifier pass on free-text. (2) Output layer: a separate Claude moderation pass on the finished story before preview/export. Both passes stay on Claude rather than a third-party moderation endpoint.
**Why:** Deterministic validation makes injection structurally impossible for narrow fields (a name field accepting only letters/spaces/hyphens can't contain "ignore previous instructions"). Keeping moderation single-vendor avoids exposing child-adjacent data to an extra third party — consistent with the COPPA-conservative, minimize-third-parties rule.

### D-005 — Illustration: pre-generated flat-vector scene library, composited (2026-06-24)
**Decision:** Flat-vector style. Build a fixed scene set per skeleton **once** as an offline asset step, hand-curate, then composite name/text onto reused scenes per story. Not one AI image per story instance.
**Why:** Style consistency, ~zero per-book cost, clean print-DPI export. The unique-image-per-story approach can't hold a consistent character/style and costs per render.
**Open sub-decision:** image-gen vendor + IP/licensing — see PROJECT_STATUS B-2.

### D-006 — PDF via `@react-pdf/renderer` + `pdf-lib` (2026-06-24)
**Decision:** Lay out each story page with `@react-pdf/renderer` (high-res image embedding for ~300 DPI), then impose into booklet signature order (2-up, double-sided) with `pdf-lib`.
**Why:** Pure JS, no headless browser to manage. Clean separation: layout vs imposition. POD later swaps only the imposition step for the vendor's page spec — nothing else changes.

### D-008 — v1 targets the 3–5 age band (2026-06-24)
**Decision:** First skeleton + craft analysis target ages 3–5.
**Why:** Short predictable sentences and procedural low-stakes conflict are simplest to write well and to illustrate — cleanest proof of concept. Ages 6–8 (more emotional-arc, longer text) come later.

---

## Open (waiting on James)

### D-007 — Working product name — OPEN
Shortlist: Storyloom, Tucked In, Little Chapters, Pagewright, Bedtime Press. Working folder name is `storybook` until decided.

### D-009 — Which structural traditions inform which theme/age-band — OPEN (blocked on craft analysis)
Per the brief, once `STORY_CRAFT_NOTES.md` exists we log an explicit mapping (e.g. "the 3–5 'starting school' skeleton borrows short-sentence, procedural-conflict structure") **before** writing skeleton content. Blocked on B-1 (reference-text upload).
