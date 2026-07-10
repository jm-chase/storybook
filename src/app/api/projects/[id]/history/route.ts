import { NextResponse } from "next/server";
import { getProject, listHistory, restoreSnapshot } from "@/lib/project/store";

// Version history (PRD): every save snapshots the previous document; this
// route lists snapshots and restores one (a restore snapshots the current
// document first, so it is itself undoable). Structure + text only — locked
// image files are not versioned.

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id).catch(() => null);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });
  return NextResponse.json({ history: await listHistory(id) });
}

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
  const file = (body as { file?: unknown }).file;
  if (typeof file !== "string") return NextResponse.json({ error: "file required" }, { status: 400 });

  const restored = await restoreSnapshot(id, file).catch(() => null);
  if (!restored) return NextResponse.json({ error: "snapshot not found" }, { status: 404 });
  return NextResponse.json({ project: restored });
}
