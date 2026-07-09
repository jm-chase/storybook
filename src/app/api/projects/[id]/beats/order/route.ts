import { NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/project/store";
import { reorderStoryboard } from "@/lib/project/beats";

// Reorder the book's pages (infinite board drag / narrative restructuring).
// Body: { beatIds: string[] } — must be a permutation of the current pages.

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id).catch(() => null);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const result = reorderStoryboard(project, (body as { beatIds?: unknown }).beatIds);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const saved = await saveProject(project);
  return NextResponse.json({ project: saved });
}
