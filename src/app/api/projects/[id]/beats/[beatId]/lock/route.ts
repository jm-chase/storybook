import { NextResponse } from "next/server";
import { getProject, saveProject, saveBeatImage } from "@/lib/project/store";

// Lock a beat's page art (same v1 pattern + hosted caveat as the cast lock:
// the client posts back the winning gate-passed data-URL; a hosted deployment
// must switch to server-held candidate ids).

export const runtime = "nodejs";

const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

type Params = { params: Promise<{ id: string; beatId: string }> };

export async function POST(req: Request, { params }: Params) {
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
  const b = body as { imageDataUrl?: unknown };
  const match = typeof b.imageDataUrl === "string" ? b.imageDataUrl.match(DATA_URL) : null;
  if (!match) {
    return NextResponse.json({ error: "imageDataUrl must be a base64 png/jpeg/webp data URL" }, { status: 400 });
  }
  const [, mimeType, base64] = match;

  const file = await saveBeatImage(project.id, beat.id, base64, mimeType);
  beat.art = { file, mimeType, lockedAt: new Date().toISOString() };
  const saved = await saveProject(project);
  return NextResponse.json({ project: saved });
}
