import React from "react";
import { Document, Page, View, Text, Image, renderToBuffer } from "@react-pdf/renderer";
import sharp from "sharp";
import type { Project, StoryBeat } from "../project/types";
import { readImage } from "../project/store";

// Print PDF export (D-006 layer 1): one square page per beat — full-page art
// with the text typeset in a soft panel (text is NEVER model-rendered, D-020).
// Page art is UPSCALED to 300 DPI at trim size (R-9) with lanczos and embedded
// as high-quality JPEG (keeps a 10-page book's PDF manageable).
// POD prepress (R-9): `bleed: true` adds the standard 0.125in bleed per edge —
// the page grows to 8.25in, art runs to the bleed edge (trimmed off by the
// printer), and text keeps a safety inset from the trim line. CMYK conversion
// is left to the POD service (KDP/Lulu/IngramSpark accept RGB and convert).

const TRIM = 576; // 8in × 72pt
const BLEED = 9; // 0.125in × 72pt, per edge

/** Upscale page art to print resolution (300 DPI at the given page size). */
async function toPrintJpeg(data: Buffer, pagePt: number): Promise<Buffer> {
  const px = Math.round((pagePt / 72) * 300);
  return sharp(data)
    .resize(px, px, { fit: "cover", kernel: "lanczos3" })
    .jpeg({ quality: 90 })
    .toBuffer();
}

interface PageArt {
  beat: StoryBeat;
  image?: { data: Buffer; format: "png" | "jpg" };
}

const FORMAT_BY_MIME: Record<string, "png" | "jpg"> = {
  "image/png": "png",
  "image/jpeg": "jpg",
};

function BookDocument({ project, pages, cover, bleed }: { project: Project; pages: PageArt[]; cover?: { data: Buffer; format: "png" | "jpg" }; bleed: number }) {
  const page = TRIM + 2 * bleed; // art fills this; the printer trims `bleed` off each edge
  return (
    <Document title={project.title}>
      {/* Cover */}
      <Page size={[page, page]} style={{ backgroundColor: "#fffdf8", alignItems: "center", justifyContent: "center", padding: 36 + bleed }}>
        {cover && <Image src={cover} style={{ width: 320, height: 320, borderRadius: 16 }} />}
        <Text style={{ fontSize: 30, marginTop: 28, textAlign: "center", fontFamily: "Helvetica-Bold" }}>{project.title}</Text>
        {project.cast.length > 0 && (
          <Text style={{ fontSize: 13, marginTop: 12, color: "#666", textAlign: "center" }}>
            starring {project.cast.map((c) => c.name).join(", ")}
          </Text>
        )}
      </Page>

      {/* Story pages */}
      {pages.map(({ beat, image }) => (
        <Page key={beat.id} size={[page, page]} style={{ backgroundColor: "#fffdf8" }}>
          {image && <Image src={image} style={{ position: "absolute", top: 0, left: 0, width: page, height: page }} />}
          {beat.text && (
            <View
              style={{
                position: "absolute",
                bottom: 24 + bleed,
                left: 28 + bleed,
                right: 28 + bleed,
                backgroundColor: image ? "#fffdf8" : undefined,
                opacity: 0.94,
                borderRadius: 12,
                padding: 14,
                ...(image ? {} : { top: bleed, justifyContent: "center" }),
              }}
            >
              <Text style={{ fontSize: 16, textAlign: "center", lineHeight: 1.45 }}>{beat.text}</Text>
            </View>
          )}
        </Page>
      ))}
    </Document>
  );
}

export async function renderBookPdf(project: Project, opts: { root?: string; bleed?: boolean } = {}): Promise<Buffer> {
  const { root, bleed = false } = opts;
  const pagePt = TRIM + (bleed ? 2 * BLEED : 0);
  const pages: PageArt[] = [];
  for (const beat of project.storyboard) {
    let image: PageArt["image"];
    if (beat.art) {
      const img = await readImage(project.id, beat.art.file, root);
      if (img) {
        if (!FORMAT_BY_MIME[img.mimeType]) throw new Error(`PDF export supports png/jpeg art only (got ${img.mimeType}).`);
        image = { data: await toPrintJpeg(img.bytes, pagePt), format: "jpg" };
      }
    }
    pages.push({ beat, image });
  }

  // Cover art: the hero's locked reference, if there is one.
  let cover: PageArt["image"];
  const hero = project.cast.find((c) => c.role === "hero" && c.locked);
  if (hero?.locked) {
    const img = await readImage(project.id, hero.locked.file, root);
    const format = img && FORMAT_BY_MIME[img.mimeType];
    if (img && format) cover = { data: img.bytes, format };
  }

  return renderToBuffer(<BookDocument project={project} pages={pages} cover={cover} bleed={bleed ? BLEED : 0} />);
}
