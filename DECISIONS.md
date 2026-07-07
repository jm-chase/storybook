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

### D-016 — Own house styles only; never prompt protected names in production (2026-06-25) — ✅ CONFIRMED by James
**Decision:** We build our own named house styles defined by aesthetic *attributes* and locked from our own generated style seeds. We do **not** prompt commercial models with third-party names (Ghibli, Dr. Seuss, Eric Carle, Harry Potter, LOTR, etc.) or generate their copyrighted characters. Starter taxonomy: Painted Wonder (watercolor), Storybook Ink (crosshatch), Torn & Bright (collage), Bright & Round (flat vector), Wobbly World (whimsical line). Dropped LOTR/HP (wrong lane + most protected); flagged Seuss/Carle as the riskiest registers to even gesture at.
**James's framing (2026-06-25):** "We can legally *evoke the vibe* of these styles but not use their names as it's copyright protected, or use their copyrighted characters." → exactly the posture: attribute vocabulary that evokes a register, never a name or a protected character.
**Why:** Commercial kids' product = real copyright/trade-dress/trademark exposure on named styles. Owning our styles is both safer and better branding. See PROJECT_STATUS B-4 (legal review).
**Implemented:** `src/content/houseStyles.ts` — 5 styles, attribute-only `promptFragment`s, no third-party names.

### D-017 — Lesson-explicitness dial (2026-06-25)
**Decision:** Add a "how hard the lesson lands" control, from *whisper* (carried by art + rhythm, never stated — WtWTA) to *spoken* (moral said outright). Default gentle. This is a key place the tool scaffolds parents who can't verbalize craft. Extends the lesson motif (D-011) with an explicitness axis.

---

### D-018 — Freeform character field allowed, firewalled + moderated (2026-06-25) — ✅ CONFIRMED by James (was P-1)
**Decision:** A freeform character-description field is allowed, reversing the original brief's "no freeform box, ever" rule. Reconciliation, now in force: **firewall** the description to the art pipeline only (never the plot; plot stays theme-locked); the hero's **name is a separate structured + validated field** shared with the story; **moderate both ends** (Claude pass on the description incl. blocking real-people/celebrity/branded-character requests; image-moderation pass on every generated image + the finished book). Safety model is now "moderation + firewall," not "structural immunity," for this field.
**Implemented (structural half):** `src/lib/art/brief.ts` separates validated `name` from freeform `description`; studio uses two distinct fields. Content moderation (the Claude input pass + image output pass) wires in at generate time with the chosen provider + key.

