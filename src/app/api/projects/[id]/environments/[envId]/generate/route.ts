import { NextResponse } from "next/server";
import { getProject } from "@/lib/project/store";
import { generateEnvironmentVariants } from "@/lib/art/generateEnvironmentVariants";
import { getStyleById } from "@/lib/styles/registry";
import { streamNdjson } from "@/lib/api/streamNdjson";

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
  const style = await getStyleById(project.styleId);
  if (!style) return NextResponse.json({ error: "project has an unknown style" }, { status: 500 });

  return streamNdjson(async (emitProgress) => {
    const result = await generateEnvironmentVariants(environment.description, style, { onEvent: emitProgress });
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
