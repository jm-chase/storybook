/**
 * R-1 consistency eval spike. Proves or kills the core bet: can we hold one
 * freeform-described character visually consistent across many varied scenes?
 *
 *   npm run spike:consistency
 *
 * - Generates a character reference, then N scenes conditioned on it.
 * - RESUMABLE: any image already in spike-output/ is reused, so a re-run after a
 *   transient failure only generates what's missing (gentle on credit).
 * - Throttled between generations (SPIKE_DELAY_MS, default 6s) + retry on 429/503.
 * - Prints a live cost table as it goes, then per-book projections.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { generateCharacterSheet, generateScene, GEMINI_IMAGE_MODEL } from "../src/lib/art/geminiProvider";
import { COST_PER_IMAGE_USD, usd, bookProjections } from "../src/lib/art/cost";
import { HOUSE_STYLE_BY_ID } from "../src/content/houseStyles";
import type { CharacterBrief } from "../src/lib/art/types";

const OUT = path.resolve(process.cwd(), "spike-output");
const DELAY_MS = Number(process.env.SPIKE_DELAY_MS ?? 6000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const BRIEF: CharacterBrief = {
  name: "Mia",
  description: "a blond-haired, spunky, brown-eyed 4-year-old girl in a red raincoat",
  styleId: "painted-wonder",
};

const SCENES = [
  "waking up in bed, sleepy, morning light",
  "walking through a rainy forest, nervous, holding an umbrella",
  "standing at the door of a big school, worried",
  "taking one brave step forward, determined",
  "laughing and playing at the seaside, joyful",
  "asleep at home that night, calm and content",
];

// --- live cost table ---
let billed = 0; // images generated THIS run (resumed images were already paid)
function row(item: string, status: "new" | "reused") {
  if (status === "new") billed++;
  const cost = status === "new" ? `$${COST_PER_IMAGE_USD.toFixed(3)}` : "—";
  const run = status === "new" ? usd(billed) : usd(billed);
  console.log(
    `| ${item.padEnd(40)} | ${status.padEnd(6)} | ${cost.padStart(7)} | ${run.padStart(8)} |`
  );
}
function header() {
  console.log(`| ${"item".padEnd(40)} | ${"status".padEnd(6)} | ${"$/img".padStart(7)} | ${"run $".padStart(8)} |`);
  console.log(`|${"-".repeat(42)}|${"-".repeat(8)}|${"-".repeat(9)}|${"-".repeat(10)}|`);
}

function loadBase64(file: string): string | null {
  return fs.existsSync(file) ? fs.readFileSync(file).toString("base64") : null;
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("\nGEMINI_API_KEY is not set. Add it to .env.local, then: npm run spike:consistency\n");
    process.exit(1);
  }

  const style = HOUSE_STYLE_BY_ID[BRIEF.styleId];
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`Model: ${GEMINI_IMAGE_MODEL} · style: ${style.name} · throttle: ${DELAY_MS}ms\n`);
  console.log(`Character: ${BRIEF.description}\n`);
  header();

  // Character reference (reuse if present).
  const charPath = path.join(OUT, "00-character.png");
  let refBase64 = loadBase64(charPath);
  if (refBase64) {
    row("character reference", "reused");
  } else {
    await sleep(DELAY_MS);
    const ref = await generateCharacterSheet(BRIEF, style);
    fs.writeFileSync(charPath, Buffer.from(ref.base64, "base64"));
    refBase64 = ref.base64;
    row("character reference", "new");
  }

  // Scenes (reuse any already present).
  const reportRows: string[] = [];
  for (let i = 0; i < SCENES.length; i++) {
    const n = String(i + 1).padStart(2, "0");
    const scenePath = path.join(OUT, `${n}-scene.png`);
    if (fs.existsSync(scenePath)) {
      row(`scene ${n}: ${SCENES[i]}`, "reused");
    } else {
      await sleep(DELAY_MS);
      const scene = await generateScene({
        referenceBase64: refBase64,
        scenePrompt: SCENES[i],
        style,
      });
      fs.writeFileSync(scenePath, Buffer.from(scene.base64, "base64"));
      row(`scene ${n}: ${SCENES[i]}`, "new");
    }
    reportRows.push(
      `<figure><img src="${n}-scene.png" width="320"><figcaption>${n}. ${SCENES[i]}</figcaption></figure>`
    );
  }

  // HTML report.
  const html =
    `<!doctype html><meta charset=utf-8><title>Consistency spike</title>` +
    `<body style="font-family:sans-serif;background:#f4f1ea;padding:1rem">` +
    `<h1>Consistency spike — ${style.name}</h1><p><b>Character:</b> ${BRIEF.description}</p>` +
    `<figure><img src="00-character.png" width="320"><figcaption>Reference sheet</figcaption></figure><hr>` +
    `<div style="display:flex;flex-wrap:wrap;gap:1rem">${reportRows.join("")}</div></body>`;
  fs.writeFileSync(path.join(OUT, "index.html"), html);

  // Cost summary + per-book projections.
  console.log(`\nGenerated ${billed} new image(s) this run · cost ${usd(billed)} (@ $${COST_PER_IMAGE_USD}/image).`);
  console.log(`\nProjected per-book cost (${SCENES.length} pages + 1 character + 1 environment):`);
  console.log(`| ${"scenario".padEnd(34)} | ${"images".padStart(6)} | ${"cost".padStart(7)} |`);
  console.log(`|${"-".repeat(36)}|${"-".repeat(8)}|${"-".repeat(9)}|`);
  for (const p of bookProjections(SCENES.length)) {
    console.log(`| ${p.label.padEnd(34)} | ${String(p.images).padStart(6)} | ${p.cost.padStart(7)} |`);
  }
  console.log(`\nDone → open spike-output/index.html`);
}

main().catch((e) => {
  console.error("\nSpike failed:", e?.message ?? e);
  console.error("(Re-run to resume — already-generated images are reused.)");
  process.exit(1);
});
