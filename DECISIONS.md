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

### D-010 — Structured model output via forced tool call, not `output_config` (2026-06-25)
**Decision:** The Claude classifier / moderation passes obtain schema-shaped output by **forcing a single tool call** (`tools` + `tool_choice`), not the newer `output_config.format` / `messages.parse()` API.
**Why:** The installed `@anthropic-ai/sdk` (0.68.0) predates `output_config.format` and `messages.parse()`. Forced tool-calling is the canonical, stable structured-output mechanism on this SDK and guarantees the response matches the schema. When we bump the SDK, `moderateInput.ts` can migrate to `output_config.format` (noted in a code comment). Tests run on Node's built-in `node:test` via `tsx` (one devDep) — extensionless TS imports match Next's resolution, so no separate test framework is needed.

---

### D-011 — Motif inputs are curated picklists, not free-text (2026-06-25)
**Decision:** The four motif dimensions James requested — **emotion, environment, lesson, feeling** — are implemented as curated selectable option lists, not free-text fields. They join **sidekick** (companion kind) as the steering dimensions; the parent also names the hero/sidekick and gives one detail via the existing free-text personalization slots.
**Why:** Free-text motifs would reopen the prompt-injection surface and break the no-freeform-box rule. Curated picklists preserve theme-lock and still give large combinatorial range (6×6×6×6 = 1,296 motif combinations on the first skeleton; 7,776 including sidekick). emotion (opening) → feeling (closing) deliberately form an **emotional arc**; lesson is embodied **implicitly** via an authored fragment, not stated as a moral; environment carries authored place fragments.
**Reversible if:** James wants a given motif as free-text — it would route through the validation + classifier layer like the name/detail fields. Flagged, not assumed.

### D-012 — Proceeding without reference texts, by direction (2026-06-25)
**Decision:** Drafted the first skeleton **before** the story-craft analysis, overriding the brief's hard gate.
**Why:** James explicitly asked to proceed ref-free to baseline unguided output quality. The skeleton is marked as a ref-free draft (see `STORY_CRAFT_NOTES.md`); its `tradition` field is self-described. D-009 (structural mapping) stays open; the skeleton will be revisited once references arrive.

### D-013 — Machine-readable content lives under `src/content/` (2026-06-25)
**Decision:** Typed skeletons and the motif catalog live in `src/content/` (`motifs.ts`, `skeletons/*.ts`), not the root `content/` dir.
**Why:** They're first-class TS modules imported by the pipeline (and later the wizard), so they belong inside `src/` for clean resolution and type-checking. Root `content/` keeps the human-facing README pointer. Deterministic renderer (`src/lib/skeleton/render.ts`) fills the skeleton with no model call — proves the skeleton stands alone and enables API-key-free preview/testing.

---

### D-014 — Pivot: illustration is the primary product; AI-locked reference art, not vector puppets (2026-06-25)
**Decision:** The art system is the thing to get right first ("art > prose" — parents massage emotional rhythm + art to WtWTA quality; words carry rhythm, art carries story). Characters/environments/styles are **AI-generated then locked as persistent references**, not deterministic vector puppets. Prose polish is parked (references + James's authorship handle it later).
**Why:** James wants freeform expressive character creation ("blond-haired spunky brown-eyed 4-yr-old boy" / "baby African elephant") in a chosen house style — only AI-reference generation delivers that range. Accepts that consistency becomes *engineered* (QA-gated), not deterministic, as the cost of expressive range.
**Supersedes:** D-005 (flat-vector scene library / vector-puppet idea) for characters. AI-as-offline-asset-step still holds, now extended to style seeds.

### D-015 — Character workflow: reference-image conditioning for the iterative loop; LoRA as premium (2026-06-25)
**Decision:** describe (freeform) → moderate → generate model sheet → parent iterates → **lock** character/environment/style → generate each scene conditioned on all locks → output-moderate → lock book. Generation happens **once at creation time**, then frozen (preserves "static document" + stable print). Reference-image conditioning for the live loop; per-character LoRA offered as a premium "perfect consistency" path. (Veo is video — for print-first v1 we use a still-image model with character-reference; motion is a future digital-edition idea.)

### D-016 — Own house styles only; never prompt protected names in production (2026-06-25)
**Decision:** We build our own named house styles defined by aesthetic *attributes* and locked from our own generated style seeds. We do **not** prompt commercial models with third-party names (Ghibli, Dr. Seuss, Eric Carle, Harry Potter, LOTR, etc.). Starter taxonomy: Painted Wonder (watercolor), Storybook Ink (crosshatch), Torn & Bright (collage), Bright & Round (flat vector), Wobbly World (whimsical line). Dropped LOTR/HP (wrong lane + most protected); flagged Seuss/Carle as the riskiest registers to even gesture at.
**Why:** Commercial kids' product = real copyright/trade-dress/trademark exposure on named styles. Owning our styles is both safer and better branding. See PROJECT_STATUS B-4 (legal review).

### D-017 — Lesson-explicitness dial (2026-06-25)
**Decision:** Add a "how hard the lesson lands" control, from *whisper* (carried by art + rhythm, never stated — WtWTA) to *spoken* (moral said outright). Default gentle. This is a key place the tool scaffolds parents who can't verbalize craft. Extends the lesson motif (D-011) with an explicitness axis.

---

## Pending confirmation (James to okay)

### P-1 — Freeform character field reverses the "no freeform box" hard constraint
The original brief's #1 rule was *no freeform prompt box, ever*. The freeform character description reverses it. Proposed reconciliation: **firewall** the description to the art pipeline only (never the plot; plot stays theme-locked), extract a validated name + trait tags for the words, and **moderate both ends** (Claude pass on the text incl. blocking real-people/celebrity/branded-character requests; image-moderation pass on every generated image + the finished book). Safety model shifts from "structural immunity" to "moderation + firewall." **Awaiting James's explicit okay before re-architecting the safety layer.**

---

## Open (waiting on James)

### D-007 — Working product name — OPEN
Shortlist: Storyloom, Tucked In, Little Chapters, Pagewright, Bedtime Press. Working folder name is `storybook` until decided.

### D-009 — Which structural traditions inform which theme/age-band — OPEN (blocked on craft analysis)
Per the brief, once `STORY_CRAFT_NOTES.md` exists we log an explicit mapping (e.g. "the 3–5 'starting school' skeleton borrows short-sentence, procedural-conflict structure") **before** writing skeleton content. Blocked on B-1 (reference-text upload).
