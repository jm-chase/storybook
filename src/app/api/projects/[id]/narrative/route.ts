import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getProject, userRoot } from "@/lib/project/store";
import { getLocalUserId } from "@/lib/auth/user";
import { reviewNarrative } from "@/lib/story/narrativeReview";

// Story-level narrative review (text-only sibling of /continuity): arc stages
// per page + structural issues with suggestions. Logged like continuity —
// one JSON report per run under the project's narrative/ dir.

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id).catch(() => null);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });
  if (project.storyboard.length < 2) {
    return NextResponse.json({ error: "Add at least two pages first — the review reads the story as a sequence." }, { status: 409 });
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
  }

  try {
    const report = await reviewNarrative(project);
    const dir = path.join(userRoot(getLocalUserId()), project.id, "narrative");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${Date.now()}.json`), JSON.stringify(report, null, 2), "utf8");
    console.log(`[narrative] ${project.title}: ${report.issues.length} issue(s) across ${report.pagesReviewed} pages`);
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
