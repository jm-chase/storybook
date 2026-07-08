import { NextResponse } from "next/server";
import { buildCharacterBrief } from "@/lib/art/brief";
import { HOUSE_STYLES, HOUSE_STYLE_BY_ID } from "@/content/houseStyles";
import { generateCharacterVariants } from "@/lib/art/generateCharacterVariants";
import { streamNdjson } from "@/lib/api/streamNdjson";
import { screenFields } from "@/lib/safety/moderateFreeform";

// Server-side character generation (W-1 / LG-6): the browser calls THIS endpoint;
// the Gemini key never leaves the server. Generation runs through the Output Gate
// and STREAMS progress (W-3) — NDJSON {progress} lines, then {done}/{error}.

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const b = body as { name?: unknown; description?: unknown; styleId?: unknown };
  const styleIds = HOUSE_STYLES.map((s) => s.id);
  const built = buildCharacterBrief(
    { name: b?.name, description: b?.description, styleId: String(b?.styleId ?? "") },
    styleIds
  );
  if (!built.ok) {
    return NextResponse.json({ error: "validation", fields: built.errors }, { status: 400 });
  }

  const screened = await screenFields({ name: built.brief.name, description: built.brief.description });
  if (!screened.ok) return NextResponse.json({ error: screened.message }, { status: screened.status });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
  }

  const style = HOUSE_STYLE_BY_ID[built.brief.styleId];
  return streamNdjson(async (emitProgress) => {
    const result = await generateCharacterVariants(built.brief, style, { onEvent: emitProgress });
    if (result.variants.length === 0) {
      throw new Error("No clean variants passed the gate. Try again or adjust the description.");
    }
    return {
      variants: result.variants.map((v) => `data:${v.mimeType};base64,${v.base64}`),
      attempts: result.attempts,
      costUsd: result.costUsd,
      satisfied: result.satisfied,
    };
  });
}
