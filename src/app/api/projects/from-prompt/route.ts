import { NextResponse } from "next/server";
import { createProject, saveProject } from "@/lib/project/store";
import { generateStoryPlan } from "@/lib/story/generateStory";
import { buildCharacterBrief } from "@/lib/art/brief";
import { HOUSE_STYLES } from "@/content/houseStyles";
import { screenFields, moderateFreeform } from "@/lib/safety/moderateFreeform";

// Prompt-to-storyboard (PRD acceptance criterion #1): premise in, a complete
// ready-to-illustrate project out — title, cast, settings, storyboard.
// Safety: the parent's inputs are screened BEFORE generation (LG-2), and the
// generated texts are screened again before anything is saved (the model's
// output enters a child's book — same bar as parent input).

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_PREMISE = 500;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const b = body as { premise?: unknown; heroName?: unknown; heroDescription?: unknown; styleId?: unknown; tone?: unknown; pages?: unknown };

  const fields: Record<string, { message: string }> = {};
  const premise = typeof b.premise === "string" ? b.premise.replace(/\s+/g, " ").trim() : "";
  if (premise.length === 0) fields.premise = { message: "What's the story about? A sentence or two is plenty." };
  else if (premise.length > MAX_PREMISE) fields.premise = { message: `Keep the premise under ${MAX_PREMISE} characters.` };

  const heroBuilt = buildCharacterBrief(
    { name: b.heroName, description: b.heroDescription, styleId: HOUSE_STYLES[0].id },
    HOUSE_STYLES.map((s) => s.id)
  );
  if (!heroBuilt.ok) {
    for (const [k, m] of Object.entries(heroBuilt.errors)) {
      if (k !== "styleId") fields[k === "name" ? "heroName" : "heroDescription"] = { message: m };
    }
  }
  const styleId =
    typeof b.styleId === "string" && HOUSE_STYLES.some((s) => s.id === b.styleId) ? b.styleId : "painted-wonder";
  const tone = typeof b.tone === "string" ? b.tone.replace(/\s+/g, " ").trim().slice(0, 60) : "";
  if (Object.keys(fields).length > 0) {
    return NextResponse.json({ error: "validation", fields }, { status: 400 });
  }
  if (!heroBuilt.ok) return NextResponse.json({ error: "validation" }, { status: 400 }); // narrows; unreachable

  // Screen the parent's creative inputs (LG-2) before they reach the model.
  const screened = await screenFields({
    premise,
    heroName: heroBuilt.brief.name,
    heroDescription: heroBuilt.brief.description,
    tone,
  });
  if (!screened.ok) return NextResponse.json({ error: screened.message }, { status: screened.status });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
  }

  const input = {
    premise,
    heroName: heroBuilt.brief.name,
    heroDescription: heroBuilt.brief.description,
    tone: tone || undefined,
    pages: typeof b.pages === "number" ? b.pages : undefined,
  };

  let plan;
  try {
    plan = await generateStoryPlan(input);
  } catch (first) {
    try {
      plan = await generateStoryPlan(input, (first as Error).message.slice(0, 200));
    } catch (second) {
      return NextResponse.json(
        { error: `The story engine couldn't build a valid plan (${(second as Error).message.slice(0, 160)}). Try rewording the premise.` },
        { status: 502 }
      );
    }
  }

  // Screen the GENERATED book text before saving (defense in depth).
  try {
    const verdict = await moderateFreeform({
      title: plan.title,
      ...Object.fromEntries(plan.cast.map((c, i) => [`cast${i}`, `${c.name} ${c.description}`])),
      ...Object.fromEntries(plan.storyboard.map((s, i) => [`page${i + 1}`, `${s.sceneDescription} ${s.text}`])),
    });
    if (!verdict.allowed) {
      return NextResponse.json(
        { error: `The generated story didn't pass the content screen (${verdict.reason}). Try rewording the premise.` },
        { status: 502 }
      );
    }
  } catch (e) {
    return NextResponse.json({ error: `Couldn't verify the generated story is safe (${(e as Error).message.slice(0, 120)}).` }, { status: 503 });
  }

  const project = await createProject({ title: plan.title, styleId });
  project.cast = plan.cast;
  project.environments = plan.environments;
  project.storyboard = plan.storyboard;
  const saved = await saveProject(project);
  return NextResponse.json({ project: saved }, { status: 201 });
}
