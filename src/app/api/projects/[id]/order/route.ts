import { NextResponse } from "next/server";
import { getProject } from "@/lib/project/store";
import { interiorPageCount } from "@/lib/pdf/bookPdf";
import { luluStatus, luluCostQuote, luluCreatePrintJob, type ShippingAddress } from "@/lib/print/lulu";

// Print ordering (B-9). Two actions on one route:
//   POST { action: "quote", quantity?, shippingAddress, shippingLevel? }
//     → price the book + shipping (needs Lulu creds only).
//   POST { action: "order", quantity?, shippingAddress, contactEmail, shippingLevel? }
//     → create the print job (additionally needs PUBLIC_BASE_URL — Lulu
//       downloads the interior/cover PDFs from our /pdf?pod=1 and /cover URLs,
//       so the app must be reachable from the internet).
// Unconfigured pieces come back as 501 with exactly what's missing.

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

function isAddress(a: unknown): a is ShippingAddress {
  if (typeof a !== "object" || a === null) return false;
  const r = a as Record<string, unknown>;
  return ["name", "street1", "city", "postcode", "country_code"].every(
    (k) => typeof r[k] === "string" && (r[k] as string).trim() !== ""
  );
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id).catch(() => null);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const status = luluStatus();
  if (!status.configured) {
    return NextResponse.json(
      { error: `Print ordering is not configured yet. Missing env: ${status.missing.join(", ")} (see src/lib/print/lulu.ts).` },
      { status: 501 }
    );
  }

  const unlockedPages = project.storyboard.filter((b) => !b.art).length;
  if (project.storyboard.length === 0 || unlockedPages > 0) {
    return NextResponse.json(
      { error: `Every page needs locked art before ordering (${unlockedPages} still unlocked).` },
      { status: 409 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const action = body.action;
  if (action !== "quote" && action !== "order") {
    return NextResponse.json({ error: 'action must be "quote" or "order"' }, { status: 400 });
  }
  if (!isAddress(body.shippingAddress)) {
    return NextResponse.json(
      { error: "shippingAddress needs name, street1, city, postcode, country_code" },
      { status: 400 }
    );
  }
  const quantity = typeof body.quantity === "number" && body.quantity >= 1 ? Math.floor(body.quantity) : 1;
  const shippingLevel = typeof body.shippingLevel === "string" ? body.shippingLevel : undefined;
  const pageCount = interiorPageCount(project);

  try {
    if (action === "quote") {
      const quote = await luluCostQuote({
        pageCount,
        quantity,
        shippingAddress: body.shippingAddress,
        shippingLevel,
      });
      return NextResponse.json({ pageCount, quantity, quote });
    }

    const base = process.env.PUBLIC_BASE_URL?.trim();
    if (!base) {
      return NextResponse.json(
        { error: "Ordering needs PUBLIC_BASE_URL — Lulu fetches the PDFs from our URLs, so the app must be hosted or tunnelled." },
        { status: 501 }
      );
    }
    if (typeof body.contactEmail !== "string" || !body.contactEmail.includes("@")) {
      return NextResponse.json({ error: "contactEmail required for ordering" }, { status: 400 });
    }
    const job = await luluCreatePrintJob({
      title: project.title,
      pageCount,
      quantity,
      contactEmail: body.contactEmail,
      shippingAddress: body.shippingAddress,
      shippingLevel,
      interiorUrl: `${base.replace(/\/$/, "")}/api/projects/${project.id}/pdf?pod=1`,
      coverUrl: `${base.replace(/\/$/, "")}/api/projects/${project.id}/cover`,
    });
    return NextResponse.json({ pageCount, quantity, job });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
