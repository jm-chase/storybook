import { NextResponse } from "next/server";
import { createProject, saveProject } from "@/lib/project/store";
import { instantiateTemplate } from "@/lib/project/fromTemplate";
import { TEMPLATE_BY_ID } from "@/content/bookTemplates";
import { HOUSE_STYLES } from "@/content/houseStyles";
import { screenFields } from "@/lib/safety/moderateFreeform";

// Create a project from a book template (skin 2): the parent supplies only the
// hero; the cast + storyboard arrive prefilled, ready to lock and illustrate.

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const b = body as { templateId?: unknown; heroName?: unknown; heroDescription?: unknown; styleId?: unknown };

  const template = TEMPLATE_BY_ID[String(b.templateId ?? "")];
  if (!template) return NextResponse.json({ error: "unknown template" }, { status: 400 });

  const styleId =
    typeof b.styleId === "string" && HOUSE_STYLES.some((s) => s.id === b.styleId)
      ? b.styleId
      : template.defaultStyleId;

  const built = instantiateTemplate(template, { heroName: b.heroName, heroDescription: b.heroDescription });
  if (!built.ok) {
    return NextResponse.json(
      { error: "validation", fields: Object.fromEntries(Object.entries(built.errors).map(([k, m]) => [k, { message: m }])) },
      { status: 400 }
    );
  }

  // Only the PARENT-entered hero fields need screening — the rest is authored.
  const hero = built.value.cast.find((c) => c.role === "hero");
  const screened = await screenFields({
    heroName: hero?.name ?? "",
    heroDescription: hero?.description ?? "",
  });
  if (!screened.ok) return NextResponse.json({ error: screened.message }, { status: screened.status });

  const project = await createProject({ title: built.value.title, styleId });
  project.cast = built.value.cast;
  project.environments = built.value.environments;
  project.storyboard = built.value.storyboard;
  const saved = await saveProject(project);
  return NextResponse.json({ project: saved }, { status: 201 });
}
