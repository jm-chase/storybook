"use client";

import { useCallback, useEffect, useState } from "react";
import type { Project, CastMember, EnvironmentSetting, StoryBeat } from "@/lib/project/types";

// New-user wizard (2026-07-23): a single linear path from an idea to a finished
// book, one decision at a time. The full /studio surface exposes every control
// at once (great once you know the model, overwhelming for a first book); this
// walks the same pipeline — write → cast → settings → pages → done — reusing the
// exact same server routes and Output Gate. Deliberately self-contained (its own
// small streaming chooser) so it never destabilizes the studio.

const ACCENT = "#c2724f";

type Step = "describe" | "cast" | "settings" | "pages" | "done";
const STEP_ORDER: Step[] = ["describe", "cast", "settings", "pages", "done"];
const STEP_LABEL: Record<Step, string> = {
  describe: "Your idea",
  cast: "Cast",
  settings: "Settings",
  pages: "Pages",
  done: "Done",
};

interface StyleView {
  id: string;
  name: string;
}

interface GenResponse {
  variants?: string[];
  attempts?: number;
  costUsd?: number;
  satisfied?: boolean;
  error?: string;
}

// Read one NDJSON generation stream to its {done} (or {error}); narrate {progress}.
async function readStream(res: Response, onMeta: (s: string) => void): Promise<GenResponse> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || !contentType.includes("ndjson") || !res.body) {
    const data = (await res.json().catch(() => ({}))) as GenResponse;
    if (!res.ok) return { error: data.error ?? "Generation failed." };
    return data;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let out: GenResponse | null = null;
  let streamError: string | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const msg = JSON.parse(line) as { progress?: { phase: string; attempt?: number; cleanSoFar?: number; wanted?: number }; done?: GenResponse; error?: string };
      if (msg.progress) {
        const p = msg.progress;
        onMeta(
          p.phase === "generating"
            ? `Drawing option ${(p.cleanSoFar ?? 0) + 1} of ${p.wanted ?? 3}…`
            : p.phase === "checking"
              ? "Checking it against your locked references…"
              : p.phase === "accepted"
                ? `Got ${p.cleanSoFar} of ${p.wanted}…`
                : p.phase === "rejected"
                  ? "Re-rolling a flawed one…"
                  : "Working…"
        );
      } else if (msg.error) streamError = msg.error;
      else if (msg.done) out = msg.done;
    }
  }
  if (streamError || !out) return { error: streamError ?? "Generation failed." };
  return out;
}

