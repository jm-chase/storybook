import { NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/project/store";
import { isValidStyleId } from "@/lib/styles/registry";
import { screenFields } from "@/lib/safety/moderateFreeform";

// Project collection: list + create (R-6). Server-side filesystem store; the
// browser only ever sees project documents and image URLs, never paths.

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ projects: await listProjects() });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const b = body as { title?: unknown; styleId?: unknown };

  const title = typeof b.title === "string" ? b.title.replace(/\s+/g, " ").trim() : "";
  const styleId = String(b.styleId ?? "");
  const fields: Record<string, { message: string }> = {};
  if (title.length === 0 || title.length > 80) {
    fields.title = { message: "Give the book a title (up to 80 characters)." };
  }
  if (!(await isValidStyleId(styleId))) {
    fields.styleId = { message: "Choose an art style." };
  }
  if (Object.keys(fields).length > 0) {
    return NextResponse.json({ error: "validation", fields }, { status: 400 });
  }

  const screened = await screenFields({ title });
  if (!screened.ok) return NextResponse.json({ error: screened.message }, { status: screened.status });

  const project = await createProject({ title, styleId });
  return NextResponse.json({ project }, { status: 201 });
}
