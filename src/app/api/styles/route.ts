import { NextResponse } from "next/server";
import sharp from "sharp";
import { listStyles, getStyleById, saveCustomStyle, writeStyleFile } from "@/lib/styles/registry";
import { deriveStyleDefinition, deriveStylePlate } from "@/lib/styles/deriveStyle";
import { safetyCheck } from "@/lib/art/outputGate/checks";
import { HOUSE_STYLES } from "@/content/houseStyles";
import { screenFields } from "@/lib/safety/moderateFreeform";
import type { HouseStyle } from "@/lib/art/types";

// Styles API (2026-07-11).
// GET  — every style (built-ins + the user's custom styles), server paths stripped.
// POST — mint a CUSTOM style from the user's own reference images:
//        { name?, imageDataUrls: string[1..3], attestation: true }
//        Legal posture: rights attestation is required and recorded; every
//        image passes the safety screen; the derived definition is technique
//        attributes only (never third-party names). The new style gets its own
//        seed plate + element sheet so it behaves exactly like a built-in.

export const runtime = "nodejs";
export const maxDuration = 300;

const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;
const MAX_IMAGES = 3;
const MAX_BYTES = 8 * 1024 * 1024;

function publicStyle(s: HouseStyle): Omit<HouseStyle, "seedDir"> {
  const { seedDir: _drop, ...pub } = s;
  return pub;
}

export async function GET() {
  return NextResponse.json({ styles: (await listStyles()).map(publicStyle) });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const b = body as { name?: unknown; imageDataUrls?: unknown; attestation?: unknown };

  if (b.attestation !== true) {
    return NextResponse.json(
      { error: "You must confirm you own these images or have the rights to use them." },
      { status: 400 }
    );
  }
  const urls = Array.isArray(b.imageDataUrls) ? b.imageDataUrls : [];
  if (urls.length < 1 || urls.length > MAX_IMAGES) {
    return NextResponse.json({ error: `Upload 1–${MAX_IMAGES} reference images.` }, { status: 400 });
  }
  const refs: { base64: string; mimeType: string }[] = [];
  for (const u of urls) {
    const m = typeof u === "string" ? u.match(DATA_URL) : null;
    if (!m) return NextResponse.json({ error: "Each image must be a png/jpeg/webp data URL." }, { status: 400 });
    if (m[2].length > (MAX_BYTES * 4) / 3) return NextResponse.json({ error: "Each image must be under 8MB." }, { status: 400 });
    refs.push({ base64: m[2], mimeType: m[1] });
  }
  const hint = typeof b.name === "string" ? b.name.replace(/\s+/g, " ").trim().slice(0, 40) : "";
  if (hint) {
    const screened = await screenFields({ styleName: hint });
    if (!screened.ok) return NextResponse.json({ error: screened.message }, { status: screened.status });
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
  }

  // Safety screen EVERY uploaded image (fail closed) before deriving anything.
  const screenCtx = { brief: { name: "", description: "user-uploaded style reference", styleId: HOUSE_STYLES[0].id }, style: HOUSE_STYLES[0] };
  for (const [i, r] of refs.entries()) {
    const verdict = await safetyCheck.run({ base64: r.base64, mimeType: r.mimeType }, screenCtx);
    if (verdict.status !== "pass") {
      return NextResponse.json(
        { error: `Reference image ${i + 1} didn't pass the safety screen${verdict.reason ? ` (${verdict.reason.slice(0, 120)})` : ""}.` },
        { status: 400 }
      );
    }
  }

  try {
    const def = await deriveStyleDefinition(refs, hint || undefined);
    const id = `custom-${Date.now().toString(36)}`;
    const style: HouseStyle = {
      id,
      name: hint || def.name,
      blurb: def.blurb,
      promptFragment: def.promptFragment,
      swatches: def.swatches.length === 4 ? def.swatches : ["#c2724f", "#7d9a8f", "#e7cfa6", "#3f4a3a"],
      seedRefs: ["seed.jpg", "elements.jpg"],
    };

    const seed = await deriveStylePlate({ refs, style, kind: "seed" });
    if (!seed) throw new Error("no seed plate passed the gate");
    const elements = await deriveStylePlate({ refs, style, kind: "elements" });
    if (!elements) throw new Error("no element sheet passed the gate");

    const toJpg = async (b64: string) =>
      sharp(Buffer.from(b64, "base64")).resize(512, 512, { fit: "inside", kernel: "lanczos3" }).jpeg({ quality: 85 }).toBuffer();
    await writeStyleFile(id, "seed.jpg", await toJpg(seed.base64));
    await writeStyleFile(id, "elements.jpg", await toJpg(elements.base64));
    for (const [i, r] of refs.entries()) {
      await writeStyleFile(
        id,
        `ref-${i + 1}.jpg`,
        await sharp(Buffer.from(r.base64, "base64")).resize(768, 768, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer()
      );
    }
    await saveCustomStyle({ ...style, custom: true } as HouseStyle);
    // Record the attestation alongside the style (audit trail).
    await writeStyleFile(id, "attestation.json", Buffer.from(JSON.stringify({ attestedAt: new Date().toISOString(), images: refs.length }), "utf8"));

    const created = await getStyleById(id);
    return NextResponse.json({ style: created ? publicStyle(created) : publicStyle(style) }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: `Could not mint the style: ${(e as Error).message.slice(0, 160)}` }, { status: 502 });
  }
}
