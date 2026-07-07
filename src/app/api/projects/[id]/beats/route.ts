import { NextResponse } from "next/server";
import { getProject, saveProject, newId } from "@/lib/project/store";
import { validateBeatInput } from "@/lib/project/beats";
import type { StoryBeat } from "@/lib/project/types";

// Add a storyboard beat: what happens visually, the page text, who's in it.

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
  const b = body as { sceneDescription?: unknown; text?: unknown; castIds?: unknown };

  const built = validateBeatInput(
    { sceneDescription: b.sceneDescription, text: b.text, castIds: b.castIds },
    project
  );
  if (!built.ok) {
    return NextResponse.json(
      { error: "validation", fields: Object.fromEntries(Object.entries(built.errors).map(([k, m]) => [k, { message: m }])) },
      { status: 400 }
    );
  }

  const beat: StoryBeat = { id: newId(), ...built.value };
  project.storyboard.push(beat);
  const saved = await saveProject(project);
  return NextResponse.json({ project: saved, beat }, { status: 201 });
}
