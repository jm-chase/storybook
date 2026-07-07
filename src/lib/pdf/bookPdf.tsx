import React from "react";
import { Document, Page, View, Text, Image, renderToBuffer } from "@react-pdf/renderer";
import type { Project, StoryBeat } from "../project/types";
import { readImage } from "../project/store";

// Print PDF export (D-006 layer 1): one square page per beat — full-page art
// with the text typeset in a soft panel (text is NEVER model-rendered, D-020).
// v1 is the *booklet layout*; imposition/bleed/CMYK for POD are R-9 follow-ups.
// 1024² art on an 8in page ≈ 128 DPI — screen/home-print fine, POD needs the
// R-9 upscale pass.

const PAGE = 576; // 8in × 72pt

interface PageArt {
  beat: StoryBeat;
  image?: { data: Buffer; format: "png" | "jpg" };
}

const FORMAT_BY_MIME: Record<string, "png" | "jpg"> = {
  "image/png": "png",
  "image/jpeg": "jpg",
};

function BookDocument({ project, pages, cover }: { project: Project; pages: PageArt[]; cover?: { data: Buffer; format: "png" | "jpg" } }) {
  return (
    <Document title={project.title}>
      {/* Cover */}
      <Page size={[PAGE, PAGE]} style={{ backgroundColor: "#fffdf8", alignItems: "center", justifyContent: "center", padding: 36 }}>
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
        <Page key={beat.id} size={[PAGE, PAGE]} style={{ backgroundColor: "#fffdf8" }}>
          {image && <Image src={image} style={{ position: "absolute", top: 0, left: 0, width: PAGE, height: PAGE }} />}
          {beat.text && (
            <View
              style={{
                position: "absolute",
                bottom: 24,
                left: 28,
                right: 28,
                backgroundColor: image ? "#fffdf8" : undefined,
                opacity: 0.94,
                borderRadius: 12,
                padding: 14,
                ...(image ? {} : { top: 0, justifyContent: "center" }),
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

export async function renderBookPdf(project: Project, root?: string): Promise<Buffer> {
  const pages: PageArt[] = [];
  for (const beat of project.storyboard) {
    let image: PageArt["image"];
    if (beat.art) {
      const img = await readImage(project.id, beat.art.file, root);
      if (img) {
        const format = FORMAT_BY_MIME[img.mimeType];
        if (!format) throw new Error(`PDF export supports png/jpeg art only (got ${img.mimeType}).`);
        image = { data: img.bytes, format };
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

  return renderToBuffer(<BookDocument project={project} pages={pages} cover={cover} />);
}
