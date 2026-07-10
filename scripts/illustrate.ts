// Illustrate a project end-to-end: lock every unlocked cast member, setting,
// and page (choosing variant 0 of each gate-cleared set), then run both
// editor reviews. Resumable — already-locked items are skipped.
//
// Run: node --import tsx scripts/illustrate.ts <projectId> [--force]
// --force regenerates every PAGE even if locked (cast/settings stay locked)
// — the re-render path after engine upgrades. Dev server must be up.

export {};

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const PID = process.argv[2];
const FORCE = process.argv.includes("--force");

interface Gen {
  variants?: string[];
  attempts?: number;
  costUsd?: number;
  satisfied?: boolean;
}

interface Doc {
  title: string;
  styleId: string;
  cast: { id: string; name: string; role: string; description: string; locked?: unknown }[];
  environments: { id: string; name: string; locked?: unknown }[];
  storyboard: { id: string; art?: unknown; castIds: string[] }[];
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
  process.stdout.write(`  ${label}… `);
  const gen = await api<Gen>(genPath, { method: "POST", body: JSON.stringify(genBody ?? {}) });
  totalCost += gen.costUsd ?? 0;
  console.log(
    `${gen.variants?.length}v/${gen.attempts}a $${gen.costUsd} ${Math.round((Date.now() - t0) / 1000)}s${gen.satisfied ? "" : " (budget hit)"}`
  );
  await api(lockPath, { method: "POST", body: JSON.stringify({ imageDataUrl: gen.variants![0] }) });
}

async function main() {
  if (!PID) throw new Error("usage: illustrate.ts <projectId>");
  const { project } = await api<{ project: Doc }>(`/api/projects/${PID}`);
  console.log(`Illustrating "${project.title}" (${project.styleId})\n`);

  for (const m of project.cast.filter((c) => !c.locked)) {
    await generateAndLock(
      `${m.role} ${m.name}`,
      "/api/generate-character",
      { name: m.name, description: m.description, styleId: project.styleId },
      `/api/projects/${PID}/cast/${m.id}/lock`
    );
  }
  for (const e of project.environments.filter((x) => !x.locked)) {
    await generateAndLock(
      `setting ${e.name}`,
      `/api/projects/${PID}/environments/${e.id}/generate`,
      {},
      `/api/projects/${PID}/environments/${e.id}/lock`
    );
  }
  const { project: fresh } = await api<{ project: Doc }>(`/api/projects/${PID}`);
  for (const [i, b] of fresh.storyboard.entries()) {
    if (b.art && !FORCE) {
      console.log(`  page ${i + 1}: already locked, skip`);
      continue;
    }
    await generateAndLock(
      `page ${i + 1} (${b.castIds.length} char)`,
      `/api/projects/${PID}/beats/${b.id}/generate`,
      {},
      `/api/projects/${PID}/beats/${b.id}/lock`
    );
  }

  console.log("\nreviews…");
  try {
    const { report } = await api<{ report: { issues: { severity: string; pages: number[]; what: string }[] } }>(
      `/api/projects/${PID}/continuity`,
      { method: "POST" }
    );
    console.log(`continuity: ${report.issues.length} issue(s)`);
    for (const it of report.issues) console.log(`  [${it.severity}] p${it.pages.join(",")}: ${it.what.slice(0, 110)}`);
  } catch (e) {
    console.log(`continuity failed (non-fatal): ${(e as Error).message.slice(0, 120)}`);
  }
  try {
    const { report } = await api<{ report: { issues: { pages: number[]; what: string }[] } }>(`/api/projects/${PID}/narrative`, {
      method: "POST",
    });
    console.log(`narrative: ${report.issues.length} issue(s)`);
  } catch (e) {
    console.log(`narrative failed (non-fatal): ${(e as Error).message.slice(0, 120)}`);
  }

  console.log(`\n✅ DONE. Image cost this run: $${totalCost.toFixed(3)}`);
}

main().catch((e) => {
  console.error(`❌ ${(e as Error).message}`);
  console.error(`cost so far: $${totalCost.toFixed(3)}`);
  process.exit(1);
});
