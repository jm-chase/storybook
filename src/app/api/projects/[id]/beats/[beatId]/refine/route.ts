import { NextResponse } from "next/server";
import { getProject, readImage } from "@/lib/project/store";
import { refineImageVariants, MAX_FIX_INSTRUCTION } from "@/lib/art/refineImage";
import { HOUSE_STYLE_BY_ID } from "@/content/houseStyles";
import { streamNdjson } from "@/lib/api/streamNdjson";
import { screenFields } from "@/lib/safety/moderateFreeform";

// Point-to-fix a beat's LOCKED art: say the fix plainly, get gate-clean edited
// variants that changed only that. Lock the winner via the normal lock route.

export const runtime = "nodejs";
export const maxDuration = 300;

type Params = { params: Promise<{ id: string; beatId: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id, beatId } = await params;
  const project = await getProject(id).catch(() => null);
  const beat = project?.storyboard.find((s) => s.id === beatId);
  if (!project || !beat) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!beat.art) {
    return NextResponse.json({ error: "This page has no locked art to fix — generate it first." }, { status: 409 });
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

  const screened = await screenFields({ instruction });
  if (!screened.ok) return NextResponse.json({ error: screened.message }, { status: screened.status });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
  }
  const style = HOUSE_STYLE_BY_ID[project.styleId];
  if (!style) return NextResponse.json({ error: "project has an unknown style" }, { status: 500 });

  const img = await readImage(project.id, beat.art.file);
  if (!img) return NextResponse.json({ error: "The locked art file is missing." }, { status: 500 });

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
