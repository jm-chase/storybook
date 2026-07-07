import { NextResponse } from "next/server";
import { getProject, readImage } from "@/lib/project/store";
import { refineImageVariants, MAX_FIX_INSTRUCTION } from "@/lib/art/refineImage";
import { HOUSE_STYLE_BY_ID } from "@/content/houseStyles";
import { streamNdjson } from "@/lib/api/streamNdjson";

// Point-to-fix a LOCKED cast member's reference — fix the character before
// pages are built on it. Note: pages already generated from the old reference
// keep their art; regenerate them to pick up the fix.

export const runtime = "nodejs";
export const maxDuration = 300;

type Params = { params: Promise<{ id: string; castId: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id, castId } = await params;
  const project = await getProject(id).catch(() => null);
  const member = project?.cast.find((c) => c.id === castId);
  if (!project || !member) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!member.locked) {
    return NextResponse.json({ error: "This character isn't locked yet — generate and lock first." }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const b = body as { instruction?: unknown };
  const instruction = typeof b.instruction === "string" ? b.instruction.replace(/\s+/g, " ").trim() : "";
  if (instruction.length === 0 || instruction.length > MAX_FIX_INSTRUCTION) {
    return NextResponse.json(
      { error: "validation", fields: { instruction: { message: `Say the fix in a few words (up to ${MAX_FIX_INSTRUCTION} characters).` } } },
      { status: 400 }
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
  }
  const style = HOUSE_STYLE_BY_ID[project.styleId];
  if (!style) return NextResponse.json({ error: "project has an unknown style" }, { status: 500 });

  const img = await readImage(project.id, member.locked.file);
  if (!img) return NextResponse.json({ error: "The locked reference file is missing." }, { status: 500 });

  return streamNdjson(async (emitProgress) => {
    const result = await refineImageVariants({
      base64: img.bytes.toString("base64"),
      mimeType: img.mimeType,
      instruction,
      style,
      opts: { onEvent: emitProgress },
    });
    if (result.variants.length === 0) {
      throw new Error("No edit passed the gate — try wording the fix differently.");
    }
    return {
      variants: result.variants.map((v) => `data:${v.mimeType};base64,${v.base64}`),
      attempts: result.attempts,
      costUsd: result.costUsd,
      satisfied: result.satisfied,
    };
  });
}
