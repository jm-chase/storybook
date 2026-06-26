# Stack & Architecture Review

_Senior-engineer weigh-up of tooling, architecture, and weak points. 2026-06-26._
_Pairs with `RISKS.md` (product/delivery risks). This doc is about the build itself._

## Stack at a glance

| Layer | Current choice | Verdict |
|---|---|---|
| App framework | Next.js 15 (App Router) + TypeScript | ✅ Keep — but generation/keys MUST move server-side |
| Image gen | Google Gemini `gemini-2.5-flash-image` (now); Firefly + FLUX-LoRA (later) | ✅ Good; consistency unproven (spike), cost now known (~$0.039/img) |
| Text + moderation | `@anthropic-ai/sdk` 0.68 | ⚠️ Upgrade; needs an image-moderation + abuse layer |
| PDF/print | `@react-pdf/renderer` + `pdf-lib` | ✅ for home RGB v1; ❌ for POD (no CMYK/PDF-X) |
| Validation | `zod` (declared, unused) | ▶️ Put it to work on the project/data model |
| Storage | Local filesystem, no DB | ✅ for local v1; needs a storage seam + schema before persisting books |
| Tests | `node:test` + `tsx` | ✅ good unit coverage; missing eval + integration |
| Auth / payments / hosting | none (local-first) | ✅ correctly deferred; don't let the data model block it |

---

## Top architectural weak points (the critical few)

### W-1 — Secrets and generation must be server-side. The current client-side provider pattern is a hole.
`placeholderProvider` runs in the browser, which is fine for placeholders — but the **real** Gemini/Anthropic calls carry secret keys and **cannot** ship to the client. Generation + moderation must run in **Next route handlers or server actions**; the browser calls *our* endpoint, never the model directly. This also gives us the natural place to enforce moderation, rate limits, and cost caps. **Fix this as part of the first real integration**, not later — it's an architecture decision, not a cleanup.

### W-2 — Child-safety moderation needs a specialized abuse/CSAM layer, not just a general "is this inappropriate" classifier.
A product that generates child-character imagery must screen outputs for CSAM/abuse with purpose-built tooling (e.g. hash-matching / classifiers such as Thorn Safer, Google Cloud Vision SafeSearch, AWS Rekognition Moderation), in addition to our Claude text pass and a general vision pass. This is legal-and-ethical table stakes, not a nice-to-have. Treat it as a hard gate alongside R-2.

### W-3 — A whole book = many image calls = minutes. That can't be an inline HTTP request.
One book is N pages × possibly several iterations of image generation. Synchronous request/response will time out and gives a terrible UX. We need **async generation with progress streaming** (SSE/polling) and, when hosted, a **job/queue model**. Design the studio's generation step around "kick off → stream progress → assemble," not "await one big call."

### W-4 — The `ImageProvider` seam is too thin for the real pipeline (also R-5).
Today: `generateCharacterSheet` only. The product needs `generateScene(characterRef, environmentRef, style, pose/emotion)` with **multi-reference conditioning** + a moderation hook, and the abstraction must hide the fact that Gemini does this via inline images, Firefly via structure/style refs, and FLUX via LoRA/IP-adapter. Get this interface right **before** the second vendor or it leaks.

### W-5 — No project/book data model or persistence (also R-6).
"Lock the book" means persisting locked character/env/style refs + storyboard + generated images across a long, resumable flow. There's no schema and no save. This is where **zod** finally earns its keep (a validated `Project` model), and where we put a **storage seam** (local files now → object storage + a DB later).

---

## Area-by-area tradeoffs

### Framework — Next.js
Right call for one-language full-stack + a clean hosted path. The only correction is W-1: use **server actions / route handlers** for all model calls. Alternatives (Vite SPA + Fastify, Remix, TanStack Start) buy nothing here and cost us the integrated deploy story. **Keep.**

