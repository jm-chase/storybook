import { NextResponse } from "next/server";
import { getProject, saveProject, saveCastImage, readImage } from "@/lib/project/store";
import { extractManifest } from "@/lib/art/manifest";
import { deriveCharacterCard } from "@/lib/art/characterCard";
import { HOUSE_STYLE_BY_ID } from "@/content/houseStyles";

// Compile an already-locked character (settei backfill): extract the
// feature/wardrobe manifest and derive the character card for cast members
// locked before the settei system existed. New locks compile automatically.

export const runtime = "nodejs";
export const maxDuration = 300;

type Params = { params: Promise<{ id: string; castId: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id, castId } = await params;
  const project = await getProject(id).catch(() => null);
  const member = project?.cast.find((c) => c.id === castId);
  if (!project || !member) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!member.locked) return NextResponse.json({ error: "Lock the character first." }, { status: 409 });
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
  }
  const style = HOUSE_STYLE_BY_ID[project.styleId];
  if (!style) return NextResponse.json({ error: "project has an unknown style" }, { status: 500 });

  const img = await readImage(project.id, member.locked.file);
  if (!img) return NextResponse.json({ error: "The locked reference file is missing." }, { status: 500 });
  const base64 = img.bytes.toString("base64");

  const errors: string[] = [];
  try {
    member.manifest = await extractManifest(base64, img.mimeType, member.description);
  } catch (e) {
    errors.push(`manifest: ${(e as Error).message.slice(0, 100)}`);
  }
  try {
    const card = await deriveCharacterCard({
      refBase64: base64,
      refMimeType: img.mimeType,
      description: member.description,
      style,
    });
    if (card) {
      const cardFile = await saveCastImage(project.id, `${member.id}-card`, card.base64, card.mimeType);
      member.card = { file: cardFile, mimeType: card.mimeType, lockedAt: new Date().toISOString() };
    } else {
      errors.push("card: no candidate passed the gate");
    }
  } catch (e) {
    errors.push(`card: ${(e as Error).message.slice(0, 100)}`);
  }

  if (!member.manifest && !member.card) {
    return NextResponse.json({ error: `Compilation failed — ${errors.join("; ")}` }, { status: 502 });
  }
  const saved = await saveProject(project);
  return NextResponse.json({ project: saved, warnings: errors });
}
