import { NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/project/store";
import { HOUSE_STYLES } from "@/content/houseStyles";
import { screenFields } from "@/lib/safety/moderateFreeform";

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
  const b = body as { title?: unknown; styleId?: unknown };

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
    if (!HOUSE_STYLES.some((s) => s.id === b.styleId)) {
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
