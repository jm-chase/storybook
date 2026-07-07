// End-to-end book validation: create a project → lock a 3-character cast →
// storyboard 3 beats → generate + lock page art for each, all through the real
// API (dev server must be running: npm run dev). Prints per-step cost/timing.
// This is the spine test (D-023): if this passes, the engine works end to end.
//
// Run: npm run validate:e2e   (~$0.8–1.5 depending on rerolls)

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";

interface Gen {
  variants?: string[];
  attempts?: number;
  costUsd?: number;
  satisfied?: boolean;
  error?: string;
}

let totalCost = 0;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}: ${data.error}`);
  return data;
}

/** Generate variants (any endpoint), lock variant 0 at lockPath, log cost/timing. */
async function generateAndLock(
  label: string,
  genPath: string,
  genBody: unknown,
  lockPath: string
): Promise<void> {
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
  console.log(`E2E book run against ${BASE}\n`);

  const { project } = await api<{ project: { id: string } }>("/api/projects", {
    method: "POST",
    body: JSON.stringify({ title: "Mia and the Grumpy Troll", styleId: "painted-wonder" }),
  });
  const pid = project.id;
  console.log(`project created: ${pid}\n`);

  const castDefs = [
    { role: "hero", name: "Mia", description: "a blond-haired, spunky, brown-eyed 4-year-old girl in a red raincoat" },
    { role: "sidekick", name: "Tembo", description: "a small, cheerful baby African elephant with big friendly eyes" },
    { role: "adversary", name: "Grum", description: "a grumpy troll with wild orange hair, a mossy green cloak, and a gnarled wooden staff" },
  ];
  const castIds: Record<string, string> = {};
  for (const def of castDefs) {
    const { member } = await api<{ member: { id: string } }>(`/api/projects/${pid}/cast`, {
      method: "POST",
      body: JSON.stringify(def),
    });
    castIds[def.name] = member.id;
    console.log(`cast added: ${def.role} ${def.name}`);
    await generateAndLock(
      def.name,
      "/api/generate-character",
      { name: def.name, description: def.description, styleId: "painted-wonder" },
      `/api/projects/${pid}/cast/${member.id}/lock`
    );
  }

  console.log();
  const beatDefs = [
    {
      sceneDescription: "Mia walks alone across an old stone bridge at dusk, rain starting to fall",
      text: "The bridge was old. The sky was grey. Mia walked on anyway.",
      castIds: [castIds.Mia],
    },
    {
      sceneDescription: "Mia and the baby elephant meet the grumpy troll blocking the far end of the bridge, his staff raised",
      text: "“WHO crosses MY bridge?” grumbled the troll.",
      castIds: [castIds.Mia, castIds.Tembo, castIds.Grum],
    },
    {
      sceneDescription:
        "Mia, the baby elephant, and the troll sit together on the bridge sharing berries, the troll almost smiling, warm sunset light",
      text: "Nobody had ever asked the troll to share before.",
      castIds: [castIds.Mia, castIds.Tembo, castIds.Grum],
    },
  ];
  for (const [i, def] of beatDefs.entries()) {
    const { beat } = await api<{ beat: { id: string } }>(`/api/projects/${pid}/beats`, {
      method: "POST",
      body: JSON.stringify(def),
    });
    console.log(`beat ${i + 1} added (${def.castIds.length} character(s))`);
    await generateAndLock(
      `page ${i + 1}`,
      `/api/projects/${pid}/beats/${beat.id}/generate`,
      {},
      `/api/projects/${pid}/beats/${beat.id}/lock`
    );
  }

  console.log(`\n✅ DONE. Total image cost: $${totalCost.toFixed(3)}`);
  console.log(`Open it: ${BASE}/studio → "Mia and the Grumpy Troll" (project ${pid})`);
}

main().catch((e) => {
  console.error(`\n❌ FAILED: ${(e as Error).message}`);
  console.error(`Cost so far: $${totalCost.toFixed(3)}`);
  process.exit(1);
});
