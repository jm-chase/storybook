import { NextResponse } from "next/server";
import { getProject, createProject, saveProject, copyImages } from "@/lib/project/store";
import { cloneForSeries } from "@/lib/project/series";

// Series: start a NEW adventure with this book's locked cast, settings, and
// style — fresh storyboard. The retention lever from D-023.

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const source = await getProject(id).catch(() => null);
  if (!source) return NextResponse.json({ error: "project not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const b = body as { title?: unknown };
  const title = typeof b.title === "string" ? b.title.replace(/\s+/g, " ").trim() : "";
  if (title.length === 0 || title.length > 80) {
    return NextResponse.json(
      { error: "validation", fields: { title: { message: "Give the new adventure a title (up to 80 characters)." } } },
      { status: 400 }
    );
  }

  const clone = cloneForSeries(source);
  const project = await createProject({ title, styleId: source.styleId });
  await copyImages(source.id, project.id, clone.imageFiles);
  project.cast = clone.cast;
  project.environments = clone.environments;
  const saved = await saveProject(project);
  return NextResponse.json({ project: saved }, { status: 201 });
}