### D-022 — Multi-character persistence validated; cast is a v1 must-have (2026-06-26)
**James:** multiple persistent characters (hero + sidekick + adversary) are **essential to v1**, not optional.
**Finding (R-18):** the multi-character spike passed — 3 distinct locked characters co-appeared in 2- and 3-character scenes with **no identity bleed**, consistent style, distinctive props preserved. Validated via `generateMultiCharacterScene` (pass each character's locked reference + a labelled "keep each, don't blend" instruction). Gemini accepts multiple reference images; the approach is sound.
**Now buildable on a proven foundation:** (1) **cast data model** — each character: brief, **role** (hero/sidekick/adversary), locked reference (part of the project model, R-6); (2) **per-character consistency check** in the gate (current check compares to one ref → extend to verify each character vs its own ref); (3) studio support for locking a **cast**, not one character; (4) storyboard tracks who appears in each beat.
**Caveat:** validated to 3 characters together; may degrade at 4–5+ (most picture-book scenes are 1–3 — acceptable).

### D-021 — Iteration model + Output Gate (2026-06-26)
**The principle (James agreed):** the parent iterates in **intent**, never in prompt-craft. We own the prompt engineering, composition, defect cleanup, and rerolls. "Direct your illustrator," not "debug the AI." This protects the core promise (help parents who can't verbalize craft) — a freeform image-prompt box per page would rebuild the blank-box problem.
**Three problem classes, three owners:** random defects (extra limbs) → us, auto-caught + rerolled; directable attributes (umbrella size) → parent intent, we translate to a targeted edit; systematic aesthetics (rule-of-thirds, composition) → us, baked into prompts/style. **James's refinement:** prop **proportion/scale** (e.g. the too-small umbrella) belongs in the quality check, not parent iteration.
**Output Gate (replaces "moderation layer" — broader scope):** a server-side pipeline every generated image passes through, doing three jobs with the same infrastructure:
  1. **Safety** — block inappropriate content (orig. reason; needs a specialized provider — W-2).
  2. **Quality** — detect anatomy defects, **prop proportion/scale**, leaked text → auto-reject + reroll.
  3. **Consistency** — verify still-same-character + in-style → reroll on drift (reuses `consistencyJudge`).
With **auto-reroll** up to a per-book budget, the parent only ever sees clean candidates.
**Iteration UX:** **choose from 3** clean variants per page (choose, don't engineer) + intent nudges (feeling/camera/light) + **point-to-fix / inpaint** (tap the defect, say it plainly → targeted region edit). James: point-to-fix is **the most crucial / most magic** control — in for v1.
**Cost/latency:** the gate adds vision calls + rerolls (~2–3× base → still ~$1–3/book) and multiplies per-page latency → reinforces async generation + progress (W-3).
**✅ Validated (2026-06-26)** against the spike images via Gemini vision (`npm run validate:gate`): the **quality** check independently caught *both* defects James spotted by eye — the **3-hands** on scene 04 ("a third distinct hand holding an open umbrella") **and** the **too-small umbrella** on scene 02 ("a key prop badly out of proportion… far too small"). The **consistency** check correctly confirmed same-character across all. **Calibration finding:** the consistency judge is *lenient on subtle style drift* (it passed scene 06) — so **style consistency should be enforced by the locked style-seed (D-020), not the post-hoc judge**; the judge is for character identity. Safety arm is a documented dev stub → `LAUNCH_GATES.md` LG-1.

### D-020 — Consistency spike result: core bet validated, with 2 refinements (2026-06-26)
**Finding (R-1):** Ran the spike on `gemini-2.5-flash-image` — one character ("a blond-haired, spunky, brown-eyed 4-year-old girl in a red raincoat", Painted Wonder style) → reference sheet → 6 scenes varying pose/emotion/environment (bed, rainy forest, school door, brave step, seaside, asleep). **Character identity held strongly across all 6** (blond hair, signature blue bow, red raincoat, navy leggings, yellow boots, rainbow umbrella, brown eyes). Emotion read clearly per scene. **The central technical claim is substantially de-risked.** Cost: 7 images, ~$0.27.
**Refinement 1 — style drift:** 1 of 6 scenes (the "asleep at home") drifted stylistically (more rounded/iconographic + a frame border vs. the watercolor of the others). → Confirms we must lock style via a **style-seed reference image**, not just a text `promptFragment`. Populate `houseStyles.ts` `seedRefs` (currently empty). **✅ RESOLVED 2026-07-07:** curated style plates checked in at `assets/styleSeeds/<styleId>.jpg` (512px, one per style, same neutral meadow subject; 2 candidates each via `npm run seeds:candidates`, hand-curated — notably `bright-and-round` #1 rejected for kawaii faces on scenery, a content-leakage risk). `getStyleSeed()` loads them; every character/scene/environment generation now passes the seed as the FIRST labeled reference with a style-only instruction (match technique/texture/palette, do NOT copy subject). Live-validated (`npm run validate:seeds`): painted-wonder held on a character sheet + an unrelated night-bakery scene with zero content leakage from the plate. Deliberately unseeded: point-to-fix refine (the original image is its own style anchor) and eval-harness `generateScene` (battery comparability).
**Refinement 2 — outfit over-locking:** the model treated the raincoat as part of identity (she wears it in bed). → Scene prompts must **separate identity (face/hair/colours) from wardrobe** so outfits can change while the character stays recognizable.
**Also noted:** incidental text leakage ("SCHOOL" rendered on a building despite "no text") — manage via prompt + an output check; our captions are typeset separately, never model-rendered. Resolution is 1024² (see R-9 — upscale needed for print).

### D-023 — Master plan: ONE ENGINE, THREE FRONT-ENDS (2026-07-06) — ✅ ADOPTED by James
**The strategic reframe (now the plan):** the company asset is the **engine** — persistent locked cast + house styles + Output Gate + (upcoming) storyboard + print pipeline. The engine is **text-source-agnostic**: nothing in it cares whether the text came from our wizard, a public-domain classic, or an author's manuscript. Three product skins sit on the same spine, with descending creative burden on the customer:
1. **Parent studio** (current build) — full co-authoring wizard for creative parents. v1 consumer product.
2. **Classics & occasions** — public-domain classics re-illustrated/personalized ("your child walks through Wonderland alongside Alice") + occasion templates (new sibling, first day of school, potty training, moving, birthday). The mass-market skin: parent supplies near-zero prose. Directly answers R-7 (creative pressure / blank-box problem).
3. **Indie-author illustration studio (B2B)** — manuscript in, consistently-illustrated print-ready book out, for self-published children's authors (they own their text → no IP problem; businesses → no COPPA in the creation flow; real willingness-to-pay vs $3–15k human illustration). The *enterprise* story.
**Build implication:** finish the consumer **spine first** — cast/project data model → storyboard → gated scene generation → print-ready PDF — because all three skins need that exact spine. Skins are thin front-ends added after the spine produces one real book end-to-end.
**Retention lever noted:** "same cast, new adventure" series — once a cast is locked, book #2 is nearly free; ranked the highest-leverage post-spine feature.

### D-024 — NO illustration of in-copyright novels; public-domain classics instead (2026-07-06)
**Decision:** James floated "illustrate an existing novel a child is reading" (example: *The Lion, the Witch and the Wardrobe*). The instinct is right — the engine is text-agnostic — but the example is legally dead: Narnia is under copyright (~2034 UK, mid-2040s US) and its characters are protected; generating/selling illustrations of a copyrighted novel's characters and scenes is a **derivative work** — clearly infringing, unlike our style-evocation posture (D-016). **We will not build against in-copyright texts.**
**What we build instead (skin #2 of D-023):** **public-domain classics** — Alice in Wonderland, Oz, Grimm, Andersen, Aesop, Peter Rabbit — free to illustrate, sell, and personalize. Same product feeling James wanted (beloved existing story, zero prose burden) with no legal exposure. Publisher licensing of in-copyright catalogs is noted as a possible long-term BD direction, not a build target.
**Guard:** per-title public-domain verification (US + target markets) before adding any classic to the catalog; some works' status varies by jurisdiction (e.g. Peter Pan's special UK status).

### D-019 — Image stack: both Gemini + Firefly, sequenced (not parallel) (2026-06-25)
**Decision:** Ship-destination is **both** — Google Gemini image for the iterate-and-lock feel, Adobe Firefly (IP-indemnified) for production/legal cover, FLUX-LoRA as the premium "perfect-lock" tier. James said "do both."
**Sequencing (senior-eng amendment):** do them **in series, not parallel.** (1) Integrate **Gemini first** purely to validate the core bet (character consistency across pages) + wire moderation end-to-end. (2) Only once that's proven, add **Firefly** for production/indemnity behind the same `ImageProvider` seam. Rationale: two integrations (two SDKs, two moderation behaviors, two sets of quirks) before the central claim is proven doubles surface for zero validated value. Both remain in the plan.
**Verify (B-4):** current commercial terms + indemnity for both before committing spend.

---

## Open (waiting on James)

### D-007 — Working product name — OPEN
Shortlist: Storyloom, Tucked In, Little Chapters, Pagewright, Bedtime Press. Working folder name is `storybook` until decided.

### D-009 — Which structural traditions inform which theme/age-band — OPEN (blocked on craft analysis)
Per the brief, once `STORY_CRAFT_NOTES.md` exists we log an explicit mapping (e.g. "the 3–5 'starting school' skeleton borrows short-sentence, procedural-conflict structure") **before** writing skeleton content. Blocked on B-1 (reference-text upload).