// Generate 3 gated options for one item, pick a favorite, lock it.
function ItemChooser({
  generate,
  lock,
  onLocked,
}: {
  generate: () => Promise<Response>;
  lock: (dataUrl: string) => Promise<Response>;
  onLocked: (p: Project) => void;
}) {
  const [variants, setVariants] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [locking, setLocking] = useState(false);
  const [meta, setMeta] = useState("");

  async function run() {
    setBusy(true);
    setMeta("Starting…");
    try {
      const data = await readStream(await generate(), setMeta);
      if (data.error) {
        setMeta(`⚠️ ${data.error}`);
        return;
      }
      setVariants(data.variants ?? []);
      setSelected(0);
      setMeta(`${data.variants?.length ?? 0} options ready — pick your favorite.${data.satisfied ? "" : " (stopped at the cost cap)"}`);
    } catch (e) {
      setMeta(`⚠️ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function doLock() {
    setLocking(true);
    try {
      const res = await lock(variants[selected]);
      const d = await res.json();
      if (!res.ok) {
        setMeta(`⚠️ ${d.error ?? "Could not lock."}`);
        return;
      }
      onLocked(d.project);
    } finally {
      setLocking(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={run} disabled={busy || locking} style={btn(variants.length === 0)}>
          {busy ? "Drawing… (~1–2 min)" : variants.length ? "Draw 3 new options" : "Draw 3 options"}
        </button>
        {variants.length > 0 && (
          <button onClick={doLock} disabled={busy || locking} style={btn(true)}>
            {locking ? "Locking…" : "Lock this one 🔒"}
          </button>
        )}
      </div>
      {meta && <p style={{ fontSize: "0.75rem", opacity: 0.7, marginTop: 6 }}>{meta}</p>}
      {variants.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          {variants.map((v, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              style={{
                padding: 0,
                border: `3px solid ${i === selected ? ACCENT : "transparent"}`,
                borderRadius: 10,
                cursor: "pointer",
                background: "none",
                lineHeight: 0,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v} alt={`option ${i + 1}`} style={{ width: 150, height: 150, objectFit: "cover", borderRadius: 7 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// One locked/unlocked item row (cast member, setting, or page).
function ItemCard({
  title,
  subtitle,
  locked,
  imageUrl,
  chooser,
}: {
  title: string;
  subtitle?: string;
  locked: boolean;
  imageUrl?: string;
  chooser: React.ReactNode;
}) {
  return (
    <div style={{ ...cardStyle, borderColor: locked ? "#7ba05b" : "#e3d9cf" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ width: 90, height: 90, borderRadius: 8, background: "#efe7dd", flexShrink: 0, overflow: "hidden" }}>
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: "0.95rem" }}>
            {locked && <span style={{ color: "#5f7a44" }}>✓ </span>}
            {title}
          </p>
          {subtitle && <p style={{ fontSize: "0.8rem", opacity: 0.7, marginTop: 2, lineHeight: 1.4 }}>{subtitle}</p>}
          <div style={{ marginTop: 8 }}>{locked ? <p style={{ fontSize: "0.8rem", color: "#5f7a44" }}>Locked.</p> : chooser}</div>
        </div>
      </div>
    </div>
  );
}

export default function NewBookWizard() {
  const [project, setProject] = useState<Project | null>(null);
  const [step, setStep] = useState<Step>("describe");
  const [styles, setStyles] = useState<StyleView[]>([]);
  const [prep, setPrep] = useState<string>(""); // parts-sheet preparation status

  // Load styles for the picker.
  useEffect(() => {
    fetch("/api/styles")
      .then((r) => r.json())
      .then((d) => setStyles(d.styles ?? []))
      .catch(() => setStyles([]));
  }, []);

  // Resume: if the URL carries ?id=, load that project and jump to the right step.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;
    fetch(`/api/projects/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.project) {
          setProject(d.project);
          setStep(inferStep(d.project));
        }
      })
      .catch(() => {});
  }, []);

  const onProject = useCallback((p: Project) => setProject(p), []);

  // After creation, put the id in the URL so a refresh resumes.
  function created(p: Project) {
    setProject(p);
    window.history.replaceState(null, "", `/new?id=${p.id}`);
    setStep("cast");
  }

  const castDone = project ? project.cast.every((c) => c.locked) : false;
  const settingsDone = project ? project.environments.every((e) => e.locked) : false;
  const pagesDone = project ? project.storyboard.every((b) => b.art) : false;

  // Leaving Settings → derive parts sheets (best-effort) → Pages.
  async function goToPages() {
    if (!project) return;
    const need = project.environments.filter((e) => e.locked && !e.components);
    for (const e of need) {
      setPrep(`Preparing “${e.name}” so it holds from any camera angle…`);
      await fetch(`/api/projects/${project.id}/environments/${e.id}/components`, { method: "POST" }).catch(() => {});
    }
    setPrep("");
    // Refresh project so components show up.
    const r = await fetch(`/api/projects/${project.id}`);
    if (r.ok) setProject((await r.json()).project);
    setStep("pages");
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1.25rem 5rem" }}>
      <StepBar current={step} />

      {step === "describe" && <DescribeStep styles={styles} onCreated={created} />}

      {step === "cast" && project && (
        <StepShell
          title="Meet your cast"
          intro="The engine wrote your characters. Draw each one, pick the version you love, and lock it — that locked picture keeps them looking the same on every page."
          countLabel={`${project.cast.filter((c) => c.locked).length} of ${project.cast.length} locked`}
          canContinue={castDone}
          continueLabel="Next: settings →"
          onContinue={() => setStep("settings")}
        >
          {project.cast.map((m) => (
            <CastRow key={m.id} project={project} member={m} onProject={onProject} />
          ))}
        </StepShell>
      )}

      {step === "settings" && project && (
        <StepShell
          title="Build your settings"
          intro="These are the places your story happens. Lock one look for each — every scene set there rebuilds from it, so the location stays recognizable."
          countLabel={`${project.environments.filter((e) => e.locked).length} of ${project.environments.length} locked`}
          canContinue={settingsDone}
          continueLabel="Next: illustrate the pages →"
          onContinue={goToPages}
          busyNote={prep}
        >
          {project.environments.map((e) => (
            <SettingRow key={e.id} project={project} env={e} onProject={onProject} />
          ))}
        </StepShell>
      )}

      {step === "pages" && project && (
        <StepShell
          title="Illustrate the pages"
          intro="Now the fun part. Draw each page, pick your favorite, and lock it. Every page is drawn from your locked cast and settings, so everything stays on-model."
          countLabel={`${project.storyboard.filter((b) => b.art).length} of ${project.storyboard.length} pages`}
          canContinue={pagesDone}
          continueLabel="Finish → see my book"
          onContinue={() => setStep("done")}
        >
          {project.storyboard.map((b, i) => (
            <PageRow key={b.id} project={project} beat={b} index={i} onProject={onProject} />
          ))}
        </StepShell>
      )}

      {step === "done" && project && <DoneStep project={project} />}
    </main>
  );
}

