import { NextResponse } from "next/server";
import { getProject } from "@/lib/project/store";
import { renderBookPdf } from "@/lib/pdf/bookPdf";

// Download the book as a PDF (cover + one page per beat). Partial books export
// too — pages without locked art render as text pages.
// `?bleed=1` adds POD page geometry (0.125in bleed per edge, art to the bleed
// line). `?pod=1` renders the full ORDERABLE interior: bleed + front matter +
// cast gallery + colophon, padded to the POD page minimum (pairs with the
// wraparound cover at /cover).

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id).catch(() => null);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });
  if (project.storyboard.length === 0) {
    return NextResponse.json({ error: "Add at least one page before exporting." }, { status: 409 });
  }

  try {
    const q = new URL(req.url).searchParams;
    const pod = q.get("pod") === "1";
    const bleed = q.get("bleed") === "1";
    const pdf = await renderBookPdf(project, { bleed, pod });
    const filename =
      (project.title.replace(/[^\p{L}\p{N} '-]/gu, "").trim() || "book") + (pod ? " (interior)" : bleed ? " (print)" : "");
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}.pdf"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
