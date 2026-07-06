import { NextResponse } from "next/server";
import { readImage } from "@/lib/project/store";

// Serve a project's stored images (locked cast references). Filenames pass the
// store's strict allowlist — no traversal.

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; file: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id, file } = await params;
  let img: Awaited<ReturnType<typeof readImage>>;
  try {
    img = await readImage(id, file);
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!img) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(img.bytes), {
    headers: {
      "content-type": img.mimeType,
      // Locked references are immutable (D-015) — cache hard.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
