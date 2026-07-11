import { NextResponse } from "next/server";
import { getProject, saveProject, saveImageboardImage } from "@/lib/project/store";
import { generateStandaloneScene } from "@/lib/art/geminiProvider";
import { getStyleSeed, getElementSheet } from "@/lib/art/styleSeed";
import { runGate } from "@/lib/art/outputGate/runGate";
import { safetyCheck, qualityCheck } from "@/lib/art/outputGate/checks";
import { getStyleById } from "@/lib/styles/registry";
import { screenFields } from "@/lib/safety/moderateFreeform";
import { COST_PER_IMAGE_USD } from "@/lib/art/cost";

// Image boards (CRAFT_BAR G6, the Miyazaki starting point): loose concept
// images from a mood prompt, BEFORE story and cast commit. Gated for safety +
// quality (no consistency — there is nothing to be consistent WITH yet), style
// seeded so exploration happens inside the book's visual language.

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_IDEA = 300;

type Params = { params: Promise<{ id: string }> };

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
  const idea = typeof (body as { idea?: unknown }).idea === "string" ? ((body as { idea: string }).idea).replace(/\s+/g, " ").trim() : "";
  if (idea.length === 0 || idea.length > MAX_IDEA) {
    return NextResponse.json(
      { error: "validation", fields: { idea: { message: `Describe the image in a few words (up to ${MAX_IDEA} characters).` } } },
      { status: 400 }
    );
  }

  const screened = await screenFields({ idea });
  if (!screened.ok) return NextResponse.json({ error: screened.message }, { status: screened.status });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
  }
  const style = await getStyleById(project.styleId);
  if (!style) return NextResponse.json({ error: "project has an unknown style" }, { status: 500 });

  const styleSeed = (await getStyleSeed(style)) ?? undefined;
  const elementSheet = (await getElementSheet(style)) ?? undefined;
  const outcome = await runGate(
    async () => {
      const img = await generateStandaloneScene({
        scenePrompt: `a loose, evocative concept image — ${idea} — mood and atmosphere over precision`,
        style,
        styleSeed,
        elementSheet,
      });
      return { base64: img.base64, mimeType: img.mimeType };
    },
    [safetyCheck, qualityCheck],
    { brief: { name: "", description: idea, styleId: style.id }, style, kind: "environment" },
    { variantsWanted: 2, maxAttempts: 4 }
  );
  if (outcome.variants.length === 0) {
    return NextResponse.json({ error: "No concept image passed the gate — try different words." }, { status: 502 });
  }

  project.imageboard ??= [];
  for (const v of outcome.variants) {
    const file = await saveImageboardImage(project.id, v.base64, v.mimeType);
    project.imageboard.push({ file, mimeType: v.mimeType, lockedAt: new Date().toISOString() });
  }
  const saved = await saveProject(project);
  return NextResponse.json({
    project: saved,
    added: outcome.variants.length,
    costUsd: Number((outcome.attempts * COST_PER_IMAGE_USD).toFixed(3)),
  });
}
