import { NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/project/store";
import { buildCharacterBrief } from "@/lib/art/brief";
import { HOUSE_STYLES } from "@/content/houseStyles";
import { screenFields } from "@/lib/safety/moderateFreeform";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; castId: string }> };

/** Edit an UNLOCKED cast member's name/description. A locked member's identity
 * is frozen with its reference (D-015) — unlock by deleting + re-adding. */
export async function PATCH(req: Request, { params }: Params) {
  const { id, castId } = await params;
  const project = await getProject(id).catch(() => null);
  const member = project?.cast.find((c) => c.id === castId);
  if (!project || !member) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (member.locked) {
    return NextResponse.json({ error: "This character is locked. Remove them to start over." }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const b = body as { name?: unknown; description?: unknown };

  const built = buildCharacterBrief(
    { name: b.name ?? member.name, description: b.description ?? member.description, styleId: project.styleId },
    HOUSE_STYLES.map((s) => s.id)
  );
  if (!built.ok) {
    return NextResponse.json(
      { error: "validation", fields: Object.fromEntries(Object.entries(built.errors).map(([k, m]) => [k, { message: m }])) },
      { status: 400 }
    );
  }
  const screened = await screenFields({ name: built.brief.name, description: built.brief.description });
  if (!screened.ok) return NextResponse.json({ error: screened.message }, { status: screened.status });

  member.name = built.brief.name;
  member.description = built.brief.description;
  const saved = await saveProject(project);
  return NextResponse.json({ project: saved });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id, castId } = await params;
  const project = await getProject(id).catch(() => null);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  const before = project.cast.length;
  project.cast = project.cast.filter((c) => c.id !== castId);
  if (project.cast.length === before) return NextResponse.json({ error: "not found" }, { status: 404 });
  const saved = await saveProject(project);
  return NextResponse.json({ project: saved });
}
