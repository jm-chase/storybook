/**
 * R-18 multi-character spike: do multiple LOCKED characters stay consistent when
 * they appear TOGETHER in one scene? (hero + sidekick, hero + adversary, all three.)
 *
 *   npm run spike:multichar
 *
 * Resumable + throttled, like the consistency spike. Generates 3 character
 * references, then 3 co-appearance scenes, into multichar-output/.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import {
  generateCharacterSheet,
  generateMultiCharacterScene,
  GEMINI_IMAGE_MODEL,
  type CharacterRef,
} from "../src/lib/art/geminiProvider";
import { COST_PER_IMAGE_USD, usd } from "../src/lib/art/cost";
import { HOUSE_STYLE_BY_ID } from "../src/content/houseStyles";

const OUT = path.resolve(process.cwd(), "multichar-output");
const DELAY_MS = Number(process.env.SPIKE_DELAY_MS ?? 6000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const STYLE = HOUSE_STYLE_BY_ID["painted-wonder"];

const CHARS = {
  hero: { label: "the hero", description: "a blond-haired, spunky, brown-eyed 4-year-old girl in a red raincoat" },
  sidekick: { label: "the sidekick", description: "a small round grey baby elephant with big floppy ears" },
  adversary: { label: "the adversary", description: "a grumpy shaggy troll with wild orange hair and a big round nose" },
};

const SCENES: { file: string; who: (keyof typeof CHARS)[]; prompt: string }[] = [
  { file: "scene-hero-sidekick.png", who: ["hero", "sidekick"], prompt: "the girl and the baby elephant walking together along a forest path, happy" },
  { file: "scene-hero-adversary.png", who: ["hero", "adversary"], prompt: "the girl standing bravely in front of the grumpy troll" },
  { file: "scene-all-three.png", who: ["hero", "sidekick", "adversary"], prompt: "the girl and the baby elephant meeting the grumpy troll on a little wooden bridge" },
];

let billed = 0;
function loadB64(file: string): string | null {
  const p = path.join(OUT, file);
  return fs.existsSync(p) ? fs.readFileSync(p).toString("base64") : null;
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("\nGEMINI_API_KEY not set. Add it to .env.local, then: npm run spike:multichar\n");
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`Model: ${GEMINI_IMAGE_MODEL} · style: ${STYLE.name} · throttle: ${DELAY_MS}ms\n`);

  // 1. Character references (reuse if present).
  const refs: Record<string, CharacterRef> = {};
  for (const [key, c] of Object.entries(CHARS)) {
    const file = `ref-${key}.png`;
    let b64 = loadB64(file);
    if (b64) {
      console.log(`ref ${key}: reused`);
    } else {
      await sleep(DELAY_MS);
      console.log(`ref ${key}: generating (${c.description})`);
      const img = await generateCharacterSheet({ name: key, description: c.description, styleId: STYLE.id }, STYLE);
      fs.writeFileSync(path.join(OUT, file), Buffer.from(img.base64, "base64"));
      b64 = img.base64;
      billed++;
    }
    refs[key] = { label: c.label, description: c.description, base64: b64, mimeType: "image/png" };
  }

  // 2. Co-appearance scenes.
  for (const s of SCENES) {
    if (fs.existsSync(path.join(OUT, s.file))) {
      console.log(`${s.file}: reused`);
      continue;
    }
    await sleep(DELAY_MS);
    console.log(`${s.file}: generating [${s.who.join(" + ")}]`);
    const img = await generateMultiCharacterScene({
      characters: s.who.map((k) => refs[k]),
      scenePrompt: s.prompt,
      style: STYLE,
    });
    fs.writeFileSync(path.join(OUT, s.file), Buffer.from(img.base64, "base64"));
    billed++;
  }

  // 3. Report.
  const refImgs = Object.keys(CHARS)
    .map((k) => `<figure><img src="ref-${k}.png" width="200"><figcaption>${k}</figcaption></figure>`)
    .join("");
  const sceneImgs = SCENES.map(
    (s) => `<figure><img src="${s.file}" width="320"><figcaption>${s.who.join(" + ")}</figcaption></figure>`
  ).join("");
  fs.writeFileSync(
    path.join(OUT, "index.html"),
    `<!doctype html><meta charset=utf-8><title>Multi-character spike</title>` +
      `<body style="font-family:sans-serif;background:#f4f1ea;padding:1rem">` +
      `<h1>Multi-character spike — ${STYLE.name}</h1>` +
      `<h3>Locked references</h3><div style="display:flex;gap:1rem">${refImgs}</div>` +
      `<h3>Co-appearance scenes — does each character stay itself?</h3>` +
      `<div style="display:flex;flex-wrap:wrap;gap:1rem">${sceneImgs}</div></body>`
  );

  console.log(`\nGenerated ${billed} new image(s) · cost ${usd(billed)} (@ $${COST_PER_IMAGE_USD}/image).`);
  console.log(`Done → open multichar-output/index.html`);
}

main().catch((e) => {
  console.error("\nSpike failed:", e?.message ?? e);
  console.error("(Re-run to resume — existing images are reused.)");
  process.exit(1);
});
