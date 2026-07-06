import { NextResponse } from "next/server";
import { getProject, saveProject, saveCastImage } from "@/lib/project/store";

// Lock a cast member: persist the chosen variant as the character's permanent
// reference image (D-015 — generated once, then frozen).
//
// v1 (local, single-user): the client posts back the winning data-URL it
// received from /api/generate-character. HOSTED NOTE (LG-6 family): once
// deployed, lock must reference a server-held, gate-passed candidate id instead
// of accepting client-supplied image bytes — otherwise the gate is bypassable.

export const runtime = "nodejs";

const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

type Params = { params: Promise<{ id: string; castId: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id, castId } = await params;
  const project = await getProject(id).catch(() => null);
  const member = project?.cast.find((c) => c.id === castId);
  if (!project || !member) return NextResponse.json({ error: "not found" }, { status: 404 });

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

  const file = await saveCastImage(project.id, member.id, base64, mimeType);
  member.locked = { file, mimeType, lockedAt: new Date().toISOString() };
  const saved = await saveProject(project);
  return NextResponse.json({ project: saved });
}
