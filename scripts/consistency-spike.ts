/**
 * R-1 consistency eval spike. Proves or kills the core bet: can we hold one
 * freeform-described character visually consistent across many varied scenes?
 *
 * Run after adding GEMINI_API_KEY (and optionally ANTHROPIC_API_KEY) to .env.local:
 *   npm run spike:consistency
 *
 * Generates a character reference, then N scenes conditioned on it, saves them to
 * spike-output/, writes an index.html for human review, and — if an Anthropic key
 * is present — adds an automated same-character score per scene. Prints total cost.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import {
  generateCharacterSheet,
  generateScene,
  COST_PER_IMAGE_USD,
  GEMINI_IMAGE_MODEL,
} from "../src/lib/art/geminiProvider";
import { HOUSE_STYLE_BY_ID } from "../src/content/houseStyles";
import type { CharacterBrief } from "../src/lib/art/types";

const OUT = path.resolve(process.cwd(), "spike-output");

// One character, one style. Scenes vary pose / emotion / environment to stress consistency.
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

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error(
      "\nGEMINI_API_KEY is not set.\n" +
        "Add it to .env.local (GEMINI_API_KEY=...), then run: npm run spike:consistency\n"
    );
    process.exit(1);
  }

  const style = HOUSE_STYLE_BY_ID[BRIEF.styleId];
  const judging = !!process.env.ANTHROPIC_API_KEY;
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`Model: ${GEMINI_IMAGE_MODEL} · style: ${style.name} · judge: ${judging ? "on" : "off"}\n`);

  // Lazy-load the judge only if we have a key (avoids constructing a keyless client).
  const judge = judging
    ? (await import("../src/lib/art/consistencyJudge")).judgeConsistency
    : null;

  let images = 0;

  console.log("Generating character reference…");
  const ref = await generateCharacterSheet(BRIEF, style);
  images++;
  fs.writeFileSync(path.join(OUT, "00-character.png"), Buffer.from(ref.base64, "base64"));

  const rows: string[] = [];
  for (let i = 0; i < SCENES.length; i++) {
    const n = String(i + 1).padStart(2, "0");
    console.log(`Generating scene ${n}: ${SCENES[i]}`);
    const scene = await generateScene({
      referenceBase64: ref.base64,
      referenceMimeType: ref.mimeType,
      scenePrompt: SCENES[i],
      style,
    });
    images++;
    fs.writeFileSync(path.join(OUT, `${n}-scene.png`), Buffer.from(scene.base64, "base64"));

    let verdict = "";
    if (judge) {
      try {
        const v = await judge(ref.base64, scene.base64, ref.mimeType);
        verdict = `same: ${v.sameCharacter} · score ${v.score}/5 — ${v.notes}`;
        console.log(`   judge: ${verdict}`);
      } catch (e) {
        verdict = `judge error: ${(e as Error).message}`;
      }
    }
    rows.push(
      `<figure><img src="${n}-scene.png" width="320"><figcaption>${n}. ${SCENES[i]}<br><small>${verdict}</small></figcaption></figure>`
    );
  }

  const html =
    `<!doctype html><meta charset=utf-8><title>Consistency spike</title>` +
    `<body style="font-family:sans-serif;background:#f4f1ea;padding:1rem">` +
    `<h1>Consistency spike — ${style.name}</h1>` +
    `<p><b>Character:</b> ${BRIEF.description}</p>` +
    `<figure><img src="00-character.png" width="320"><figcaption>Reference sheet</figcaption></figure>` +
    `<hr><div style="display:flex;flex-wrap:wrap;gap:1rem">${rows.join("")}</div></body>`;
  fs.writeFileSync(path.join(OUT, "index.html"), html);

  console.log(
    `\nDone. ${images} images → spike-output/ (open spike-output/index.html).\n` +
      `Est. Gemini cost: $${(images * COST_PER_IMAGE_USD).toFixed(2)} (${images} × $${COST_PER_IMAGE_USD}).`
  );
}

main().catch((e) => {
  console.error("\nSpike failed:", e?.message ?? e);
  process.exit(1);
});
