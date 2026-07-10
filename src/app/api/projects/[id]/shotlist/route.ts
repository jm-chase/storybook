import { NextResponse } from "next/server";
import { getProject } from "@/lib/project/store";

// Shot list export (PRD): the whole board's scene metadata as JSON or CSV —
// page, scene, text, cast, setting, camera/shot/timing/dialogue, art status.

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
}

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id).catch(() => null);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const castById = new Map(project.cast.map((c) => [c.id, c.name]));
  const envById = new Map(project.environments.map((e) => [e.id, e.name]));
  const rows = project.storyboard.map((b, i) => ({
    page: i + 1,
    scene: b.sceneDescription,
    text: b.text,
    cast: b.castIds.map((cid) => castById.get(cid) ?? "?").join(" + "),
    setting: b.environmentId ? envById.get(b.environmentId) ?? "" : "",
    camera: b.production?.camera ?? "",
    shotNotes: b.production?.shotNotes ?? "",
    timing: b.production?.timing ?? "",
    dialogue: b.production?.dialogue ?? "",
    art: b.art ? "locked" : "none",
  }));

  const format = new URL(req.url).searchParams.get("format") ?? "json";
  const filename = (project.title.replace(/[^\p{L}\p{N} '-]/gu, "").trim() || "book") + " shotlist";
  if (format === "csv") {
    const header = ["page", "scene", "text", "cast", "setting", "camera", "shotNotes", "timing", "dialogue", "art"];
    const csv = [header.join(","), ...rows.map((r) => header.map((h) => csvCell(String(r[h as keyof typeof r]))).join(","))].join("\n");
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }
  return NextResponse.json({ title: project.title, styleId: project.styleId, shots: rows });
}
