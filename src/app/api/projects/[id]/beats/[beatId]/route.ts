import { NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/project/store";
import { validateBeatInput } from "@/lib/project/beats";
import { screenFields } from "@/lib/safety/moderateFreeform";

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
  const b = body as {
    sceneDescription?: unknown;
    text?: unknown;
    castIds?: unknown;
    environmentId?: unknown;
    production?: unknown;
    colorScript?: unknown;
  };

  // Color script: feeds the ART prompt on the next generation; editing it does
  // NOT clear locked art (deliberate — see types.ts).
  if (b.colorScript !== undefined) {
    const phrase = typeof b.colorScript === "string" ? b.colorScript.replace(/\s+/g, " ").trim().slice(0, 160) : "";
    if (phrase) {
      const screenedColor = await screenFields({ colorScript: phrase });
      if (!screenedColor.ok) return NextResponse.json({ error: screenedColor.message }, { status: screenedColor.status });
      beat.colorScript = phrase;
    } else {
      delete beat.colorScript;
    }
    if (b.sceneDescription === undefined && b.text === undefined && b.castIds === undefined && b.environmentId === undefined && b.production === undefined) {
      const saved = await saveProject(project);
      return NextResponse.json({ project: saved });
    }
  }

  // Production metadata (camera/shot/timing/dialogue): planning notes only —
  // never sent to the image model, never typeset. Editing them keeps the art.
  if (b.production !== undefined) {
    const p = (typeof b.production === "object" && b.production !== null ? b.production : {}) as Record<string, unknown>;
    const clean: Record<string, string> = {};
    for (const key of ["camera", "shotNotes", "timing", "dialogue"] as const) {
      const v = typeof p[key] === "string" ? (p[key] as string).replace(/\s+/g, " ").trim().slice(0, 200) : "";
      if (v) clean[key] = v;
    }
    const screenedProd = await screenFields(clean);
    if (!screenedProd.ok) return NextResponse.json({ error: screenedProd.message }, { status: screenedProd.status });
    if (Object.keys(clean).length > 0) beat.production = clean;
    else delete beat.production;
    // Production-only PATCH: save and return without touching scene fields.
    if (b.sceneDescription === undefined && b.text === undefined && b.castIds === undefined && b.environmentId === undefined) {
      const saved = await saveProject(project);
      return NextResponse.json({ project: saved });
    }
  }

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

  const textChanged = built.value.sceneDescription !== beat.sceneDescription || built.value.text !== beat.text;
  if (textChanged) {
    const screened = await screenFields({ sceneDescription: built.value.sceneDescription, text: built.value.text });
    if (!screened.ok) return NextResponse.json({ error: screened.message }, { status: screened.status });
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
