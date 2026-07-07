import { promises as fs } from "node:fs";
import path from "node:path";
import { generateCharacterSheet, generateScene, GEMINI_IMAGE_MODEL, COST_PER_IMAGE_USD } from "../src/lib/art/geminiProvider";
import { consistencyCheck, qualityCheck } from "../src/lib/art/outputGate/checks";
import { HOUSE_STYLE_BY_ID } from "../src/content/houseStyles";
import type { ImageCandidate } from "../src/lib/art/outputGate/types";

// Consistency eval harness (R-11): a FIXED battery of briefs × scenes, scored
// by the gate's own consistency + quality checks. Run it before/after any
// prompt-template or model change (set GEMINI_IMAGE_MODEL to A/B a model) and
// compare pass rates. Results + images land in eval-output/<stamp>-<model>/.
//
// Run: npm run eval:consistency   (~8 images ≈ $0.31 + vision checks)
// The battery is versioned — do NOT tweak briefs/scenes casually, or runs stop
// being comparable. Bump BATTERY_VERSION if you must change it.

const BATTERY_VERSION = 1;
const THROTTLE_MS = 6000;

const BATTERY = [
  {
    id: "human-child",
    styleId: "painted-wonder",
    brief: { name: "Mia", description: "a blond-haired, spunky, brown-eyed 4-year-old girl in a red raincoat", styleId: "painted-wonder" },
    scenes: [
      "tucked into bed at night, warm lamplight, sleepy smile",
      "reaching up to pick an apple at a busy market stall",
      "splashing in a puddle on a rainy street, laughing",
    ],
  },
  {
    id: "animal",
    styleId: "bright-and-round",
    brief: { name: "Tembo", description: "a small, cheerful baby African elephant with big friendly eyes", styleId: "bright-and-round" },
    scenes: [
      "balancing on a log over a stream, concentrating hard",
      "asleep under a big leaf in soft moonlight",
      "spraying water playfully at a butterfly by a waterhole",
    ],
  },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SceneScore {
  caseId: string;
  scene: string;
  consistency: "pass" | "fail";
  consistencyReason?: string;
  quality: "pass" | "fail";
  qualityReason?: string;
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY missing (.env.local).");
    process.exit(1);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join(process.cwd(), "eval-output", `${stamp}-${GEMINI_IMAGE_MODEL}`);
  await fs.mkdir(outDir, { recursive: true });
  console.log(`Eval v${BATTERY_VERSION} on ${GEMINI_IMAGE_MODEL} → ${outDir}\n`);

  const scores: SceneScore[] = [];
  let images = 0;

  for (const c of BATTERY) {
    const style = HOUSE_STYLE_BY_ID[c.styleId];
    process.stdout.write(`[${c.id}] reference… `);
    const ref = await generateCharacterSheet(c.brief, style);
    images++;
    await fs.writeFile(path.join(outDir, `${c.id}-ref.png`), Buffer.from(ref.base64, "base64"));
    console.log("done");

    for (const [i, scene] of c.scenes.entries()) {
      await sleep(THROTTLE_MS);
      process.stdout.write(`[${c.id}] scene ${i + 1}: ${scene.slice(0, 40)}… `);
      const img = await generateScene({ referenceBase64: ref.base64, referenceMimeType: ref.mimeType, scenePrompt: scene, style });
      images++;
      await fs.writeFile(path.join(outDir, `${c.id}-scene${i + 1}.png`), Buffer.from(img.base64, "base64"));

      const candidate: ImageCandidate = { base64: img.base64, mimeType: img.mimeType };
      const ctx = { brief: c.brief, style, referenceBase64: ref.base64 };
      const [cons, qual] = await Promise.all([consistencyCheck.run(candidate, ctx), qualityCheck.run(candidate, ctx)]);
      scores.push({
        caseId: c.id,
        scene,
        consistency: cons.status,
        consistencyReason: cons.reason,
        quality: qual.status,
        qualityReason: qual.reason,
      });
      console.log(`consistency=${cons.status} quality=${qual.status}`);
    }
  }

  const rate = (k: "consistency" | "quality") => `${scores.filter((s) => s[k] === "pass").length}/${scores.length}`;
  const cost = Number((images * COST_PER_IMAGE_USD).toFixed(3));
  const report = {
    batteryVersion: BATTERY_VERSION,
    model: GEMINI_IMAGE_MODEL,
    date: new Date().toISOString(),
    consistencyPass: rate("consistency"),
    qualityPass: rate("quality"),
    images,
    costUsd: cost,
    scores,
  };
  await fs.writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));

  console.log(`\n== ${GEMINI_IMAGE_MODEL} · battery v${BATTERY_VERSION} ==`);
  console.log(`consistency: ${report.consistencyPass}   quality: ${report.qualityPass}   images: ${images}   cost: $${cost}`);
  for (const s of scores.filter((x) => x.consistency === "fail" || x.quality === "fail")) {
    const which = s.consistency === "fail" ? `consistency: ${s.consistencyReason}` : `quality: ${s.qualityReason}`;
    console.log(`  FAIL [${s.caseId}] "${s.scene.slice(0, 40)}" — ${which}`);
  }
}

main().catch((e) => {
  console.error("eval failed:", (e as Error).message);
  process.exit(1);
});
