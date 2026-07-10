import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getProject, userRoot } from "@/lib/project/store";
import { getLocalUserId } from "@/lib/auth/user";

// Pre-flight editorial status (CRAFT_BAR G7): the latest result of each
// editor pass, read from the per-project report logs. Print & export shows
// this as the checklist a book clears before it becomes a physical object.

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

interface PassStatus {
  ran: boolean;
  at?: string;
  /** continuity/narrative: open issue count; director: retake count. */
  issues?: number;
  /** director only: overall score /5. */
  overall?: number;
  /** True when the pass ran AFTER the project's last content change. */
  fresh?: boolean;
}

async function latestReport(dir: string): Promise<{ at: string; doc: Record<string, unknown> } | null> {
  let files: string[];
  try {
    files = (await fs.readdir(dir)).filter((f) => /^\d+\.json$/.test(f)).sort().reverse();
  } catch {
    return null;
  }
  for (const f of files) {
    try {
      const doc = JSON.parse(await fs.readFile(path.join(dir, f), "utf8")) as Record<string, unknown>;
      return { at: new Date(Number(f.replace(".json", ""))).toISOString(), doc };
    } catch {
      /* skip corrupt */
    }
  }
  return null;
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id).catch(() => null);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const base = path.join(userRoot(getLocalUserId()), project.id);
  const [continuity, narrative, director] = await Promise.all([
    latestReport(path.join(base, "continuity")),
    latestReport(path.join(base, "narrative")),
    latestReport(path.join(base, "director")),
  ]);

  const toStatus = (r: { at: string; doc: Record<string, unknown> } | null, issueKey: "issues" | "retakes"): PassStatus => {
    if (!r) return { ran: false };
    const list = r.doc[issueKey];
    return {
      ran: true,
      at: r.at,
      issues: Array.isArray(list) ? list.length : undefined,
      overall: typeof r.doc.overall === "number" ? (r.doc.overall as number) : undefined,
      fresh: r.at >= project.updatedAt,
    };
  };

  return NextResponse.json({
    pagesLocked: project.storyboard.length > 0 && project.storyboard.every((b) => b.art),
    pageCount: project.storyboard.length,
    continuity: toStatus(continuity, "issues"),
    narrative: toStatus(narrative, "issues"),
    director: toStatus(director, "retakes"),
  });
}
