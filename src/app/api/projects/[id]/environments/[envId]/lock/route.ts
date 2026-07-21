import { NextResponse } from "next/server";
import { getProject, saveProject, saveEnvironmentImage } from "@/lib/project/store";
import { extractEnvironmentManifest } from "@/lib/art/manifest";

// Lock a setting's reference (same v1 pattern + hosted caveat as cast/beat
// locks: client posts the winning gate-passed data-URL), then extract its
// LANDMARK manifest (2026-07-20, settei-for-places) — best-effort, same as
// the cast lock's manifest/card compile: a failure here never fails the lock.

export const runtime = "nodejs";

const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

type Params = { params: Promise<{ id: string; envId: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id, envId } = await params;
  const project = await getProject(id).catch(() => null);
  const environment = project?.environments.find((e) => e.id === envId);
  if (!project || !environment) return NextResponse.json({ error: "not found" }, { status: 404 });

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

  const file = await saveEnvironmentImage(project.id, environment.id, base64, mimeType);
  environment.locked = { file, mimeType, lockedAt: new Date().toISOString() };

  try {
    environment.manifest = await extractEnvironmentManifest(base64, mimeType, environment.description);
  } catch (e) {
    console.warn(`[lock] environment manifest extraction failed for ${environment.name}: ${(e as Error).message.slice(0, 120)}`);
  }

  const saved = await saveProject(project);
  return NextResponse.json({ project: saved });
}
