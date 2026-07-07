import { NextResponse } from "next/server";
import { getProject, readImage } from "@/lib/project/store";
import { generateSceneVariants } from "@/lib/art/generateSceneVariants";
import { HOUSE_STYLE_BY_ID } from "@/content/houseStyles";
import type { CharacterRef } from "@/lib/art/geminiProvider";

// Generate the page art for a beat: every cast member in the beat conditions
// the image with their LOCKED reference, and the gate verifies each one
// (per-character consistency, D-022). Returns clean variants to choose from.

export const runtime = "nodejs";
export const maxDuration = 300;

type Params = { params: Promise<{ id: string; beatId: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id, beatId } = await params;
  const project = await getProject(id).catch(() => null);
  const beat = project?.storyboard.find((s) => s.id === beatId);
  if (!project || !beat) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
  }

  const style = HOUSE_STYLE_BY_ID[project.styleId];
  if (!style) return NextResponse.json({ error: "project has an unknown style" }, { status: 500 });

  // Resolve the beat's cast to locked references — every member must be locked.
  const characters: CharacterRef[] = [];
  for (const castId of beat.castIds) {
    const member = project.cast.find((c) => c.id === castId);
    if (!member) return NextResponse.json({ error: "a character in this beat is no longer in the cast" }, { status: 409 });
    if (!member.locked) {
      return NextResponse.json(
        { error: `Lock ${member.name} before generating this page — scenes are drawn from locked references.` },
        { status: 409 }
      );
    }
    const img = await readImage(project.id, member.locked.file);
    if (!img) return NextResponse.json({ error: `${member.name}'s locked image file is missing.` }, { status: 500 });
    characters.push({
      label: `the ${member.role} ${member.name}`,
      description: member.description,
      base64: img.bytes.toString("base64"),
      mimeType: img.mimeType,
    });
  }

  try {
    const result = await generateSceneVariants({ scenePrompt: beat.sceneDescription, style, characters });
    if (result.variants.length === 0) {
      return NextResponse.json(
        { error: "No clean variants passed the gate. Try again or adjust the scene.", attempts: result.attempts, rejected: result.rejected },
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
