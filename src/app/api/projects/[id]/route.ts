import { NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/project/store";
import { isValidStyleId } from "@/lib/styles/registry";
import { screenFields } from "@/lib/safety/moderateFreeform";
import { sanitizeBible } from "@/lib/project/bible";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id).catch(() => null);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });
  return NextResponse.json({ project });
}

/** Update title / style. Style changes are blocked once any cast member is locked —
 * locked references were generated IN a style; changing it would silently break
 * consistency (D-020: style is enforced by the locked seed/reference). */
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id).catch(() => null);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const b = body as { title?: unknown; styleId?: unknown; board?: unknown; bible?: unknown };

  // North Star (story bible): screened — its text steers the reviewers.
  if (b.bible !== undefined) {
    const { bible, texts } = sanitizeBible(b.bible, project.storyboard.length);
    if (Object.keys(texts).length > 0) {
      const screenedBible = await screenFields(texts);
      if (!screenedBible.ok) return NextResponse.json({ error: screenedBible.message }, { status: screenedBible.status });
    }
    if (Object.keys(bible).length > 0) project.bible = bible;
    else delete project.bible;
  }

  // Board layout: presentational positions + sticky notes. Notes are private
  // planning text (never reach the image model or the book), so they get shape
  // and length validation, not the content screen.
  if (b.board !== undefined) {
    const positions = (b.board as { positions?: unknown })?.positions;
    if (typeof positions !== "object" || positions === null) {
      return NextResponse.json({ error: "board.positions must be an object" }, { status: 400 });
    }
    const rawNotes = (b.board as { notes?: unknown })?.notes;
    const notes: { id: string; text: string }[] = [];
    if (rawNotes !== undefined) {
      if (!Array.isArray(rawNotes)) return NextResponse.json({ error: "board.notes must be an array" }, { status: 400 });
      for (const n of rawNotes.slice(0, 100)) {
        const r = n as { id?: unknown; text?: unknown };
        if (typeof r?.id !== "string" || !/^[a-z0-9-]+$/.test(r.id)) continue;
        const text = typeof r.text === "string" ? r.text.slice(0, 300) : "";
        notes.push({ id: r.id, text });
      }
    }
    const clean: Record<string, { x: number; y: number }> = {};
    const known = new Set([
      ...project.storyboard.map((s) => s.id),
      ...project.cast.map((c) => c.id),
      ...project.environments.map((e) => e.id),
      ...(project.imageboard ?? []).map((im) => im.file),
      ...notes.map((n) => n.id),
    ]);
    for (const [key, val] of Object.entries(positions as Record<string, unknown>)) {
      if (!known.has(key)) continue;
      const p = val as { x?: unknown; y?: unknown };
      if (typeof p?.x !== "number" || typeof p?.y !== "number" || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      clean[key] = { x: Math.round(p.x), y: Math.round(p.y) };
    }
    project.board = { positions: clean, ...(notes.length > 0 ? { notes } : {}) };
  }

  if (typeof b.title === "string") {
    const title = b.title.replace(/\s+/g, " ").trim();
    if (title.length === 0 || title.length > 80) {
      return NextResponse.json({ error: "validation", fields: { title: { message: "Title must be 1–80 characters." } } }, { status: 400 });
    }
    const screened = await screenFields({ title });
    if (!screened.ok) return NextResponse.json({ error: screened.message }, { status: screened.status });
    project.title = title;
  }
  if (typeof b.styleId === "string" && b.styleId !== project.styleId) {
    if (!(await isValidStyleId(b.styleId))) {
      return NextResponse.json({ error: "validation", fields: { styleId: { message: "Unknown art style." } } }, { status: 400 });
    }
    if (project.cast.some((c) => c.locked)) {
      return NextResponse.json(
        { error: "The art style is locked once a character is locked — it's part of what keeps every page consistent." },
        { status: 409 }
      );
    }
    project.styleId = b.styleId;
  }

  const saved = await saveProject(project);
  return NextResponse.json({ project: saved });
}