### Image generation — Gemini now, Firefly + FLUX later
- **Cost** is now a known quantity: ~**$0.039/image** (Gemini 2.5 Flash Image). A 6–8 page book with a few iterations is well under $1 in image cost — R-3 materially de-risked (still instrument it).
- **Consistency** is the open question → the spike.
- **Portability:** the seam (W-4) is what protects us from vendor lock-in. Firefly's value is **IP indemnification** (W-2/R-4 cover); FLUX-LoRA is the "perfect-lock" premium path. Sequence per D-019.
- **Print resolution:** Gemini supports up to ~2K output; home-printed small booklets are fine, larger trim sizes need an **upscale step** (see image processing).

### Text + moderation — Anthropic SDK
- **Upgrade off 0.68** to get `output_config.format` / `messages.parse()` (D-010) — cleaner structured outputs for the classifier and personalization passes.
- **Image moderation provider** is an open choice (Claude vision vs Google SafeSearch vs Rekognition vs specialized) — decide alongside W-2. Likely **defense-in-depth**: provider safety + our vision classifier + a specialized abuse screen.

### Storage & data — filesystem → DB
- Local v1: **JSON files + a zod-validated `Project` schema** behind a `StorageProvider` seam. Zero new deps, structured, testable.
- Hosted: **object storage** (S3/R2) for images + **Postgres** (or SQLite→Postgres) for projects. SQLite locally (via `better-sqlite3`/Prisma) is an option if we want migrations early; not required yet.
- **Decision to make:** JSON-files-now (simplest) vs SQLite-now (migratable). Recommend JSON + seam now; adopt a DB when we add accounts.

### PDF / print — react-pdf + pdf-lib
- **Home RGB v1:** react-pdf for page layout + pdf-lib for booklet imposition is fine. Full-bleed raster art embeds OK at RGB.
- **POD later:** vendors want **PDF/X with bleed + CMYK**; react-pdf is RGB-only. That's a **prepress gap** (likely Ghostscript or a vendor-side conversion) — fine to defer, but don't promise color-accurate POD until solved.
- **Alternative considered:** HTML/CSS → headless-Chromium PDF gives nicer print CSS (`@page`, bleed) but adds a heavy browser dep and still doesn't solve CMYK. Not worth it for v1.

### Image processing — print upscaling
AI output (~1–2K px) → ~300 DPI for print needs an **upscale/resize** step. `sharp` (libvips) covers resize/format/DPI metadata; true detail-upscaling wants an AI upscaler (Real-ESRGAN / vendor). Add `sharp` when we build export; flag native-dep in deploy.

### Testing & evaluation
- Unit coverage on pure logic is good. **Formalize the consistency spike into a repeatable eval** we re-run whenever we change model/prompt/style — it's our regression net for the thing that matters most.
- Add **integration tests** for the generation/moderation route handlers (mocked providers) and **visual regression** for the PDF once it exists.

### Observability & cost control
Every action costs money. Add a thin **telemetry seam**: per-generation cost + latency + outcome logging, and **per-book / per-session budget caps**. When hosted, **rate-limit** generation — an unauthenticated generate endpoint is a direct cost-attack vector (ties to W-1 and auth).

### Auth / payments / compliance (deferred, but shape the data model)
When hosted: Auth.js/Clerk + Stripe; ToS + content-liability terms; COPPA/privacy review (B-4). Don't build now — just ensure the `Project`/user model (W-5) doesn't bake in single-user assumptions that block multi-tenant later.

---

## What I'd change, and when

| When | Change |
|---|---|
| **With the first real Gemini integration** | Move generation+moderation **server-side** (W-1); build the moderation layer incl. abuse/CSAM screen (W-2); instrument cost (R-3) |
| **Before the studio persists a book** | Define the `Project` zod schema + `StorageProvider` seam (W-5); design async generation + progress (W-3); widen the `ImageProvider` seam (W-4) |
| **Before POD** | Prepress/CMYK + PDF-X pipeline; AI upscaling |
| **Before hosting** | Auth, payments, rate limiting, cost caps, DB, COPPA/legal review |
| **Soon, low-risk** | Upgrade `@anthropic-ai/sdk`; put `zod` to work; formalize the spike as a standing eval |
