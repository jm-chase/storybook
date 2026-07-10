import { NextResponse } from "next/server";
import { getProject, saveProject, readImage, saveEnvironmentImage } from "@/lib/project/store";
import { getGeminiClient } from "@/lib/art/geminiClient";
import { withRetry } from "@/lib/art/retry";
import { GEMINI_IMAGE_MODEL } from "@/lib/art/geminiProvider";
import { runGate } from "@/lib/art/outputGate/runGate";
import { safetyCheck, qualityCheck } from "@/lib/art/outputGate/checks";
import { HOUSE_STYLE_BY_ID } from "@/content/houseStyles";

// Derive a PARTS SHEET from a locked setting (2026-07-10): the location's key
// objects drawn separately — furniture, structures, fixtures — so scene
// generation can RECOMPOSE the space from any angle instead of tracing the
// reference plate. Conditioned on the locked setting image itself; gated
// (safety + quality; kind "character-sheet" since a plain background is the
// point).

export const runtime = "nodejs";
export const maxDuration = 300;

type Params = { params: Promise<{ id: string; envId: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id, envId } = await params;
  const project = await getProject(id).catch(() => null);
  const environment = project?.environments.find((e) => e.id === envId);
  if (!project || !environment) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!environment.locked) {
    return NextResponse.json({ error: "Lock the setting first — the parts sheet is derived from its reference." }, { status: 409 });
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
  }
  const style = HOUSE_STYLE_BY_ID[project.styleId];
  if (!style) return NextResponse.json({ error: "project has an unknown style" }, { status: 500 });

  const ref = await readImage(project.id, environment.locked.file);
  if (!ref) return NextResponse.json({ error: "The locked setting file is missing." }, { status: 500 });

  const ai = getGeminiClient();
  const outcome = await runGate(
    async () => {
      const res = await withRetry(() =>
        ai.models.generateContent({
          model: GEMINI_IMAGE_MODEL,
          contents: [
            {
              text:
                `Image 1 is a picture-book SETTING: ${environment.description}. ` +
                `Draw a clean REFERENCE PARTS SHEET of this exact location on a plain pale background: its key ` +
                `objects and structures drawn SEPARATELY with generous spacing — each piece of furniture, door, ` +
                `window, fixture, and distinctive prop exactly as it appears in Image 1 (same design, materials, ` +
                `colours), each from a clear three-quarter view. ` +
                `Art style: ${style.promptFragment}. No characters, no text, no labels, no faces on objects.`,
            },
            { inlineData: { mimeType: ref.mimeType, data: ref.bytes.toString("base64") } },
          ],
        })
      );
      const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part?.inlineData?.data) throw new Error("no image returned");
      return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType ?? "image/png" };
    },
    [safetyCheck, qualityCheck],
    { brief: { name: "", description: environment.description, styleId: style.id }, style, kind: "character-sheet" },
    { variantsWanted: 1, maxAttempts: 3 }
  );
  if (outcome.variants.length === 0) {
    return NextResponse.json({ error: "No parts sheet passed the gate — try again." }, { status: 502 });
  }

  const v = outcome.variants[0];
  const file = await saveEnvironmentImage(project.id, `${environment.id}-parts`, v.base64, v.mimeType);
  environment.components = { file, mimeType: v.mimeType, lockedAt: new Date().toISOString() };
  const saved = await saveProject(project);
  return NextResponse.json({ project: saved });
}
