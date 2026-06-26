import { NextResponse } from "next/server";
import { buildCharacterBrief } from "@/lib/art/brief";
import { HOUSE_STYLES, HOUSE_STYLE_BY_ID } from "@/content/houseStyles";
import { generateCharacterVariants } from "@/lib/art/generateCharacterVariants";

// Server-side character generation (W-1 / LG-6): the browser calls THIS endpoint;
// the Gemini key never leaves the server. Generation runs through the Output Gate
// and returns 3 clean variants for the parent to choose from.
//
// NOTE (W-3): this is synchronous — generating + gating several images can take
// ~30s. Fine for local dev; production should stream progress (SSE) instead.

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

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
  }

  try {
    const style = HOUSE_STYLE_BY_ID[built.brief.styleId];
    const result = await generateCharacterVariants(built.brief, style);
    if (result.variants.length === 0) {
      return NextResponse.json(
        { error: "No clean variants passed the gate. Try again or adjust the description.", attempts: result.attempts },
        { status: 502 }
      );
    }
    return NextResponse.json({
      variants: result.variants.map((v) => `data:${v.mimeType};base64,${v.base64}`),
      attempts: result.attempts,
      costUsd: result.costUsd,
      satisfied: result.satisfied,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
