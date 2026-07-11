import { NextResponse } from "next/server";
import { readStyleAsset } from "@/lib/styles/registry";

// Serve a style's plates/reference images for the gallery UI — works for
// built-ins (assets/styleSeeds) and custom styles (the user's styles store).

export const runtime = "nodejs";

type Params = { params: Promise<{ styleId: string; file: string }> };

const MIME_BY_EXT: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(_req: Request, { params }: Params) {
  const { styleId, file } = await params;
  const bytes = await readStyleAsset(styleId, file);
  if (!bytes) return NextResponse.json({ error: "not found" }, { status: 404 });
  const mime = MIME_BY_EXT[file.split(".").pop() ?? ""] ?? "application/octet-stream";
  return new NextResponse(new Uint8Array(bytes), {
    headers: { "content-type": mime, "cache-control": "public, max-age=300" },
  });
}
