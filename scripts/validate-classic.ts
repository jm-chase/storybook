// End-to-end CLASSIC book validation (skin 2): instantiate a template →
// lock the full cast (hero + pre-cast companions) → generate + lock every
// page → export the POD interior + wraparound cover and verify their
// geometry. Exercises the whole engine as of D-020 closure: style seeds,
// identity/wardrobe separation, caption-space composition, POD package.
// Dev server must be running (npm run dev).
//
// Run: npm run validate:classic   (~$1.2–1.8 depending on rerolls)

import { writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const TEMPLATE_ID = "three-little-pigs";
const HERO = {
  heroName: "Finn",
  heroDescription: "a freckled 5-year-old boy with curly red hair, green eyes, and a blue hoodie",
};

interface Gen {
  variants?: string[];
  attempts?: number;
  costUsd?: number;
  satisfied?: boolean;
  error?: string;
}

interface ProjectDoc {
  id: string;
  title: string;
  cast: { id: string; name: string; role: string; description: string }[];
  environments: { id: string; name: string }[];
  storyboard: { id: string; text: string; castIds: string[] }[];
  styleId: string;
}

let totalCost = 0;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("ndjson")) {
    let done: T | undefined;
    let error: string | undefined;
    for (const line of (await res.text()).split("\n")) {
      if (!line.trim()) continue;
      const msg = JSON.parse(line) as { done?: T; error?: string };
      if (msg.done) done = msg.done;
      if (msg.error) error = msg.error;
    }
    if (error || !done) throw new Error(`${init?.method ?? "GET"} ${path} → stream: ${error ?? "no result"}`);
    return done;
  }
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}: ${data.error}`);
  return data;
}

async function generateAndLock(label: string, genPath: string, genBody: unknown, lockPath: string): Promise<void> {
  const t0 = Date.now();
  process.stdout.write(`  generating ${label}… `);
  const gen = await api<Gen>(genPath, { method: "POST", body: JSON.stringify(genBody ?? {}) });
  totalCost += gen.costUsd ?? 0;
  console.log(
    `${gen.variants?.length} variants / ${gen.attempts} attempts / $${gen.costUsd} / ${Math.round(
      (Date.now() - t0) / 1000
    )}s${gen.satisfied ? "" : " (budget hit)"}`
  );
  await api(lockPath, { method: "POST", body: JSON.stringify({ imageDataUrl: gen.variants![0] }) });
  console.log(`  🔒 locked ${label}`);
}

async function main() {
  console.log(`Classic-book E2E against ${BASE} — template "${TEMPLATE_ID}"\n`);

  const { project } = await api<{ project: ProjectDoc }>("/api/projects/from-template", {
    method: "POST",
    body: JSON.stringify({ templateId: TEMPLATE_ID, ...HERO }),
  });
  const pid = project.id;
  console.log(
    `project: "${project.title}" (${pid}) — ${project.cast.length} cast, ${project.environments.length} settings, ${project.storyboard.length} beats\n`
  );

  for (const member of project.cast) {
    await generateAndLock(
      `${member.role} ${member.name}`,
      "/api/generate-character",
      { name: member.name, description: member.description, styleId: project.styleId },
      `/api/projects/${pid}/cast/${member.id}/lock`
    );
  }

  console.log();
  for (const env of project.environments) {
    await generateAndLock(
      `setting ${env.name}`,
      `/api/projects/${pid}/environments/${env.id}/generate`,
      {},
      `/api/projects/${pid}/environments/${env.id}/lock`
    );
  }

  console.log();
  for (const [i, beat] of project.storyboard.entries()) {
    await generateAndLock(
      `page ${i + 1} (${beat.castIds.length} character(s))`,
      `/api/projects/${pid}/beats/${beat.id}/generate`,
      {},
      `/api/projects/${pid}/beats/${beat.id}/lock`
    );
  }

  // POD exports: verify geometry, save alongside for eyeballing.
  console.log();
  const interior = Buffer.from(await (await fetch(`${BASE}/api/projects/${pid}/pdf?pod=1`)).arrayBuffer());
  const iDoc = await PDFDocument.load(interior);
  const iSize = iDoc.getPage(0).getSize();
  console.log(`interior: ${iDoc.getPageCount()} pages @ ${iSize.width}x${iSize.height}pt`);
  await writeFile("classic-interior.pdf", interior);

  const cover = Buffer.from(await (await fetch(`${BASE}/api/projects/${pid}/cover`)).arrayBuffer());
  const cDoc = await PDFDocument.load(cover);
  const cSize = cDoc.getPage(0).getSize();
  console.log(`cover: ${cSize.width.toFixed(2)}x${cSize.height}pt (spine = width − 1170)`);
  await writeFile("classic-cover.pdf", cover);

  // Book-level continuity review (logged to the project's continuity/ dir).
  console.log("\nrunning continuity review…");
  try {
    const { report } = await api<{
      report: { pagesReviewed: number; issues: { pages: number[]; severity: string; what: string }[] };
    }>(`/api/projects/${pid}/continuity`, { method: "POST" });
    if (report.issues.length === 0) {
      console.log(`continuity: ✅ clean across ${report.pagesReviewed} pages`);
    } else {
      console.log(`continuity: ${report.issues.length} issue(s):`);
      for (const it of report.issues) {
        console.log(`  [${it.severity}] p${it.pages.join(",")}: ${it.what}`);
      }
    }
  } catch (e) {
    console.log(`continuity review failed (non-fatal): ${(e as Error).message}`);
  }

  console.log(`\n✅ DONE. Total image cost: $${totalCost.toFixed(3)}`);
  console.log(`Open it: ${BASE}/studio → "${project.title}" (project ${pid})`);
}

main().catch((e) => {
  console.error(`\n❌ FAILED: ${(e as Error).message}`);
  console.error(`Cost so far: $${totalCost.toFixed(3)}`);
  process.exit(1);
});