// ---- steps ----

function DescribeStep({ styles, onCreated }: { styles: StyleView[]; onCreated: (p: Project) => void }) {
  const [premise, setPremise] = useState("");
  const [heroName, setHeroName] = useState("");
  const [heroDescription, setHeroDescription] = useState("");
  const [tone, setTone] = useState("");
  const [pages, setPages] = useState(6);
  const [styleId, setStyleId] = useState("painted-wonder");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (styles.length && !styles.some((s) => s.id === styleId)) setStyleId(styles[0].id);
  }, [styles]); // eslint-disable-line react-hooks/exhaustive-deps

  async function create() {
    setBusy(true);
    setErrors({});
    try {
      const res = await fetch("/api/projects/from-prompt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ premise, heroName, heroDescription, tone, pages, styleId }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErrors(
          d.fields
            ? Object.fromEntries(Object.entries(d.fields as Record<string, { message: string }>).map(([k, v]) => [k, v.message]))
            : { premise: d.error ?? "Could not build the story." }
        );
        return;
      }
      onCreated(d.project);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.6rem", marginBottom: 4 }}>Let’s make a book</h1>
      <p style={{ opacity: 0.75, marginBottom: 20, lineHeight: 1.5 }}>
        Tell me the idea and who it stars. I’ll write the whole story — title, characters, settings, and every page — and then walk you through
        illustrating it, one step at a time.
      </p>

      <div style={cardStyle}>
        <label style={{ display: "block", marginBottom: 12 }}>
          <span style={labelText}>What’s the story about?</span>
          <textarea
            value={premise}
            onChange={(e) => setPremise(e.target.value)}
            rows={2}
            maxLength={520}
            placeholder="a lighthouse keeper’s cat who is afraid of the dark, until the night the light goes out"
            style={{ ...inputStyle(!!errors.premise), resize: "vertical" }}
          />
          {errors.premise && <Err>{errors.premise}</Err>}
        </label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ flex: 1, minWidth: 150 }}>
            <span style={labelText}>Your hero’s name</span>
            <input value={heroName} onChange={(e) => setHeroName(e.target.value)} style={inputStyle(!!errors.heroName)} />
            {errors.heroName && <Err>{errors.heroName}</Err>}
          </label>
          <label style={{ flex: 2, minWidth: 210 }}>
            <span style={labelText}>Describe your hero (looks only)</span>
            <input
              value={heroDescription}
              onChange={(e) => setHeroDescription(e.target.value)}
              placeholder="a freckled 5-year-old girl with curly red hair"
              style={inputStyle(!!errors.heroDescription)}
            />
            {errors.heroDescription && <Err>{errors.heroDescription}</Err>}
          </label>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <label style={{ flex: 1, minWidth: 130 }}>
            <span style={labelText}>Tone (optional)</span>
            <input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="gently funny" style={inputStyle(false)} />
          </label>
          <label>
            <span style={labelText}>Pages</span>
            <select value={pages} onChange={(e) => setPages(Number(e.target.value))} style={inputStyle(false)}>
              {[4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span style={labelText}>Art style</span>
            <select value={styleId} onChange={(e) => setStyleId(e.target.value)} style={inputStyle(false)}>
              {styles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div style={{ marginTop: 16 }}>
          <button onClick={create} disabled={busy} style={btn(true)}>
            {busy ? "✨ Writing your story… (~20s)" : "✨ Write my story"}
          </button>
        </div>
        <p style={{ fontSize: "0.72rem", opacity: 0.55, marginTop: 8 }}>
          Your description only steers the art, never the plot. Nothing is drawn yet — you’ll illustrate it in the next steps.
        </p>
      </div>
    </div>
  );
}

function CastRow({ project, member, onProject }: { project: Project; member: CastMember; onProject: (p: Project) => void }) {
  return (
    <ItemCard
      title={`${member.name} — the ${member.role}`}
      subtitle={member.description}
      locked={!!member.locked}
      imageUrl={member.locked ? `/api/projects/${project.id}/images/${member.locked.file}` : undefined}
      chooser={
        <ItemChooser
          generate={() =>
            fetch("/api/generate-character", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ name: member.name, description: member.description, styleId: project.styleId }),
            })
          }
          lock={(dataUrl) =>
            fetch(`/api/projects/${project.id}/cast/${member.id}/lock`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ imageDataUrl: dataUrl }),
            })
          }
          onLocked={onProject}
        />
      }
    />
  );
}

