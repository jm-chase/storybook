import React from "react";
import { Document, Page, View, Text, Image, renderToBuffer } from "@react-pdf/renderer";
import sharp from "sharp";
import type { Project } from "../project/types";
import { readImage } from "../project/store";
import { HOUSE_STYLE_BY_ID } from "../../content/houseStyles";
import { TRIM, BLEED, interiorPageCount } from "./bookPdf";

// Wraparound POD cover (B-9): ONE landscape spread — back panel, spine, front
// panel — sized from the interior page count. Layout (left → right):
//   [bleed | back panel (trim) | spine | front panel (trim) | bleed]
// height = trim + 2×bleed. Spine width = pages × single-sheet thickness
// (0.002252in/page is Lulu's standard-paper figure; env-overridable). Under
// ~80 pages the spine is too thin for text, so it stays blank.
// This is the perfect-bound/paperback geometry; casewrap hardcover needs the
// partner's wrap allowance added once a package is picked (B-9).

const SHEET_THICKNESS_IN = Number(process.env.PRINT_SHEET_THICKNESS_IN ?? "0.002252");

const PAPER = "#fffdf8";
const INK_SOFT = "#666";

export function spineWidthPt(pages: number): number {
  return pages * SHEET_THICKNESS_IN * 72;
}

interface PdfImage {
  data: Buffer;
  format: "png" | "jpg";
}

const FORMAT_BY_MIME: Record<string, "png" | "jpg"> = {
  "image/png": "png",
  "image/jpeg": "jpg",
};

function CoverDocument({
  project,
  front,
  spine,
  accent,
}: {
  project: Project;
  front?: PdfImage;
  spine: number;
  accent: string;
}) {
  const height = TRIM + 2 * BLEED;
  const width = 2 * (TRIM + BLEED) + spine;
  const styleName = HOUSE_STYLE_BY_ID[project.styleId]?.name ?? project.styleId;
  return (
    <Document title={`${project.title} — cover`}>
      <Page size={[width, height]} style={{ backgroundColor: accent, flexDirection: "row" }}>
        {/* back panel (bleed + trim) */}
        <View style={{ width: BLEED + TRIM, alignItems: "center", justifyContent: "center", padding: 56 }}>
          <Text style={{ fontSize: 16, color: PAPER, textAlign: "center", fontFamily: "Helvetica-Bold" }}>
            {project.title}
          </Text>
          {project.cast.length > 0 && (
            <Text style={{ fontSize: 11, color: PAPER, opacity: 0.85, textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
              A story starring {project.cast.map((c) => c.name).join(", ")} — made just for one very important reader.
            </Text>
          )}
          <Text style={{ fontSize: 9, color: PAPER, opacity: 0.7, marginTop: 28 }}>
            Illustrated in the {styleName} style
          </Text>
        </View>

        {/* spine (blank — too thin for text below ~80 pages) */}
        <View style={{ width: spine }} />

        {/* front panel (trim + bleed) */}
        <View style={{ width: TRIM + BLEED, alignItems: "center", justifyContent: "center", padding: 44 }}>
          {front && <Image src={front} style={{ width: 330, height: 330, borderRadius: 14 }} />}
          <Text style={{ fontSize: 28, color: PAPER, textAlign: "center", fontFamily: "Helvetica-Bold", marginTop: 26 }}>
            {project.title}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderCoverPdf(project: Project, root?: string): Promise<Buffer> {
  const spine = spineWidthPt(interiorPageCount(project));

  let front: PdfImage | undefined;
  const hero = project.cast.find((c) => c.role === "hero" && c.locked);
  if (hero?.locked) {
    const img = await readImage(project.id, hero.locked.file, root);
    const format = img && FORMAT_BY_MIME[img.mimeType];
    if (img && format) front = { data: img.bytes, format };
  }

  // Cover ground colour: the house style's first swatch keeps the cover
  // on-brand for the chosen style without another generation.
  const accent = HOUSE_STYLE_BY_ID[project.styleId]?.swatches[0] ?? "#c2724f";

  // Print the front image at 300 DPI for its displayed size.
  if (front) {
    front = {
      data: await sharp(front.data).resize(1375, 1375, { fit: "cover", kernel: "lanczos3" }).jpeg({ quality: 90 }).toBuffer(),
      format: "jpg",
    };
  }

  return renderToBuffer(<CoverDocument project={project} front={front} spine={spine} accent={accent} />);
}
