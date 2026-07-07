import { NextResponse } from "next/server";
import { getProject } from "@/lib/project/store";
import { renderCoverPdf } from "@/lib/pdf/coverPdf";

// Wraparound POD cover: back + spine + front in one landscape spread, spine
// sized from the interior page count. Pairs with the interior at /pdf?pod=1.

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id).catch(() => null);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });
  if (project.storyboard.length === 0) {
    return NextResponse.json({ error: "Add at least one page before exporting." }, { status: 409 });
  }

  try {
    const pdf = await renderCoverPdf(project);
    const filename = (project.title.replace(/[^\p{L}\p{N} '-]/gu, "").trim() || "book") + " (cover)";
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
