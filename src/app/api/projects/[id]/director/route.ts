import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getProject, userRoot } from "@/lib/project/store";
import { getLocalUserId } from "@/lib/auth/user";
import { directorReview } from "@/lib/art/directorReview";

// The director's craft review (CRAFT_BAR G5): per-page scores on emotional
// truth / acting / composition / wonder + a retake list. Logged per run to
// the project's director/ dir like the other reviews.

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id).catch(() => null);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });
  if (project.storyboard.filter((b) => b.art).length < 1) {
    return NextResponse.json({ error: "Finish at least one page first — the director reviews finished pages." }, { status: 409 });
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
  }

  try {
    const report = await directorReview(project);
    const dir = path.join(userRoot(getLocalUserId()), project.id, "director");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${Date.now()}.json`), JSON.stringify(report, null, 2), "utf8");
    console.log(`[director] ${project.title}: overall ${report.overall}/5, ${report.retakes.length} retake(s)`);
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
