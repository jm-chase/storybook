import { NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/project/store";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; envId: string }> };

/** Remove a setting; beats set there fall back to no setting (art untouched —
 * it was generated when the setting existed). */
export async function DELETE(_req: Request, { params }: Params) {
  const { id, envId } = await params;
  const project = await getProject(id).catch(() => null);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  const before = project.environments.length;
  project.environments = project.environments.filter((e) => e.id !== envId);
  if (project.environments.length === before) return NextResponse.json({ error: "not found" }, { status: 404 });
  for (const beat of project.storyboard) {
    if (beat.environmentId === envId) delete beat.environmentId;
  }
  const saved = await saveProject(project);
  return NextResponse.json({ project: saved });
}
