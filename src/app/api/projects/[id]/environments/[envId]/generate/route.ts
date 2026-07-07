import { NextResponse } from "next/server";
import { getProject } from "@/lib/project/store";
import { generateEnvironmentVariants } from "@/lib/art/generateEnvironmentVariants";
import { HOUSE_STYLE_BY_ID } from "@/content/houseStyles";

export const runtime = "nodejs";
export const maxDuration = 300;

type Params = { params: Promise<{ id: string; envId: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id, envId } = await params;
  const project = await getProject(id).catch(() => null);
  const environment = project?.environments.find((e) => e.id === envId);
  if (!project || !environment) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
  }
  const style = HOUSE_STYLE_BY_ID[project.styleId];
  if (!style) return NextResponse.json({ error: "project has an unknown style" }, { status: 500 });

  try {
    const result = await generateEnvironmentVariants(environment.description, style);
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
