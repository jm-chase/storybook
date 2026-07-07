import { NextResponse } from "next/server";
import { getProject, saveProject, newId } from "@/lib/project/store";
import { validateField } from "@/lib/validation";
import type { EnvironmentSetting } from "@/lib/project/types";

// Add a setting: short validated name + freeform art-only description (D-018
// firewall, same as characters). Lock flow mirrors cast.

export const runtime = "nodejs";

const MAX_ENV_DESCRIPTION = 300;

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
  const b = body as { name?: unknown; description?: unknown };

  const fields: Record<string, { message: string }> = {};
  const nameRes = validateField(b.name, "shortDetail", { required: true });
  if (!nameRes.ok) fields.name = { message: nameRes.message };

  const description = typeof b.description === "string" ? b.description.replace(/\s+/g, " ").trim() : "";
  if (description.length === 0) {
    fields.description = { message: "Describe the setting in a few words." };
  } else if (description.length > MAX_ENV_DESCRIPTION) {
    fields.description = { message: `Keep the description under ${MAX_ENV_DESCRIPTION} characters.` };
  }
  if (Object.keys(fields).length > 0) {
    return NextResponse.json({ error: "validation", fields }, { status: 400 });
  }

  const environment: EnvironmentSetting = {
    id: newId(),
    name: (nameRes as { ok: true; value: string }).value,
    description,
  };
  project.environments.push(environment);
  const saved = await saveProject(project);
  return NextResponse.json({ project: saved, environment }, { status: 201 });
}
