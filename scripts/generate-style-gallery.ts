import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { HOUSE_STYLES } from "../src/content/houseStyles";
import { getStyleSeed, getElementSheet } from "../src/lib/art/styleSeed";
import { generateStandaloneScene } from "../src/lib/art/geminiProvider";
import { runGate } from "../src/lib/art/outputGate/runGate";
import { safetyCheck, qualityCheck } from "../src/lib/art/outputGate/checks";

// Style GALLERY pieces (2026-07-11): two extra subjects per built-in style so
// the picker shows each style's real range (the meadow plate alone undersells
// them). Served by /api/styles/[id]/asset/ from assets/styleSeeds/.
// Run: npm run seeds:gallery   (2 × 5 styles ≈ $0.4 + rerolls)

const SUBJECTS: [string, string][] = [
  // g1's space is explicitly an underground den so the indoor/outdoor-ground
  // spatial rule doesn't fire on its earthen floor.
  ["g1", "a small fox wearing a scarf reading a book by lantern light inside its underground den — a cozy room dug into the earth, with earthen walls, a round wooden door, bookshelves, and teacups — at night"],
  ["g2", "a little sailboat with a striped sail on a bright sea, approaching a tiny harbor village with round houses, midday"],
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY missing (.env.local).");
    process.exit(1);
  }
  const outDir = path.join(process.cwd(), "assets", "styleSeeds");
  let images = 0;

  for (const style of HOUSE_STYLES) {
    const styleSeed = (await getStyleSeed(style)) ?? undefined;
    const elementSheet = (await getElementSheet(style)) ?? undefined;
    for (const [tag, subject] of SUBJECTS) {
      const file = path.join(outDir, `${style.id}-${tag}.jpg`);
      try {
        await fs.access(file);
        console.log(`skip (exists): ${style.id}-${tag}`);
        continue;
      } catch {
        /* generate */
      }
      if (images > 0) await sleep(6000);
      process.stdout.write(`${style.id} ${tag}… `);
      const outcome = await runGate(
        async (avoid?: string) => {
          const img = await generateStandaloneScene({
            scenePrompt: (avoid ? `(A previous attempt was rejected for: ${avoid} — avoid that.) ` : "") + subject,
            style,
            styleSeed,
            elementSheet,
          });
          return { base64: img.base64, mimeType: img.mimeType };
        },
        [safetyCheck, qualityCheck],
        { brief: { name: "", description: subject, styleId: style.id }, style, kind: "environment" },
        { variantsWanted: 1, maxAttempts: 2 }
      );
      images += outcome.attempts;
      if (outcome.variants.length === 0) {
        console.log("FAILED gate — skipping");
        continue;
      }
      await fs.writeFile(
        file,
        await sharp(Buffer.from(outcome.variants[0].base64, "base64"))
          .resize(512, 512, { fit: "inside", kernel: "lanczos3" })
          .jpeg({ quality: 85 })
          .toBuffer()
      );
      console.log("done");
    }
  }
  console.log(`\n${images} generations · ~$${(images * 0.039).toFixed(3)}`);
}

main().catch((e) => {
  console.error("failed:", (e as Error).message);
  process.exit(1);
});
