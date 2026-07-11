import { NextResponse } from "next/server";
import { getProject, saveProject, newId } from "@/lib/project/store";
import { buildCharacterBrief } from "@/lib/art/brief";
import { listStyles } from "@/lib/styles/registry";
import { CAST_ROLES, type CastMember, type CastRole } from "@/lib/project/types";
import { screenFields } from "@/lib/safety/moderateFreeform";

// Add a cast member (D-022): role + validated name + firewalled freeform
// description. The member is created UNLOCKED — generation + choose-from-3 +
// lock happen next (/api/generate-character then .../cast/[castId]/lock).

export const runtime = "nodejs";

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
  const b = body as { role?: unknown; name?: unknown; description?: unknown };

  const role = String(b.role ?? "") as CastRole;
  const fields: Record<string, { message: string }> = {};
  if (!CAST_ROLES.includes(role)) {
    fields.role = { message: "Pick a role: hero, sidekick, adversary, or friend." };
  } else if (role === "hero" && project.cast.some((c) => c.role === "hero")) {
    fields.role = { message: "This book already has a hero — every story gets exactly one." };
  }

  const built = buildCharacterBrief(
    { name: b.name, description: b.description, styleId: project.styleId },
    (await listStyles()).map((s) => s.id)
  );
  if (!built.ok) Object.assign(fields, Object.fromEntries(Object.entries(built.errors).map(([k, m]) => [k, { message: m }])));
  if (Object.keys(fields).length > 0) {
    return NextResponse.json({ error: "validation", fields }, { status: 400 });
  }
  if (!built.ok) return NextResponse.json({ error: "validation" }, { status: 400 }); // narrows type; unreachable

  const screened = await screenFields({ name: built.brief.name, description: built.brief.description });
  if (!screened.ok) return NextResponse.json({ error: screened.message }, { status: screened.status });

  const member: CastMember = {
    id: newId(),
    role,
    name: built.brief.name,
    description: built.brief.description,
  };
  project.cast.push(member);
  const saved = await saveProject(project);
  return NextResponse.json({ project: saved, member }, { status: 201 });
}
