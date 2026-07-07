import { NextResponse } from "next/server";
import { getProject } from "@/lib/project/store";
import { renderBookPdf } from "@/lib/pdf/bookPdf";

// Download the book as a PDF (cover + one page per beat). Partial books export
// too — pages without locked art render as text pages.
// `?bleed=1` renders the POD variant: 0.125in bleed per edge, art to the bleed
// line — the file print-on-demand services ask for.

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
    const bleed = new URL(req.url).searchParams.get("bleed") === "1";
    const pdf = await renderBookPdf(project, { bleed });
    const filename = (project.title.replace(/[^\p{L}\p{N} '-]/gu, "").trim() || "book") + (bleed ? " (print)" : "");
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