function SettingRow({ project, env, onProject }: { project: Project; env: EnvironmentSetting; onProject: (p: Project) => void }) {
  return (
    <ItemCard
      title={env.name}
      subtitle={env.description}
      locked={!!env.locked}
      imageUrl={env.locked ? `/api/projects/${project.id}/images/${env.locked.file}` : undefined}
      chooser={
        <ItemChooser
          generate={() => fetch(`/api/projects/${project.id}/environments/${env.id}/generate`, { method: "POST" })}
          lock={(dataUrl) =>
            fetch(`/api/projects/${project.id}/environments/${env.id}/lock`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ imageDataUrl: dataUrl }),
            })
          }
          onLocked={onProject}
        />
      }
    />
  );
}

function PageRow({ project, beat, index, onProject }: { project: Project; beat: StoryBeat; index: number; onProject: (p: Project) => void }) {
  return (
    <ItemCard
      title={`Page ${index + 1}`}
      subtitle={beat.text || beat.sceneDescription}
      locked={!!beat.art}
      imageUrl={beat.art ? `/api/projects/${project.id}/images/${beat.art.file}` : undefined}
      chooser={
        <ItemChooser
          generate={() => fetch(`/api/projects/${project.id}/beats/${beat.id}/generate`, { method: "POST" })}
          lock={(dataUrl) =>
            fetch(`/api/projects/${project.id}/beats/${beat.id}/lock`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ imageDataUrl: dataUrl }),
            })
          }
          onLocked={onProject}
        />
      }
    />
  );
}

