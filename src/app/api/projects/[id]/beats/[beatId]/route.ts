import { NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/project/store";
import { validateBeatInput } from "@/lib/project/beats";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; beatId: string }> };

/** Edit a beat. Editing the SCENE of a beat with locked art clears the art —
 * the picture no longer matches the description that produced it. */
export async function PATCH(req: Request, { params }: Params) {
  const { id, beatId } = await params;
  const project = await getProject(id).catch(() => null);
  const beat = project?.storyboard.find((s) => s.id === beatId);
  if (!project || !beat) return NextResponse.json({ error: "not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const b = body as { sceneDescription?: unknown; text?: unknown; castIds?: unknown; environmentId?: unknown };

  const built = validateBeatInput(
    {
      sceneDescription: b.sceneDescription ?? beat.sceneDescription,
      text: b.text ?? beat.text,
      castIds: b.castIds ?? beat.castIds,
      environmentId: b.environmentId !== undefined ? b.environmentId : beat.environmentId,
    },
    project
  );
  if (!built.ok) {
    return NextResponse.json(
      { error: "validation", fields: Object.fromEntries(Object.entries(built.errors).map(([k, m]) => [k, { message: m }])) },
      { status: 400 }
    );
  }

  const sceneChanged =
    built.value.sceneDescription !== beat.sceneDescription ||
    JSON.stringify(built.value.castIds) !== JSON.stringify(beat.castIds) ||
    built.value.environmentId !== beat.environmentId;
  beat.sceneDescription = built.value.sceneDescription;
  beat.text = built.value.text;
  beat.castIds = built.value.castIds;
  if (built.value.environmentId) beat.environmentId = built.value.environmentId;
  else delete beat.environmentId;
  if (sceneChanged) delete beat.art;

  const saved = await saveProject(project);
  return NextResponse.json({ project: saved });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id, beatId } = await params;
  const project = await getProject(id).catch(() => null);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  const before = project.storyboard.length;
  project.storyboard = project.storyboard.filter((s) => s.id !== beatId);
  if (project.storyboard.length === before) return NextResponse.json({ error: "not found" }, { status: 404 });
  const saved = await saveProject(project);
  return NextResponse.json({ project: saved });
}
