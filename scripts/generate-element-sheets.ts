import { promises as fs } from "node:fs";
import path from "node:path";
import { getGeminiClient } from "../src/lib/art/geminiClient";
import { withRetry } from "../src/lib/art/retry";
import { GEMINI_IMAGE_MODEL, COST_PER_IMAGE_USD } from "../src/lib/art/geminiProvider";
import { HOUSE_STYLES } from "../src/content/houseStyles";
import { getStyleSeed } from "../src/lib/art/styleSeed";

// Element-vocabulary candidates (James, 2026-07-09): a per-style reference
// sheet showing HOW THIS STYLE DRAWS the recurring natural elements — sky,
// clouds, sun, trees, grass, bushes, flowers, rocks, water. Passed as a second
// style reference on every generation so these elements stop being re-invented
// per page. Conditioned on the style's locked seed plate for coherence.
// Output: seed-candidates/<styleId>-elements-<n>.png → curate → downscale into
// assets/styleSeeds/<styleId>-elements.jpg (seedRefs[1]).
//
// Run: npm run seeds:elements   (2 per style × 5 styles ≈ $0.39)

const CANDIDATES_PER_STYLE = 2;
const THROTTLE_MS = 6000;

const SHEET =
  "a clean reference sheet on a plain pale background showing, clearly separated from each other " +
  "in a loose grid with generous spacing: one fluffy cloud, one sun, one leafy deciduous tree, " +
  "one pine tree, one tuft of grass, one flowering bush, one single flower, one rock, " +
  "and a small patch of rippling water";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY missing (.env.local).");
    process.exit(1);
  }
  const outDir = path.join(process.cwd(), "seed-candidates");
  await fs.mkdir(outDir, { recursive: true });
  const ai = getGeminiClient();
  let images = 0;

  for (const style of HOUSE_STYLES) {
    const seed = await getStyleSeed(style);
    for (let n = 1; n <= CANDIDATES_PER_STYLE; n++) {
      const file = path.join(outDir, `${style.id}-elements-${n}.png`);
      try {
        await fs.access(file);
        console.log(`skip (exists): ${style.id}-elements-${n}`);
        continue;
      } catch {
        /* not yet generated */
      }
      if (images > 0) await sleep(THROTTLE_MS);
      process.stdout.write(`${style.id} elements candidate ${n}… `);
      const text =
        (seed ? "Image 1 is the ART STYLE reference — match its rendering technique, texture, palette, linework, and lighting exactly. " : "") +
        `${SHEET}. Art style: ${style.promptFragment}. No characters, no text or lettering, no labels. ` +
        `Absolutely NO faces, eyes, or smiles on any element — the sun, clouds, trees, bushes, and flowers ` +
        `are plain scenery, not characters.`;
      const res = await withRetry(() =>
        ai.models.generateContent({
          model: GEMINI_IMAGE_MODEL,
          contents: seed
            ? [{ text }, { inlineData: { mimeType: seed.mimeType, data: seed.base64 } }]
            : text,
        })
      );
      const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part?.inlineData?.data) throw new Error("no image returned");
      await fs.writeFile(file, Buffer.from(part.inlineData.data, "base64"));
      images++;
      console.log("done");
    }
  }
  console.log(`\n${images} images · ~$${(images * COST_PER_IMAGE_USD).toFixed(3)}`);
  console.log(`Review ${outDir}, pick one per style, downscale winners into assets/styleSeeds/<id>-elements.jpg.`);
}

main().catch((e) => {
  console.error("failed:", (e as Error).message);
  process.exit(1);
});