function DoneStep({ project }: { project: Project }) {
  return (
    <div>
      <h1 style={{ fontSize: "1.6rem", marginBottom: 4 }}>🎉 “{project.title}” is ready</h1>
      <p style={{ opacity: 0.75, marginBottom: 20, lineHeight: 1.5 }}>
        Every page is illustrated and locked. Here’s your book — download it, or keep polishing it in the studio.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 24 }}>
        {project.storyboard.map(
          (b, i) =>
            b.art && (
              <div key={b.id} style={{ borderRadius: 8, overflow: "hidden", background: "#efe7dd" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/projects/${project.id}/images/${b.art.file}`} alt={`page ${i + 1}`} style={{ width: "100%", display: "block" }} />
              </div>
            )
        )}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a href={`/api/projects/${project.id}/pdf`} style={{ ...btn(true), textDecoration: "none" }}>
          ⬇ Download the book (PDF)
        </a>
        <a href={`/board/${project.id}`} style={{ ...btn(false), textDecoration: "none" }}>
          Open the storyboard
        </a>
        <a href="/studio" style={{ ...btn(false), textDecoration: "none" }}>
          Open the studio
        </a>
      </div>
      <p style={{ fontSize: "0.78rem", opacity: 0.6, marginTop: 16, lineHeight: 1.5 }}>
        Want it review-checked? Open the studio → Reviews to run the continuity and story passes, or the storyboard to fix any single page.
      </p>
    </div>
  );
}

// ---- shared step chrome ----

function StepShell({
  title,
  intro,
  countLabel,
  canContinue,
  continueLabel,
  onContinue,
  busyNote,
  children,
}: {
  title: string;
  intro: string;
  countLabel: string;
  canContinue: boolean;
  continueLabel: string;
  onContinue: () => void;
  busyNote?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 4 }}>{title}</h1>
      <p style={{ opacity: 0.75, marginBottom: 8, lineHeight: 1.5 }}>{intro}</p>
      <p style={{ fontSize: "0.8rem", fontWeight: 600, color: ACCENT, marginBottom: 16 }}>{countLabel}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
      {busyNote && <p style={{ fontSize: "0.8rem", opacity: 0.7, marginTop: 14 }}>⏳ {busyNote}</p>}
      <div style={{ marginTop: 22 }}>
        <button onClick={onContinue} disabled={!canContinue || !!busyNote} style={btn(true, !canContinue || !!busyNote)}>
          {continueLabel}
        </button>
        {!canContinue && <p style={{ fontSize: "0.75rem", opacity: 0.6, marginTop: 6 }}>Lock every item above to continue.</p>}
      </div>
    </div>
  );
}

function StepBar({ current }: { current: Step }) {
  const idx = STEP_ORDER.indexOf(current);
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
      {STEP_ORDER.map((s, i) => (
        <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 20,
              fontSize: "0.78rem",
              fontWeight: i === idx ? 700 : 500,
              background: i < idx ? "#7ba05b" : i === idx ? ACCENT : "#eee5db",
              color: i <= idx ? "#fff" : "#8a7d70",
            }}
          >
            <span>{i < idx ? "✓" : i + 1}</span>
            {STEP_LABEL[s]}
          </div>
          {i < STEP_ORDER.length - 1 && <span style={{ color: "#d8ccbf" }}>→</span>}
        </div>
      ))}
    </div>
  );
}

function inferStep(p: Project): Step {
  if (!p.cast.every((c) => c.locked)) return "cast";
  if (!p.environments.every((e) => e.locked)) return "settings";
  if (!p.storyboard.every((b) => b.art)) return "pages";
  return "done";
}

// ---- style helpers (kept local; the wizard is a standalone surface) ----

const cardStyle: React.CSSProperties = {
  border: "1px solid #e3d9cf",
  borderRadius: 12,
  padding: 16,
  background: "#fffdfb",
};

const labelText: React.CSSProperties = { display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4, opacity: 0.85 };

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "0.5rem 0.6rem",
    borderRadius: 8,
    border: `1px solid ${hasError ? "#c0392b" : "#d8ccbf"}`,
    fontSize: "0.9rem",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };
}

function btn(primary: boolean, disabled = false): React.CSSProperties {
  return {
    padding: "0.6rem 1.1rem",
    borderRadius: 8,
    border: primary ? "none" : `1px solid ${ACCENT}`,
    background: disabled ? "#cbb8ac" : primary ? ACCENT : "#fff",
    color: primary ? "#fff" : ACCENT,
    fontWeight: 600,
    fontSize: "0.9rem",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function Err({ children }: { children: React.ReactNode }) {
  return <span style={{ display: "block", color: "#c0392b", fontSize: "0.75rem", marginTop: 3 }}>{children}</span>;
}
