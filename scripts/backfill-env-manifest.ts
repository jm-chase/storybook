// One-off backfill: extract the landmark manifest for already-locked
// environments that predate the 2026-07-20 environment-manifest feature.
// Run: node --env-file-if-exists=.env.local --import tsx scripts/backfill-env-manifest.ts <projectId>

export {};

import { extractEnvironmentManifest } from "../src/lib/art/manifest";
import { getProject, saveProject, readImage } from "../src/lib/project/store";

async function main() {
  const pid = process.argv[2];
  if (!pid) throw new Error("usage: backfill-env-manifest.ts <projectId>");
  const project = await getProject(pid);
  if (!project) throw new Error(`project ${pid} not found`);
  for (const env of project.environments) {
    if (!env.locked || env.manifest) {
      console.log(env.name, "skip (no lock or already has manifest)");
      continue;
    }
    const img = await readImage(project.id, env.locked.file);
    if (!img) {
      console.log(env.name, "skip (locked file missing)");
      continue;
    }
    const manifest = await extractEnvironmentManifest(img.bytes.toString("base64"), img.mimeType, env.description);
    env.manifest = manifest;
    console.log(env.name, "->", JSON.stringify(manifest.landmarks));
  }
  await saveProject(project);
  console.log("saved");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
