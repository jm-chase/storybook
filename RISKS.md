# Risk Register / Pressure Test

_Senior-engineer review of the whole product. Created 2026-06-25._
_Severity: **S1** = blocker (must resolve before building further on top) · **S2** = major · **S3** = moderate._

## Headline

We've built **outside-in**: scaffold, studio UI, style system, firewall, tracking docs. But the **entire product rests on one unproven claim** — that we can hold a freeform-described character visually **consistent across many pages**, in a locked style + environment, at print quality, affordably — and we have **tested it zero times**. And the **safety moderation that the freeform box requires is unbuilt.** Until those two are addressed, every additional UI feature is built on sand.

---

## S1 — Critical (resolve before more breadth)

### R-1. The core technical bet (character consistency) — ✅ LARGELY VALIDATED (2026-06-26)
Persistent character across pages IS the product. **Spike result (D-020):** character identity held strongly across 6 wildly different scenes on `gemini-2.5-flash-image`. The bet holds. Remaining work, not blockers: (1) lock **style** with a seed reference image (1/6 scenes drifted stylistically), (2) separate **identity from wardrobe** in scene prompts (model over-locked the outfit). Both are addressable and validate design choices already made (style seeds; identity model). **Downgraded from blocker.**

### R-2. Moderation — partially built; safety arm is a documented launch gate (2026-06-26)
Rescoped into the **Output Gate** (D-021). **Built + validated:** quality + consistency checks (Gemini vision) auto-reject defects/drift and reroll. **Still required before real users (`LAUNCH_GATES.md`):** the **safety/abuse/CSAM** arm (LG-1, currently a fail-loud dev stub) and **input-description moderation** (LG-2). A general classifier is not sufficient for child imagery — needs a specialized provider, fail-closed, first in the chain.
**Action:** Keep building behind the stub; LG-1/LG-2 are hard gates before launch, not before dev.

### R-3. Per-book cost & margin unknown — partially de-risked (2026-06-26)
Cost ≈ pages × iterations × generation (+ upscale + optional LoRA training). **Update:** Gemini 2.5 Flash Image is ~**$0.039/image**, so base image cost for a 6–8 page book + a few iterations is **under $1** — far below the earlier $5–20 worst case. Remaining unknowns: heavy iteration, upscaling, LoRA training (premium), and the *other* call types (moderation, personalization).
**Action:** Still instrument cost-per-generation from the first integration; set iteration soft-limits; recompute once moderation + upscale are in.

---

## S2 — Major

### R-4. IP-similarity in *outputs* (distinct from style names)
D-016 stops us *naming* protected styles, but a freeform description can still yield a recognizable protected **character** ("a yellow bear in a red shirt" → Pooh). Own-styles posture doesn't cover output similarity.
**Action:** Output IP-similarity screen + ToS liability terms + lean on the indemnified model (Firefly) for production. Reinforces why Firefly is the production choice.

### R-5. `ImageProvider` seam is too thin for the real pipeline
Only `generateCharacterSheet`. The real flow needs `generateScene(characterRef, environmentRef, style, pose/emotion)` with **multi-reference conditioning** + a moderation hook. Designing this now avoids a refactor.

### R-6. No book/project data model or persistence
"Lock the book" means persisting locked character/env/style + storyboard + images. There's no schema and no save/resume. A long multi-step flow with no save = drop-off + lost work.
**Action:** Define a `Project`/`Book` model (local filesystem now, cloud-ready) before extending the studio.

### R-7. Blank-box returns — the "we help the parent" promise is unbuilt
We removed the prompt box for safety, then reintroduced a freeform box for art. The product's stated value is *helping parents who can't verbalize craft* — but right now it's an empty textarea. Needs scaffolding: example chips, guided trait pickers, suggestion prompts, sensible defaults.

---

## S3 — Moderate

- **R-8. Story↔art integration undefined.** Words (rhythm/pacing/page-turns) + art + lesson-explicitness dial must combine in the storyboard; no model for that yet. Prose is parked but the integration seam isn't designed.
- **R-9. Print pipeline unproven — and upscaling confirmed needed (2026-06-26).** Gemini output is **1024×1024** (~3.4in @300 DPI). A picture-book page (~8in) needs ~2.3× **upscaling** (`sharp` resize and/or an AI upscaler). Plus full-bleed raster through booklet imposition and RGB→CMYK for POD. PDF/booklet path still unbuilt.
- **R-10. Mobile.** Parents will create on phones; current UI is desktop-ish inline styles.
- **R-11. No eval/integration tests for the art path.** Only pure-logic unit tests (good ones). The thing that matters most (consistency) has no harness — ties to R-1.
- **R-12. SDK debt.** `@anthropic-ai/sdk` 0.68 predates `output_config.format` (D-010). Revisit on integration.
- **R-13. Failure-path UX undesigned.** Generation failure, moderation block, rate limit, partial book — no flows.
- **R-14. Accounts/payments/COPPA resurface at hosting.** Fine to defer, but the data model (R-6) should not bake in assumptions that block them.
- **R-15. Secrets/generation must be server-side (architecture).** Real model calls carry secret keys and must run in Next route handlers / server actions, never the browser — also the enforcement point for moderation, rate limits, and cost caps. See `STACK_REVIEW.md` W-1. Fix with the first real integration.
- **R-16. Long-running generation needs async + progress.** A full book is minutes of image calls — can't be an inline HTTP request. Needs progress streaming now, a job/queue when hosted. See `STACK_REVIEW.md` W-3.
- **R-17. Specialized abuse/CSAM screening required.** A general "inappropriate?" classifier is not sufficient for child-character image generation. See `STACK_REVIEW.md` W-2 — hard gate with R-2.

- **R-18. Multi-character persistence — ✅ VALIDATED (2026-06-26).** Spike (`npm run spike:multichar`, D-022): three distinct locked characters (hero/sidekick/adversary) co-appeared in 2- and 3-character scenes with **no identity bleed** — each stayed itself, consistent style, distinctive props preserved. The multi-reference approach (`generateMultiCharacterScene`) works; $0.23. Remaining (build, not validate): cast data model + role (R-6), **per-character** consistency checking in the gate, studio cast-locking, storyboard "who's in this beat." Caveat: tested to 3-up; may degrade at 4–5+ (most scenes are 1–3, so acceptable). **Downgraded from major risk.**

_Full stack/architecture tradeoffs (framework, storage, PDF/CMYK, observability, etc.): see `STACK_REVIEW.md`._

---

## Recommended sequence (de-risk first)

1. **R-1 consistency eval spike (Gemini)** + R-3 cost instrumentation — prove or kill the core bet.
2. **R-2 moderation layer** (input + image output) — hard gate before real model usage.
3. If consistency holds: **R-5 full provider seam** + **R-6 project/book data model + save**.
4. **Thinnest MVP slice:** one character, one style, one environment, a short fixed storyboard (4–6 pages), real generation, moderated, locked → one printable PDF. Prove end-to-end magic before breadth.
5. Then breadth: R-7 freeform scaffolding, more styles/environments, **Firefly** for production, pacing + lesson-dial, R-9 print hardening.

**MVP definition:** the thinnest path to **one real, printed, consistent, moderated book.** Everything not on that path waits.
