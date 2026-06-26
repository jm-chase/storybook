/**
 * Validate the Output Gate checks against images we already generated in the
 * consistency spike — near-free (a few cheap vision calls, no image generation).
 *
 *   npm run validate:gate
 *
 * Expectation: the quality check FAILS the 3-hands scene (04) and PASSES a clean
 * one (02); the consistency check PASSES a same-character scene and may FLAG the
 * style-drifted scene (06).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { qualityCheck } from "../src/lib/art/outputGate/checks/qualityCheck";
import { consistencyCheck } from "../src/lib/art/outputGate/checks/consistencyCheck";
import type { GateContext, ImageCandidate } from "../src/lib/art/outputGate/types";

const OUT = path.resolve(process.cwd(), "spike-output");

function load(file: string): ImageCandidate | null {
  const p = path.join(OUT, file);
  if (!fs.existsSync(p)) return null;
  return { base64: fs.readFileSync(p).toString("base64"), mimeType: "image/png" };
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("\nGEMINI_API_KEY not set. Add it to .env.local, then: npm run validate:gate\n");
    process.exit(1);
  }
  const ref = load("00-character.png");
  if (!ref) {
    console.error("No spike-output images found. Run `npm run spike:consistency` first.");
    process.exit(1);
  }

  // Minimal context (checks only need referenceBase64 for consistency).
  const ctx = { referenceBase64: ref.base64 } as unknown as GateContext;

  const cases: { file: string; label: string; expectQuality: string; expectConsistency: string }[] = [
    { file: "04-scene.png", label: "3-hands defect", expectQuality: "FAIL", expectConsistency: "pass" },
    { file: "02-scene.png", label: "clean forest", expectQuality: "pass", expectConsistency: "pass" },
    { file: "06-scene.png", label: "style-drift asleep", expectQuality: "pass?", expectConsistency: "maybe FAIL" },
  ];

  for (const c of cases) {
    const img = load(c.file);
    if (!img) {
      console.log(`\n## ${c.label} — (missing ${c.file})`);
      continue;
    }
    const q = await qualityCheck.run(img, ctx);
    const con = await consistencyCheck.run(img, ctx);
    console.log(`\n## ${c.label} (${c.file})`);
    console.log(`   quality:     ${q.status.toUpperCase()} — ${q.reason}`);
    console.log(`   consistency: ${con.status.toUpperCase()} — ${con.reason}`);
  }
  console.log("");
}

main().catch((e) => {
  console.error("\nValidation failed:", e?.message ?? e);
  process.exit(1);
});
