import { promises as fs } from "node:fs";
import path from "node:path";
import { getGeminiClient } from "../src/lib/art/geminiClient";
import { withRetry } from "../src/lib/art/retry";
import { GEMINI_IMAGE_MODEL, COST_PER_IMAGE_USD } from "../src/lib/art/geminiProvider";
import { HOUSE_STYLES } from "../src/content/houseStyles";

// Style-seed candidates (D-020 refinement 1). Generates N candidate "style
// plates" per house style — the SAME neutral subject rendered in each style,
// so the plates are comparable and demonstrate palette/linework/texture
// without characters or text (nothing that could leak into scenes).
// Output: seed-candidates/<styleId>-<n>.png — a human curates the winner per
// style, which is then downscaled into assets/styleSeeds/ and checked in.
//
// Run: npm run seeds:candidates   (2 per style × 5 styles ≈ $0.39)

const CANDIDATES_PER_STYLE = 2;
const THROTTLE_MS = 6000;

// Neutral, style-revealing subject: landscape + built object + water + sky
// exercises palette, texture, line quality, and edge handling.
const SUBJECT =
  "a rolling green meadow with one large old tree, a winding dirt path, " +
  "a small wooden footbridge over a brook, and soft clouds in a wide sky";

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
    for (let n = 1; n <= CANDIDATES_PER_STYLE; n++) {
      const file = path.join(outDir, `${style.id}-${n}.png`);
      try {
        await fs.access(file);
        console.log(`skip (exists): ${style.id}-${n}`);
        continue;
      } catch {
        /* not yet generated */
      }
      if (images > 0) await sleep(THROTTLE_MS);
      process.stdout.write(`${style.id} candidate ${n}… `);
      const res = await withRetry(() =>
        ai.models.generateContent({
          model: GEMINI_IMAGE_MODEL,
          contents:
            `A children's picture-book illustration: ${SUBJECT}. ` +
            `Art style: ${style.promptFragment}. ` +
            `No people, no animals, no characters, no text or lettering.`,
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
  console.log(`Review ${outDir}, pick one per style, then run the curate step (see docs in this file).`);
}

main().catch((e) => {
  console.error("failed:", (e as Error).message);
  process.exit(1);
});
