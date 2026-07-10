import { getGeminiClient } from "./geminiClient";
import { withRetry } from "./retry";
import { GEMINI_VISION_MODEL } from "./outputGate/checks/geminiVision";
import { readImage } from "../project/store";
import { bibleContext } from "../project/bible";
import type { Project } from "../project/types";

// The DIRECTOR'S review (CRAFT_BAR G5) — the exacting eye the other two passes
// don't have. Continuity checks facts; narrative checks structure; this one
// judges CRAFT, page by page, the way a director reviews cuts: emotional
// truth, character acting (specific, readable feeling — not generic
// cheerfulness), composition (deliberate staging, breathing room), and wonder
// (the detail that makes a child look twice). Produces per-page scores and a
// concrete RETAKE list wired to point-to-fix.

export interface DirectorPageScore {
  page: number;
  /** 1–5 each. */
  emotionalTruth: number;
  acting: number;
  composition: number;
  wonder: number;
  note: string;
}

export interface DirectorRetake {
  page: number;
  what: string;
  fix: { kind: "refine" | "regenerate"; instruction: string };
}

export interface DirectorReport {
  projectId: string;
  createdAt: string;
  model: string;
  pagesReviewed: number;
  /** Average of all page scores, 1–5. */
  overall: number;
  pages: DirectorPageScore[];
  retakes: DirectorRetake[];
}

const INSTRUCTION =
  `You are the DIRECTOR of a children's picture-book studio, reviewing finished pages the way a demanding ` +
  `animation director reviews cuts. You receive each PAGE image in reading order with its text. ` +
  `Judge each page 1-5 on: ` +
  `"emotionalTruth" — does the image FEEL what the moment means, or is it merely illustrating the caption? ` +
  `"acting" — do the characters act with specific, readable feeling (posture, hands, gaze), not stock smiles? ` +
  `"composition" — is the staging deliberate: a clear focal point, depth, breathing room where the moment is quiet? ` +
  `"wonder" — is there a touch of observed, lived-in detail that rewards a second look? ` +
  `Score honestly: 5 is rare; 3 means competent but unremarkable. One short note per page. ` +
  `Then list RETAKES — only for pages where a specific change would clearly lift the page: ` +
  `kind "refine" with a targeted edit instruction (change one thing), or "regenerate" when the staging itself is weak. ` +
  `A strong page needs no retake. Do not invent problems. ` +
  `Respond ONLY with JSON: {"pages": [{"page": int, "emotionalTruth": int, "acting": int, "composition": int, ` +
  `"wonder": int, "note": string}], "retakes": [{"page": int, "what": string, ` +
  `"fix": {"kind": "refine"|"regenerate", "instruction": string}}]}`;

export async function directorReview(project: Project, root?: string): Promise<DirectorReport> {
  const pages = project.storyboard
    .map((beat, i) => ({ beat, page: i + 1 }))
    .filter((p) => p.beat.art);
  if (pages.length < 1) throw new Error("The director needs at least one finished page.");

  const labels: string[] = [];
  const parts: { inlineData: { mimeType: string; data: string } }[] = [];
  let n = 0;
  for (const { beat, page } of pages) {
    const img = await readImage(project.id, beat.art!.file, root);
    if (!img) continue;
    n += 1;
    labels.push(`Image ${n} is PAGE ${page}; its text: ${JSON.stringify(beat.text)}.`);
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.bytes.toString("base64") } });
  }

  const ai = getGeminiClient();
  const res = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_VISION_MODEL,
      contents: [{ text: `${labels.join(" ")} ${INSTRUCTION}${bibleContext(project.bible)}` }, ...parts],
      config: { responseMimeType: "application/json" },
    })
  );
  const raw = (res.candidates?.[0]?.content?.parts ?? [])
    .map((p) => (p as { text?: string }).text ?? "")
    .join("")
    .trim();
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : raw) as { pages?: unknown; retakes?: unknown };
  if (!Array.isArray(parsed.pages)) throw new Error(`malformed director verdict: ${raw.slice(0, 160)}`);

  const clamp = (v: unknown) => Math.min(5, Math.max(1, Math.round(Number(v)) || 1));
  const pageScores: DirectorPageScore[] = parsed.pages.map((p) => {
    const r = p as Record<string, unknown>;
    return {
      page: Number(r.page ?? 0),
      emotionalTruth: clamp(r.emotionalTruth),
      acting: clamp(r.acting),
      composition: clamp(r.composition),
      wonder: clamp(r.wonder),
      note: String(r.note ?? ""),
    };
  });
  const retakes: DirectorRetake[] = (Array.isArray(parsed.retakes) ? parsed.retakes : []).map((p) => {
    const r = p as Record<string, unknown>;
    const fix = (r.fix ?? {}) as Record<string, unknown>;
    return {
      page: Number(r.page ?? 0),
      what: String(r.what ?? ""),
      fix: { kind: fix.kind === "regenerate" ? "regenerate" : "refine", instruction: String(fix.instruction ?? "") },
    };
  });
  const all = pageScores.flatMap((p) => [p.emotionalTruth, p.acting, p.composition, p.wonder]);
  const overall = all.length > 0 ? Number((all.reduce((a, b) => a + b, 0) / all.length).toFixed(2)) : 0;

  return {
    projectId: project.id,
    createdAt: new Date().toISOString(),
    model: GEMINI_VISION_MODEL,
    pagesReviewed: pages.length,
    overall,
    pages: pageScores,
    retakes,
  };
}
