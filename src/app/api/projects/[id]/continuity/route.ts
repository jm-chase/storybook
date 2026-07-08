import { NextResponse } from "next/server";
import { getProject, saveContinuityReport } from "@/lib/project/store";
import { reviewBookContinuity } from "@/lib/art/continuity";

// Book-level continuity review: one vision pass over the locked references +
// every finished page in reading order. Returns (and logs to the project's
// continuity/ directory) the issues a human editor would catch across pages,
// each with a suggested fix ready for point-to-fix or regenerate.

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id).catch(() => null);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const lockedPages = project.storyboard.filter((b) => b.art).length;
  if (lockedPages < 2) {
    return NextResponse.json(
      { error: "Lock at least two pages first — continuity is a cross-page review." },
      { status: 409 }
    );
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
  }

  try {
    const report = await reviewBookContinuity(project);
    const file = await saveContinuityReport(project.id, report);
    console.log(
      `[continuity] ${project.title}: ${report.issues.length} issue(s) across ${report.pagesReviewed} pages → continuity/${file}`
    );
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
