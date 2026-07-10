import { getGeminiClient } from "./geminiClient";
import { withRetry } from "./retry";
import { GEMINI_VISION_MODEL } from "./outputGate/checks/geminiVision";
import { readImage } from "../project/store";
import type { Project } from "../project/types";

// Book-level continuity pass: the review a human editor does by paging through
// the finished book — which page-level gate checks structurally CANNOT do
// (each one sees a single image). One vision call receives the locked cast +
// setting references and every finished page IN READING ORDER (with its text
// and scene description) and reports cross-page problems: character/wardrobe/
// size drift, location drift, art-vs-text contradictions, vanishing props,
// style breaks. Each issue carries an actionable fix suggestion — a targeted
// point-to-fix instruction, or a full page regenerate.
//
// Born from James's sequential review of Finn book #1 (2026-07-08), which
// caught exactly this class of defect by hand.

export interface ContinuityFix {
  kind: "refine" | "regenerate";
  /** 1-based page number the fix applies to. */
  page: number;
  /** For "refine": a short targeted edit instruction, ready for point-to-fix. */
  instruction: string;
}

export interface ContinuityIssue {
  /** 1-based page numbers involved. */
  pages: number[];
  severity: "minor" | "major";
  what: string;
  fix: ContinuityFix;
}

export interface ContinuityReport {
  projectId: string;
  createdAt: string;
  model: string;
  pagesReviewed: number;
  issues: ContinuityIssue[];
}

const INSTRUCTION_HEAD =
  `You are the continuity editor for a children's picture book. You receive labeled images: ` +
  `the locked reference for each CHARACTER, the locked reference for each SETTING, and every finished ` +
  `PAGE in reading order (each with its scene description and page text). ` +
  `Review the pages AS A SEQUENCE and report every continuity problem a careful human editor would catch: ` +
  `(1) a character whose face, colours, markings, or relative SIZE drifts between pages, or whose CLOTHING ` +
  `changes with no reason in the scene; ` +
  `(2) a recurring location whose design changes between pages set in the same place; ` +
  `(3) a page whose art contradicts its own text or scene description — a key action missing, or cause and ` +
  `effect disconnected (e.g. a character blowing at a thing while facing away from it); ` +
  `(4) objects that appear or vanish illogically between consecutive pages; ` +
  `(5) a page that breaks the book's art style, or has a border or frame while the others are full-bleed; ` +
  `(6) POSE REPETITION — a character drawn in the same or nearly the same pose on multiple pages (a cat sitting ` +
  `in the identical loaf on three pages): characters should act differently as the story moves; ` +
  `(7) TEXT-PROGRESS MISMATCH — the page image contradicts the action state or emotion its own text claims ` +
  `(text says "up and up they climbed" while the characters sit comfortably; text implies worry while faces ` +
  `read content); ` +
  `(8) anything else that would make a child or parent stop and say "wait, that's wrong". ` +
  `Report ONLY real problems — do not invent issues, and do not flag deliberate story changes (lighting or ` +
  `time-of-day following the scene, scene-motivated outfit changes, a house shown mid-destruction). ` +
  `For each issue, suggest the smallest fix: kind "refine" with a short targeted edit instruction for one ` +
  `page (changing only that detail), or kind "regenerate" when the page needs a full redo. ` +
  `IMPORTANT: every "pages" and "page" number in your JSON must be the PAGE number from the image labels ` +
  `("PAGE 3 of 6" → 3), NEVER the image's position in the sequence (reference images come first and don't count). ` +
  `Respond ONLY with JSON: {"issues": [{"pages": [int], "severity": "minor"|"major", "what": string, ` +
  `"fix": {"kind": "refine"|"regenerate", "page": int, "instruction": string}}]} — issues may be empty.`;

/**
 * Review a project's locked pages as a sequence. Requires at least 2 pages
 * with locked art. Throws on classifier failure — callers decide how to
 * surface that (the route 502s; the validator logs and continues).
 */
export async function reviewBookContinuity(project: Project, root?: string): Promise<ContinuityReport> {
  const pages = project.storyboard
    .map((beat, i) => ({ beat, page: i + 1 }))
    .filter((p) => p.beat.art);
  if (pages.length < 2) {
    throw new Error("Continuity review needs at least 2 pages with locked art.");
  }

  const labels: string[] = [];
  const parts: { inlineData: { mimeType: string; data: string } }[] = [];
  let n = 0;

  const push = async (file: string, label: string) => {
    const img = await readImage(project.id, file, root);
    if (!img) return;
    n += 1;
    labels.push(`Image ${n} is ${label}.`);
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.bytes.toString("base64") } });
  };

  for (const member of project.cast) {
    if (member.locked) {
      await push(member.locked.file, `the locked reference for the ${member.role} ${member.name} (${member.description})`);
    }
  }
  for (const env of project.environments) {
    if (env.locked) {
      await push(env.locked.file, `the locked reference for the setting "${env.name}"`);
    }
  }
  for (const { beat, page } of pages) {
    const envName = beat.environmentId
      ? project.environments.find((e) => e.id === beat.environmentId)?.name
      : undefined;
    await push(
      beat.art!.file,
      `PAGE ${page} of ${project.storyboard.length}${envName ? ` (set in "${envName}")` : ""} — scene: ${JSON.stringify(
        beat.sceneDescription
      )}; page text: ${JSON.stringify(beat.text)}`
    );
  }

  const ai = getGeminiClient();
  const res = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_VISION_MODEL,
      contents: [{ text: `${labels.join(" ")} ${INSTRUCTION_HEAD}` }, ...parts],
      config: { responseMimeType: "application/json" },
    })
  );
  const raw = (res.candidates?.[0]?.content?.parts ?? [])
    .map((p) => (p as { text?: string }).text ?? "")
    .join("")
    .trim();
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : raw) as { issues?: unknown };
  if (!Array.isArray(parsed.issues)) throw new Error(`malformed continuity verdict: ${raw.slice(0, 160)}`);

  // The model chronically reports image-sequence indexes instead of page
  // numbers (reference images precede pages). Remap deterministically: a
  // number beyond the page count that lands in range after subtracting the
  // reference count is an image index.
  const refCount = n - pages.length;
  const toPage = (v: unknown): number => {
    const x = Number(v);
    if (!Number.isFinite(x)) return 0;
    if (x > pages.length && x - refCount >= 1 && x - refCount <= pages.length) return x - refCount;
    return x;
  };

  const issues: ContinuityIssue[] = parsed.issues.map((it) => {
    const i = it as Record<string, unknown>;
    const fix = (i.fix ?? {}) as Record<string, unknown>;
    return {
      pages: Array.isArray(i.pages) ? i.pages.map(toPage).filter((x) => x >= 1) : [],
      severity: i.severity === "major" ? "major" : "minor",
      what: String(i.what ?? ""),
      fix: {
        kind: fix.kind === "regenerate" ? "regenerate" : "refine",
        page: toPage(fix.page),
        instruction: String(fix.instruction ?? ""),
      },
    };
  });

  return {
    projectId: project.id,
    createdAt: new Date().toISOString(),
    model: GEMINI_VISION_MODEL,
    pagesReviewed: pages.length,
    issues,
  };
}
