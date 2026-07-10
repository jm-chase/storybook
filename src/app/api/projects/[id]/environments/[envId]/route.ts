import { NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/project/store";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; envId: string }> };

/** Remove a setting. Referential integrity (2026-07-10): a setting used by
 * pages cannot be deleted from under them — reassign those pages first. */
export async function DELETE(_req: Request, { params }: Params) {
  const { id, envId } = await params;
  const project = await getProject(id).catch(() => null);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const usedOn = project.storyboard
    .map((b, i) => (b.environmentId === envId ? i + 1 : null))
    .filter((p): p is number => p !== null);
  if (usedOn.length > 0) {
    const name = project.environments.find((e) => e.id === envId)?.name ?? "This setting";
    return NextResponse.json(
      { error: `"${name}" is where page${usedOn.length > 1 ? "s" : ""} ${usedOn.join(", ")} take place — edit those pages to move them first.` },
      { status: 409 }
    );
  }

  const before = project.environments.length;
  project.environments = project.environments.filter((e) => e.id !== envId);
  if (project.environments.length === before) return NextResponse.json({ error: "not found" }, { status: 404 });
  const saved = await saveProject(project);
  return NextResponse.json({ project: saved });
}
