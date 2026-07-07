import { NextResponse } from "next/server";
import { getProject } from "@/lib/project/store";
import { renderBookPdf } from "@/lib/pdf/bookPdf";

// Download the book as a PDF (cover + one page per beat). Partial books export
// too — pages without locked art render as text pages.

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id).catch(() => null);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });
  if (project.storyboard.length === 0) {
    return NextResponse.json({ error: "Add at least one page before exporting." }, { status: 409 });
  }

  try {
    const pdf = await renderBookPdf(project);
    const filename = project.title.replace(/[^\p{L}\p{N} '-]/gu, "").trim() || "book";
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
