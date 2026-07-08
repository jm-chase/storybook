import { NextResponse } from "next/server";
import { createProject, saveProject } from "@/lib/project/store";
import { beatsFromManuscript } from "@/lib/project/fromManuscript";
import { HOUSE_STYLES } from "@/content/houseStyles";
import { screenFields } from "@/lib/safety/moderateFreeform";

// Create a project from a pasted manuscript (skin 3 — indie authors): the
// storyboard arrives prefilled with the page text; cast + scene refinement
// happen in the studio.

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const b = body as { title?: unknown; styleId?: unknown; manuscript?: unknown };

  const title = typeof b.title === "string" ? b.title.replace(/\s+/g, " ").trim() : "";
  const styleId = String(b.styleId ?? "");
  const fields: Record<string, { message: string }> = {};
  if (title.length === 0 || title.length > 80) {
    fields.title = { message: "Give the book a title (up to 80 characters)." };
  }
  if (!HOUSE_STYLES.some((s) => s.id === styleId)) {
    fields.styleId = { message: "Choose an art style." };
  }
  const built = beatsFromManuscript(b.manuscript);
  if (!built.ok) fields.manuscript = { message: built.error };
  if (Object.keys(fields).length > 0) {
    return NextResponse.json({ error: "validation", fields }, { status: 400 });
  }
  if (!built.ok) return NextResponse.json({ error: "validation" }, { status: 400 }); // narrows type; unreachable

  const screened = await screenFields({
    title,
    ...Object.fromEntries(built.beats.map((beat, i) => [`page${i + 1}`, `${beat.sceneDescription} ${beat.text}`])),
  });
  if (!screened.ok) return NextResponse.json({ error: screened.message }, { status: screened.status });

  const project = await createProject({ title, styleId });
  project.storyboard = built.beats;
  const saved = await saveProject(project);
  return NextResponse.json({ project: saved }, { status: 201 });
}
