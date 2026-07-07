import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { HOUSE_STYLES, HOUSE_STYLE_BY_ID } from "../src/content/houseStyles";
import { getStyleSeed } from "../src/lib/art/styleSeed";
import { generateCharacterVariants } from "../src/lib/art/generateCharacterVariants";
import { generateSceneVariants } from "../src/lib/art/generateSceneVariants";

// One-shot live validation of style-seed locking (D-020 refinement 1):
// 1. every house style resolves a seed from assets/styleSeeds/
// 2. a seeded character sheet + a seeded no-cast scene generate clean in
//    painted-wonder, on a subject UNRELATED to the seed plate's meadow —
//    outputs land in seed-validation/ for eyeball review (style held? any
//    meadow/tree/bridge content leaking from the plate?).

const OUT = path.join(process.cwd(), "seed-validation");

async function main() {
  for (const s of HOUSE_STYLES) {
    const seed = await getStyleSeed(s);
    if (!seed) throw new Error(`No seed resolved for ${s.id}`);
    console.log(`seed ok: ${s.id} (${Math.round((seed.base64.length * 3) / 4 / 1024)} KB)`);
  }

  await mkdir(OUT, { recursive: true });
  const style = HOUSE_STYLE_BY_ID["painted-wonder"];

  console.log("\ngenerating seeded character sheet…");
  const cast = await generateCharacterVariants(
    { name: "", description: "a small curious badger wearing a yellow raincoat and red boots", styleId: style.id },
    style,
    { variantsWanted: 1, maxAttempts: 3 }
  );
  if (cast.variants.length === 0) throw new Error(`character sheet failed: ${cast.rejected.join(" | ")}`);
  await writeFile(path.join(OUT, "character.png"), Buffer.from(cast.variants[0].base64, "base64"));
  console.log(`character: ${cast.attempts} attempt(s), $${cast.costUsd}`);

  console.log("\ngenerating seeded no-cast scene (subject unrelated to the seed plate)…");
  const scene = await generateSceneVariants({
    scenePrompt: "a cozy lamplit bakery interior at night, shelves of bread, a cat asleep by the oven",
    style,
    characters: [],
    opts: { variantsWanted: 1, maxAttempts: 3 },
  });
  if (scene.variants.length === 0) throw new Error(`scene failed: ${scene.rejected.join(" | ")}`);
  await writeFile(path.join(OUT, "scene.png"), Buffer.from(scene.variants[0].base64, "base64"));
  console.log(`scene: ${scene.attempts} attempt(s), $${scene.costUsd}`);

  console.log(`\ndone — review ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
