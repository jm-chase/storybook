import React from "react";
import { Document, Page, View, Text, Image, renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import type { Project, StoryBeat } from "../project/types";
import { readImage } from "../project/store";
import { getStyleById } from "../styles/registry";

// Print PDF export (D-006 layer 1): one square page per beat — full-page art
// with the text typeset in a soft panel (text is NEVER model-rendered, D-020).
// Page art is UPSCALED to 300 DPI at trim size (R-9) with lanczos and embedded
// as high-quality JPEG (keeps a 10-page book's PDF manageable).
//
// Variants:
// - default: home printing — a cover page + story pages at exact 8in trim.
// - bleed:   POD page geometry — 0.125in bleed per edge (8.25in page), art to
//            the bleed edge, text inset past the trim line.
// - pod:     the ORDERABLE interior (implies bleed) — no cover page (POD covers
//            are a separate wraparound file, see coverPdf), front matter
//            (half-title + title page), story, back matter (cast gallery +
//            colophon), padded to the POD minimum and an even page count.
// CMYK conversion is left to the POD service (Lulu et al. accept RGB).

export const TRIM = 576; // 8in × 72pt
export const BLEED = 9; // 0.125in × 72pt, per edge

/** Most POD picture-book bindings require at least this many interior pages. */
export const MIN_POD_INTERIOR_PAGES = 24;

/**
 * Interior page count of the POD variant — deterministic from the project, so
 * the wraparound cover's spine width can be computed without rendering.
 * front matter (2) + story + cast gallery (1) + colophon (1), padded to the
 * POD minimum and rounded up to an even count.
 */
export function interiorPageCount(project: Project): number {
  const n = 2 + project.storyboard.length + 2;
  const even = n % 2 === 0 ? n : n + 1;
  return Math.max(MIN_POD_INTERIOR_PAGES, even);
}

/** Upscale page art to print resolution (300 DPI at the given page size). */
async function toPrintJpeg(data: Buffer, pagePt: number): Promise<Buffer> {
  const px = Math.round((pagePt / 72) * 300);
  return sharp(data)
    .resize(px, px, { fit: "cover", kernel: "lanczos3" })
    .jpeg({ quality: 90 })
    .toBuffer();
}

interface PdfImage {
  data: Buffer;
  format: "png" | "jpg";
}

interface PageArt {
  beat: StoryBeat;
  image?: PdfImage;
}

interface GalleryEntry {
  name: string;
  role: string;
  image?: PdfImage;
}

const FORMAT_BY_MIME: Record<string, "png" | "jpg"> = {
  "image/png": "png",
  "image/jpeg": "jpg",
};

const PAPER = "#fffdf8";
const INK_SOFT = "#666";

function StoryPages({ pages, page, bleed }: { pages: PageArt[]; page: number; bleed: number }) {
  return (
    <>
      {pages.map(({ beat, image }) => (
        <Page key={beat.id} size={[page, page]} style={{ backgroundColor: PAPER }}>
          {image && <Image src={image} style={{ position: "absolute", top: 0, left: 0, width: page, height: page }} />}
          {beat.text && (
            <View
              style={{
                position: "absolute",
                bottom: 24 + bleed,
                left: 28 + bleed,
                right: 28 + bleed,
                backgroundColor: image ? PAPER : undefined,
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
    </>
  );
}

function BookDocument({ project, pages, cover, bleed }: { project: Project; pages: PageArt[]; cover?: PdfImage; bleed: number }) {
  const page = TRIM + 2 * bleed; // art fills this; the printer trims `bleed` off each edge
  return (
    <Document title={project.title}>
      {/* Cover page (home-print variant only — POD covers are a separate file) */}
      <Page size={[page, page]} style={{ backgroundColor: PAPER, alignItems: "center", justifyContent: "center", padding: 36 + bleed }}>
        {cover && <Image src={cover} style={{ width: 320, height: 320, borderRadius: 16 }} />}
        <Text style={{ fontSize: 30, marginTop: 28, textAlign: "center", fontFamily: "Helvetica-Bold" }}>{project.title}</Text>
        {project.cast.length > 0 && (
          <Text style={{ fontSize: 13, marginTop: 12, color: INK_SOFT, textAlign: "center" }}>
            starring {project.cast.map((c) => c.name).join(", ")}
          </Text>
        )}
      </Page>

      <StoryPages pages={pages} page={page} bleed={bleed} />
    </Document>
  );
}

function PodInteriorDocument({
  project,
  pages,
  gallery,
  padPages,
  styleName,
}: {
  project: Project;
  pages: PageArt[];
  gallery: GalleryEntry[];
  padPages: number;
  styleName: string;
}) {
  const bleed = BLEED;
  const page = TRIM + 2 * bleed;
  const hero = project.cast.find((c) => c.role === "hero");
  const year = new Date().getFullYear();
  return (
    <Document title={project.title}>
      {/* 1 — half-title / bookplate */}
      <Page size={[page, page]} style={{ backgroundColor: PAPER, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 15, color: INK_SOFT }}>This book belongs to</Text>
        <View style={{ width: 260, borderBottom: "1.5pt solid #bbb", marginTop: 34 }} />
      </Page>

      {/* 2 — title page */}
      <Page size={[page, page]} style={{ backgroundColor: PAPER, alignItems: "center", justifyContent: "center", padding: 48 + bleed }}>
        <Text style={{ fontSize: 32, textAlign: "center", fontFamily: "Helvetica-Bold" }}>{project.title}</Text>
        {project.cast.length > 0 && (
          <Text style={{ fontSize: 13, marginTop: 16, color: INK_SOFT, textAlign: "center" }}>
            starring {project.cast.map((c) => c.name).join(", ")}
          </Text>
        )}
      </Page>

      <StoryPages pages={pages} page={page} bleed={bleed} />

      {/* cast gallery */}
      <Page size={[page, page]} style={{ backgroundColor: PAPER, padding: 44 + bleed }}>
        <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 20 }}>The cast</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center" }}>
          {gallery.map((g) => (
            <View key={g.name} style={{ width: 150, alignItems: "center", margin: 10 }}>
              {g.image && <Image src={g.image} style={{ width: 130, height: 130, borderRadius: 10 }} />}
              <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 8, textAlign: "center" }}>{g.name}</Text>
              <Text style={{ fontSize: 9, color: INK_SOFT, textAlign: "center" }}>{g.role}</Text>
            </View>
          ))}
        </View>
      </Page>

      {/* colophon */}
      <Page size={[page, page]} style={{ backgroundColor: PAPER, alignItems: "center", justifyContent: "center", padding: 60 + bleed }}>
        <Text style={{ fontSize: 13, color: INK_SOFT, textAlign: "center", lineHeight: 1.6 }}>
          {hero ? `This story was made just for ${hero.name}.` : "This story was made with love."}
        </Text>
        <Text style={{ fontSize: 11, color: INK_SOFT, textAlign: "center", marginTop: 14 }}>
          Illustrated in the {styleName} style · {year}
        </Text>
      </Page>

      {/* padding to the POD minimum / even count */}
      {Array.from({ length: padPages }, (_, i) => (
        <Page key={`pad-${i}`} size={[page, page]} style={{ backgroundColor: PAPER }}>
          <View />
        </Page>
      ))}
    </Document>
  );
}

export async function renderBookPdf(
  project: Project,
  opts: { root?: string; bleed?: boolean; pod?: boolean } = {}
): Promise<Buffer> {
  const { root, pod = false } = opts;
  const bleed = pod || (opts.bleed ?? false);
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

  if (pod) {
    const gallery: GalleryEntry[] = [];
    for (const member of project.cast) {
      let image: PdfImage | undefined;
      if (member.locked) {
        const img = await readImage(project.id, member.locked.file, root);
        const format = img && FORMAT_BY_MIME[img.mimeType];
        if (img && format) image = { data: img.bytes, format };
      }
      gallery.push({ name: member.name, role: member.role, image });
    }
    // Render, then VERIFY the page count: react-pdf silently wraps overflowing
    // sections (a big cast gallery) onto continuation pages, which would break
    // the even-count/spine math. One correction pass adjusts the padding.
    const styleName = (await getStyleById(project.styleId))?.name ?? project.styleId;
    const target = interiorPageCount(project);
    let padPages = target - (2 + pages.length + 2);
    let buf = await renderToBuffer(<PodInteriorDocument project={project} pages={pages} gallery={gallery} padPages={padPages} styleName={styleName} />);
    let count = (await PDFDocument.load(buf)).getPageCount();
    if (count !== target) {
      padPages += target - count;
      if (padPages < 0) {
        throw new Error(`POD interior overflows its page target (${count} rendered vs ${target}) — interiorPageCount needs updating for this book size.`);
      }
      buf = await renderToBuffer(<PodInteriorDocument project={project} pages={pages} gallery={gallery} padPages={padPages} styleName={styleName} />);
      count = (await PDFDocument.load(buf)).getPageCount();
      if (count !== target) throw new Error(`POD interior page count ${count} != target ${target} after correction.`);
    }
    return buf;
  }

  // Cover art: the hero's locked reference, if there is one.
  let cover: PdfImage | undefined;
  const hero = project.cast.find((c) => c.role === "hero" && c.locked);
  if (hero?.locked) {
    const img = await readImage(project.id, hero.locked.file, root);
    const format = img && FORMAT_BY_MIME[img.mimeType];
    if (img && format) cover = { data: img.bytes, format };
  }

  return renderToBuffer(<BookDocument project={project} pages={pages} cover={cover} bleed={bleed ? BLEED : 0} />);
}
