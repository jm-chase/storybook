"use client";

import { useEffect, useState } from "react";
import { HOUSE_STYLES, HOUSE_STYLE_BY_ID } from "@/content/houseStyles";
import { MAX_DESCRIPTION } from "@/lib/art/brief";
import { CAST_ROLES, type CastRole, type Project, type ProjectSummary, type StoryBeat } from "@/lib/project/types";
import { MAX_SCENE_DESCRIPTION, MAX_PAGE_TEXT } from "@/lib/project/beats";
import { BOOK_TEMPLATES } from "@/content/bookTemplates";
import { CHARACTER_CHIPS, CHARACTER_HINT, SETTING_CHIPS, sceneChips } from "@/content/suggestions";

// The cast studio (D-022/D-023): a persisted book PROJECT with a locked CAST.
// Create/open a project → pick the book's style → add characters by role →
// generate 3 clean options each (server-side, behind the Output Gate) → choose
// → lock. Locked references persist to disk and drive every scene.

const ROLE_META: Record<CastRole, { label: string; emoji: string }> = {
  hero: { label: "Hero", emoji: "🌟" },
  sidekick: { label: "Sidekick", emoji: "🐾" },
  adversary: { label: "Adversary", emoji: "⛈️" },
  friend: { label: "Friend", emoji: "🙂" },
};

interface GenResponse {
  variants?: string[];
  attempts?: number;
  costUsd?: number;
  satisfied?: boolean;
  error?: string;
  fields?: Record<string, { message: string }>;
}

/** Mirrors GateProgress (lib/art/outputGate/runGate). */
interface Progress {
  phase: "generating" | "checking" | "accepted" | "rejected";
  attempt: number;
  cleanSoFar: number;
  wanted: number;
  reason?: string;
}

function progressText(p: Progress): string {
  switch (p.phase) {
    case "generating":
      return `🎨 Drawing option ${Math.min(p.cleanSoFar + 1, p.wanted)} of ${p.wanted}…`;
    case "checking":
      return "🔍 Checking safety, quality & consistency…";
    case "accepted":
      return `✓ Option ${p.cleanSoFar} looks good${p.cleanSoFar < p.wanted ? " — drawing the next…" : "…"}`;
    case "rejected":
      return `↻ Caught a flaw (${(p.reason ?? "defect").slice(0, 60)}) — redrawing…`;
  }
}

export default function StudioPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function openProject(id: string) {
    const res = await fetch(`/api/projects/${id}`);
    const d = await res.json();
    if (res.ok) setProject(d.project);
  }

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "2rem 1.5rem" }}>
      {project ? (
        <ProjectView
          project={project}
          onProject={setProject}
          onBack={async () => {
            setProject(null);
            const d = await (await fetch("/api/projects")).json();
            setProjects(d.projects ?? []);
          }}
        />
      ) : (
        <Picker projects={projects} loading={loading} onOpen={openProject} onCreated={setProject} />
      )}
    </main>
  );
}

/* ---------------- Project picker + create ---------------- */

function Picker({
  projects,
  loading,
  onOpen,
  onCreated,
}: {
  projects: ProjectSummary[];
  loading: boolean;
  onOpen: (id: string) => void;
  onCreated: (p: Project) => void;
}) {
  const [title, setTitle] = useState("");
  const [styleId, setStyleId] = useState(HOUSE_STYLES[0].id);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setErrors({});
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, styleId }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErrors(
          d.fields
            ? Object.fromEntries(Object.entries(d.fields as Record<string, { message: string }>).map(([k, v]) => [k, v.message]))
            : { title: d.error ?? "Could not create the project." }
        );
        return;
      }
      onCreated(d.project);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 style={{ fontSize: "1.6rem" }}>Book studio</h1>
      <p style={{ fontSize: "0.85rem", opacity: 0.7, marginTop: 0 }}>
        Each book is a project: one art style, a locked cast, then the storyboard.
      </p>

      {projects.length > 0 && (
        <section style={{ margin: "1.25rem 0" }}>
          <p style={{ fontSize: "0.85rem", fontWeight: 600 }}>Your books</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.6rem" }}>
            {projects.map((p) => (
              <div key={p.id} style={card(false)} onClick={() => onOpen(p.id)}>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{p.title}</div>
                <div style={{ fontSize: "0.72rem", opacity: 0.7 }}>
                  {HOUSE_STYLE_BY_ID[p.styleId]?.name ?? p.styleId} · {p.lockedCount}/{p.castCount} cast locked
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {loading && <p style={{ fontSize: "0.8rem", opacity: 0.6 }}>Loading your books…</p>}

      <TemplateSection onCreated={onCreated} />

      <section style={{ marginTop: "1.5rem", maxWidth: 560 }}>
        <p style={{ fontSize: "0.85rem", fontWeight: 600 }}>Start a blank book (full studio)</p>
        <label style={{ display: "block", marginBottom: "1rem" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Book title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Mia and the Big New Thing"
            style={inputStyle(!!errors.title)}
          />
          {errors.title && <Err>{errors.title}</Err>}
        </label>
        <p style={{ fontSize: "0.85rem", fontWeight: 600, margin: "0 0 0.5rem" }}>Art style (one per book)</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          {HOUSE_STYLES.map((s) => (
            <div key={s.id} style={card(s.id === styleId)} onClick={() => setStyleId(s.id)}>
              <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                {s.swatches.map((c) => (
                  <span key={c} style={{ width: 18, height: 18, borderRadius: 4, background: c }} />
                ))}
              </div>
              <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{s.name}</div>
              <div style={{ fontSize: "0.72rem", opacity: 0.7 }}>{s.blurb}</div>
            </div>
          ))}
        </div>
        {errors.styleId && <Err>{errors.styleId}</Err>}
        <button onClick={create} disabled={busy} style={{ ...btn(true), marginTop: "1rem" }}>
          {busy ? "Creating…" : "Create book"}
        </button>
      </section>

      <ManuscriptSection onCreated={onCreated} />
    </>
  );
}

/* ---------------- Illustrate a manuscript (skin 3, authors) ---------------- */

function ManuscriptSection({ onCreated }: { onCreated: (p: Project) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [styleId, setStyleId] = useState(HOUSE_STYLES[0].id);
  const [manuscript, setManuscript] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setErrors({});
    try {
      const res = await fetch("/api/projects/from-manuscript", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, styleId, manuscript }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErrors(
          d.fields
            ? Object.fromEntries(Object.entries(d.fields as Record<string, { message: string }>).map(([k, v]) => [k, v.message]))
            : { manuscript: d.error ?? "Could not create the book." }
        );
        return;
      }
      onCreated(d.project);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ marginTop: "1.5rem", maxWidth: 560 }}>
      <p style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem" }}>
        Illustrate your manuscript <span style={{ fontWeight: 400, opacity: 0.6 }}>(for authors)</span>
      </p>
      {!open ? (
        <div style={{ ...card(false), display: "flex", alignItems: "center", justifyContent: "center", minHeight: 56 }} onClick={() => setOpen(true)}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, opacity: 0.7 }}>＋ Paste a manuscript</span>
        </div>
      ) : (
        <div style={{ ...card(true), cursor: "default" }}>
          <label style={{ display: "block", marginBottom: "0.5rem" }}>
            <span style={labelText}>Book title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle(!!errors.title)} />
            {errors.title && <Err>{errors.title}</Err>}
          </label>
          <label style={{ display: "block", marginBottom: "0.5rem" }}>
            <span style={labelText}>Art style</span>
            <select value={styleId} onChange={(e) => setStyleId(e.target.value)} style={inputStyle(!!errors.styleId)}>
              {HOUSE_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.blurb}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "block" }}>
            <span style={labelText}>Manuscript — one page per paragraph (blank line between pages)</span>
            <textarea
              value={manuscript}
              onChange={(e) => setManuscript(e.target.value)}
              rows={8}
              placeholder={"The bridge was old. The sky was grey. Mia walked on anyway.\n\n“WHO crosses MY bridge?” grumbled the troll."}
              style={{ ...inputStyle(!!errors.manuscript), resize: "vertical" }}
            />
            {errors.manuscript && <Err>{errors.manuscript}</Err>}
          </label>
          <p style={{ fontSize: "0.72rem", opacity: 0.6, margin: "0.4rem 0" }}>
            Each page arrives with its scene pre-filled from your text — refine the scene and assign your cast per page,
            then generate. Your text is typeset, never redrawn by the model.
          </p>
          <button onClick={create} disabled={busy} style={btn(true)}>
            {busy ? "Creating…" : "Create from manuscript"}
          </button>
        </div>
      )}
    </section>
  );
}

/* ---------------- Start from a template (skin 2) ---------------- */

function TemplateSection({ onCreated }: { onCreated: (p: Project) => void }) {
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [heroName, setHeroName] = useState("");
  const [heroDescription, setHeroDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const chosen = BOOK_TEMPLATES.find((t) => t.id === templateId);

  async function create() {
    setBusy(true);
    setErrors({});
    try {
      const res = await fetch("/api/projects/from-template", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ templateId, heroName, heroDescription }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErrors(
          d.fields
            ? Object.fromEntries(Object.entries(d.fields as Record<string, { message: string }>).map(([k, v]) => [k, v.message]))
            : { heroName: d.error ?? "Could not create the book." }
        );
        return;
      }
      onCreated(d.project);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ marginTop: "1.5rem" }}>
      <p style={{ fontSize: "0.85rem", fontWeight: 600 }}>Start from a story (you just add your child)</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0.6rem" }}>
        {BOOK_TEMPLATES.map((t) => (
          <div key={t.id} style={card(t.id === templateId)} onClick={() => setTemplateId(t.id)}>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, opacity: 0.55, textTransform: "uppercase" }}>
              {t.kind === "classic" ? "classic · public domain" : "occasion"}
            </div>
            <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{t.title.replace("{hero}", "Your child")}</div>
            <div style={{ fontSize: "0.72rem", opacity: 0.7 }}>{t.blurb}</div>
            <div style={{ fontSize: "0.68rem", opacity: 0.55, marginTop: 4 }}>
              {t.beats.length} pages · {HOUSE_STYLE_BY_ID[t.defaultStyleId]?.name}
            </div>
          </div>
        ))}
      </div>
      {chosen && (
        <div style={{ ...card(true), cursor: "default", maxWidth: 560, marginTop: "0.6rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem" }}>
            <span style={labelText}>Your hero&apos;s name</span>
            <input value={heroName} onChange={(e) => setHeroName(e.target.value)} style={inputStyle(!!errors.heroName)} />
            {errors.heroName && <Err>{errors.heroName}</Err>}
          </label>
          <label style={{ display: "block" }}>
            <span style={labelText}>Describe your hero (drives the artwork only)</span>
            <textarea
              value={heroDescription}
              onChange={(e) => setHeroDescription(e.target.value)}
              rows={2}
              maxLength={MAX_DESCRIPTION + 20}
              placeholder="a blond-haired, spunky, brown-eyed 4-year-old girl"
              style={{ ...inputStyle(!!errors.heroDescription), resize: "vertical" }}
            />
            {errors.heroDescription && <Err>{errors.heroDescription}</Err>}
          </label>
          {heroDescription.length === 0 && (
            <Chips options={CHARACTER_CHIPS.hero} onPick={setHeroDescription} hint={CHARACTER_HINT} />
          )}
          <button onClick={create} disabled={busy} style={{ ...btn(true), marginTop: "0.6rem" }}>
            {busy ? "Creating…" : `Create “${chosen.title.replace("{hero}", heroName || "…")}”`}
          </button>
        </div>
      )}
    </section>
  );
}

/* ---------------- Project view: the cast roster ---------------- */

function ProjectView({
  project,
  onProject,
  onBack,
}: {
  project: Project;
  onProject: (p: Project) => void;
  onBack: () => void;
}) {
  const style = HOUSE_STYLE_BY_ID[project.styleId];
  // The member currently in the generate→choose→lock workspace.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [fixCastId, setFixCastId] = useState<string | null>(null);
  const active = project.cast.find((c) => c.id === activeId) ?? null;
  const fixMember = project.cast.find((c) => c.id === fixCastId) ?? null;

  async function removeMember(castId: string) {
    const res = await fetch(`/api/projects/${project.id}/cast/${castId}`, { method: "DELETE" });
    const d = await res.json();
    if (res.ok) {
      if (activeId === castId) setActiveId(null);
      onProject(d.project);
    }
  }

  return (
    <>
      <button onClick={onBack} style={{ ...btn(false), marginBottom: "0.75rem" }}>
        ← All books
      </button>
      <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.25rem" }}>{project.title}</h1>
      <p style={{ fontSize: "0.8rem", opacity: 0.7, marginTop: 0 }}>
        Style: <strong>{style?.name ?? project.styleId}</strong> · every character below is drawn in this style and
        stays consistent on every page.
      </p>

      <section style={{ margin: "1.25rem 0" }}>
        <p style={{ fontSize: "0.9rem", fontWeight: 600 }}>The cast</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.6rem" }}>
          {project.cast.map((m) => (
            <div key={m.id} style={{ ...card(m.id === activeId), cursor: "default" }}>
              {m.locked ? (
                <img
                  src={`/api/projects/${project.id}/images/${m.locked.file}`}
                  alt={m.name}
                  style={{ width: "100%", borderRadius: 8, display: "block", marginBottom: 6 }}
                />
              ) : (
                <div
                  style={{
                    border: "2px dashed #00000022",
                    borderRadius: 8,
                    height: 110,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    opacity: 0.6,
                    marginBottom: 6,
                    padding: "0 0.5rem",
                    textAlign: "center",
                  }}
                >
                  not locked yet
                </div>
              )}
              <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                {ROLE_META[m.role].emoji} {m.name}
                {m.locked && <span style={{ color: "#2a9d8f" }}> 🔒</span>}
              </div>
              <div style={{ fontSize: "0.7rem", opacity: 0.65 }}>{ROLE_META[m.role].label}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                {!m.locked && (
                  <button onClick={() => setActiveId(m.id)} style={btnSmall(true)}>
                    Generate
                  </button>
                )}
                {m.locked && (
                  <button onClick={() => setFixCastId(m.id)} style={btnSmall(true)}>
                    ✏️ Fix
                  </button>
                )}
                <button onClick={() => removeMember(m.id)} style={btnSmall(false)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
          <AddMemberCard project={project} onProject={onProject} onAdded={(castId) => setActiveId(castId)} />
        </div>
      </section>

      {active && !active.locked && (
        <GenerateWorkspace
          key={active.id}
          project={project}
          member={active}
          onProject={onProject}
          onDone={() => setActiveId(null)}
        />
      )}

      {fixMember?.locked && (
        <RefineWorkspace
          key={fixMember.id}
          title={`✏️ Fixing ${fixMember.name} (${ROLE_META[fixMember.role].label})`}
          description={`${fixMember.description} — pages already drawn from the old reference keep their art; regenerate them to pick up the fix.`}
          imageSrc={`/api/projects/${project.id}/images/${fixMember.locked.file}`}
          refinePath={`/api/projects/${project.id}/cast/${fixMember.id}/refine`}
          lockPath={`/api/projects/${project.id}/cast/${fixMember.id}/lock`}
          onProject={onProject}
          onDone={() => setFixCastId(null)}
        />
      )}

      <SettingsSection project={project} onProject={onProject} />

      <StoryboardSection project={project} onProject={onProject} />

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", flexWrap: "wrap", marginTop: "0.5rem" }}>
        {project.storyboard.length > 0 && (
          <a href={`/api/projects/${project.id}/pdf`} style={{ ...btn(true), display: "inline-block", textDecoration: "none" }}>
            📖 Download the book (PDF)
          </a>
        )}
        {project.storyboard.length > 0 && (
          <a
            href={`/api/projects/${project.id}/pdf?pod=1`}
            title="The orderable interior: bleed, front matter, cast gallery, padded to the print-shop page minimum"
            style={{ ...btn(false), display: "inline-block", textDecoration: "none" }}
          >
            🖨️ Print-shop interior
          </a>
        )}
        {project.storyboard.length > 0 && (
          <a
            href={`/api/projects/${project.id}/cover`}
            title="Wraparound print cover: back, spine, and front in one spread"
            style={{ ...btn(false), display: "inline-block", textDecoration: "none" }}
          >
            📔 Print-shop cover
          </a>
        )}
        {project.cast.some((c) => c.locked) && <SeriesButton project={project} onSwitch={onProject} />}
      </div>

      <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid #00000012", opacity: 0.6 }}>
        <p style={{ fontSize: "0.85rem", fontWeight: 600 }}>Coming next:</p>
        <p style={{ fontSize: "0.8rem", margin: 0 }}>
          more <strong>public-domain classics</strong> in the template gallery · richer occasion templates.
        </p>
      </div>
    </>
  );
}

/** Series (D-023): start a new adventure with this book's locked cast + settings + style. */
function SeriesButton({ project, onSwitch }: { project: Project; onSwitch: (p: Project) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${project.id}/series`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.fields?.title?.message ?? d.error ?? "Could not create the new adventure.");
        return;
      }
      onSwitch(d.project);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={btn(false)}>
        🔁 New adventure with this cast
      </button>
    );
  }
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "flex-start", flexWrap: "wrap" }}>
      <span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`${project.cast.find((c) => c.role === "hero")?.name ?? "A"} and the …`}
          style={{ ...inputStyle(!!error), width: 240, marginTop: 0 }}
        />
        {error && <Err>{error}</Err>}
      </span>
      <button onClick={create} disabled={busy} style={btn(true)}>
        {busy ? "Creating…" : "Start it"}
      </button>
      <button onClick={() => setOpen(false)} disabled={busy} style={btn(false)}>
        Cancel
      </button>
    </span>
  );
}

/* ---------------- Settings: persistent locked environments ---------------- */

function SettingsSection({ project, onProject }: { project: Project; onProject: (p: Project) => void }) {
  const [activeEnvId, setActiveEnvId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const activeEnv = project.environments.find((e) => e.id === activeEnvId) ?? null;

  async function add() {
    setBusy(true);
    setErrors({});
    try {
      const res = await fetch(`/api/projects/${project.id}/environments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErrors(
          d.fields
            ? Object.fromEntries(Object.entries(d.fields as Record<string, { message: string }>).map(([k, v]) => [k, v.message]))
            : { name: d.error ?? "Could not add the setting." }
        );
        return;
      }
      onProject(d.project);
      setName("");
      setDescription("");
      setOpen(false);
      setActiveEnvId(d.environment.id);
    } finally {
      setBusy(false);
    }
  }

  async function remove(envId: string) {
    const res = await fetch(`/api/projects/${project.id}/environments/${envId}`, { method: "DELETE" });
    const d = await res.json();
    if (res.ok) {
      if (activeEnvId === envId) setActiveEnvId(null);
      onProject(d.project);
    }
  }

  return (
    <section style={{ margin: "1.25rem 0" }}>
      <p style={{ fontSize: "0.9rem", fontWeight: 600 }}>The settings</p>
      <p style={{ fontSize: "0.75rem", opacity: 0.6, marginTop: 0 }}>
        Lock a place once — every page set there keeps the same architecture, colours, and landscape.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.6rem" }}>
        {project.environments.map((env) => (
          <div key={env.id} style={{ ...card(env.id === activeEnvId), cursor: "default" }}>
            {env.locked ? (
              <img
                src={`/api/projects/${project.id}/images/${env.locked.file}`}
                alt={env.name}
                style={{ width: "100%", borderRadius: 8, display: "block", marginBottom: 6 }}
              />
            ) : (
              <div
                style={{
                  border: "2px dashed #00000022",
                  borderRadius: 8,
                  height: 110,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
                  opacity: 0.6,
                  marginBottom: 6,
                }}
              >
                not locked yet
              </div>
            )}
            <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
              🏞️ {env.name}
              {env.locked && <span style={{ color: "#2a9d8f" }}> 🔒</span>}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              {!env.locked && (
                <button onClick={() => setActiveEnvId(env.id)} style={btnSmall(true)}>
                  Generate
                </button>
              )}
              <button onClick={() => remove(env.id)} style={btnSmall(false)}>
                Remove
              </button>
            </div>
          </div>
        ))}
        {!open ? (
          <div
            style={{ ...card(false), display: "flex", alignItems: "center", justifyContent: "center", minHeight: 120 }}
            onClick={() => setOpen(true)}
          >
            <span style={{ fontSize: "0.85rem", fontWeight: 600, opacity: 0.7 }}>＋ Add a setting</span>
          </div>
        ) : (
          <div style={{ ...card(true), cursor: "default", gridColumn: "span 2", minWidth: 260 }}>
            <p style={{ fontSize: "0.85rem", fontWeight: 600, margin: "0 0 0.5rem" }}>Add a setting</p>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              <span style={labelText}>Name (a few words)</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="the old stone bridge"
                style={inputStyle(!!errors.name)}
              />
              {errors.name && <Err>{errors.name}</Err>}
            </label>
            <label style={{ display: "block" }}>
              <span style={labelText}>Describe the place</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={320}
                placeholder="an arched stone bridge over a slow stream, mossy stones, wooded banks"
                style={{ ...inputStyle(!!errors.description), resize: "vertical" }}
              />
              {errors.description && <Err>{errors.description}</Err>}
            </label>
            {name.length === 0 && description.length === 0 && (
              <Chips
                options={SETTING_CHIPS.map((s) => s.name)}
                onPick={(picked) => {
                  const s = SETTING_CHIPS.find((c) => c.name === picked);
                  if (s) {
                    setName(s.name);
                    setDescription(s.description);
                  }
                }}
              />
            )}
            <button onClick={add} disabled={busy} style={{ ...btn(true), marginTop: "0.6rem" }}>
              {busy ? "Adding…" : "Add setting"}
            </button>
          </div>
        )}
      </div>

      {activeEnv && !activeEnv.locked && (
        <section key={activeEnv.id} style={{ border: "2px solid #c2724f33", borderRadius: 12, padding: "1rem", marginTop: "0.75rem" }}>
          <p style={{ fontSize: "0.9rem", fontWeight: 600, margin: "0 0 0.25rem" }}>🏞️ Generating {activeEnv.name}</p>
          <p style={{ fontSize: "0.78rem", opacity: 0.7, marginTop: 0 }}>{activeEnv.description}</p>
          <VariantChooser
            requestVariants={() =>
              fetch(`/api/projects/${project.id}/environments/${activeEnv.id}/generate`, { method: "POST" })
            }
            requestLock={(dataUrl) =>
              fetch(`/api/projects/${project.id}/environments/${activeEnv.id}/lock`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ imageDataUrl: dataUrl }),
              })
            }
            onLocked={(p) => {
              onProject(p);
              setActiveEnvId(null);
            }}
            idleHint="An establishing view of the place, empty of characters — lock it and every page set there stays consistent."
          />
        </section>
      )}
    </section>
  );
}

/* ---------------- Storyboard: beats + page art ---------------- */

function StoryboardSection({ project, onProject }: { project: Project; onProject: (p: Project) => void }) {
  const [activeBeatId, setActiveBeatId] = useState<string | null>(null);
  const [editBeatId, setEditBeatId] = useState<string | null>(null);
  const [fixBeatId, setFixBeatId] = useState<string | null>(null);
  const [fixInstruction, setFixInstruction] = useState("");
  const activeBeat = project.storyboard.find((b) => b.id === activeBeatId) ?? null;
  const fixBeat = project.storyboard.find((b) => b.id === fixBeatId) ?? null;
  const castById = new Map(project.cast.map((c) => [c.id, c]));

  async function removeBeat(beatId: string) {
    const res = await fetch(`/api/projects/${project.id}/beats/${beatId}`, { method: "DELETE" });
    const d = await res.json();
    if (res.ok) {
      if (activeBeatId === beatId) setActiveBeatId(null);
      onProject(d.project);
    }
  }

  return (
    <section style={{ margin: "1.5rem 0" }}>
      <p style={{ fontSize: "0.9rem", fontWeight: 600 }}>The storyboard</p>
      {project.cast.length === 0 && (
        <p style={{ fontSize: "0.78rem", opacity: 0.6 }}>Lock your cast first — every page is drawn from their locked references.</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {project.storyboard.map((beat, i) =>
          beat.id === editBeatId ? (
            <EditBeatCard
              key={beat.id}
              project={project}
              beat={beat}
              pageNumber={i + 1}
              onProject={(p) => {
                onProject(p);
                setEditBeatId(null);
              }}
              onCancel={() => setEditBeatId(null)}
            />
          ) : (
          <div key={beat.id} style={{ ...card(beat.id === activeBeatId), cursor: "default", display: "flex", gap: "0.75rem" }}>
            {beat.art ? (
              <img
                src={`/api/projects/${project.id}/images/${beat.art.file}`}
                alt={`page ${i + 1}`}
                style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
              />
            ) : (
              <div
                style={{
                  width: 120,
                  height: 120,
                  border: "2px dashed #00000022",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.72rem",
                  opacity: 0.6,
                  flexShrink: 0,
                  textAlign: "center",
                }}
              >
                no art yet
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                Page {i + 1}
                {beat.art && <span style={{ color: "#2a9d8f" }}> 🔒</span>}
                <span style={{ fontWeight: 400, opacity: 0.65 }}>
                  {" "}
                  · {beat.castIds.length === 0 ? "no characters (establishing shot)" : beat.castIds.map((cid) => castById.get(cid)?.name ?? "?").join(", ")}
                  {beat.environmentId && (
                    <> · 🏞️ {project.environments.find((e) => e.id === beat.environmentId)?.name ?? "?"}</>
                  )}
                </span>
              </div>
              <div style={{ fontSize: "0.78rem", opacity: 0.8, marginTop: 2 }}>{beat.sceneDescription}</div>
              {beat.text && (
                <div style={{ fontSize: "0.78rem", fontStyle: "italic", opacity: 0.65, marginTop: 2 }}>&ldquo;{beat.text}&rdquo;</div>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                {!beat.art && (
                  <button onClick={() => setActiveBeatId(beat.id)} style={btnSmall(true)}>
                    Generate page art
                  </button>
                )}
                {beat.art && (
                  <button
                    onClick={() => {
                      setFixInstruction("");
                      setFixBeatId(beat.id);
                    }}
                    style={btnSmall(true)}
                  >
                    ✏️ Point to fix
                  </button>
                )}
                <button onClick={() => setEditBeatId(beat.id)} style={btnSmall(false)}>
                  Edit
                </button>
                <button onClick={() => removeBeat(beat.id)} style={btnSmall(false)}>
                  Remove
                </button>
              </div>
            </div>
          </div>
          )
        )}
      </div>

      <AddBeatCard project={project} onProject={onProject} onAdded={(beatId) => setActiveBeatId(beatId)} />

      {activeBeat && !activeBeat.art && (
        <BeatWorkspace
          key={activeBeat.id}
          project={project}
          beat={activeBeat}
          pageNumber={project.storyboard.indexOf(activeBeat) + 1}
          onProject={onProject}
          onDone={() => setActiveBeatId(null)}
        />
      )}

      {fixBeat && fixBeat.art && (
        <RefineWorkspace
          key={`${fixBeat.id}:${fixInstruction}`}
          title={`✏️ Fixing page ${project.storyboard.indexOf(fixBeat) + 1}`}
          description={fixBeat.sceneDescription}
          imageSrc={`/api/projects/${project.id}/images/${fixBeat.art.file}`}
          refinePath={`/api/projects/${project.id}/beats/${fixBeat.id}/refine`}
          lockPath={`/api/projects/${project.id}/beats/${fixBeat.id}/lock`}
          initialInstruction={fixInstruction}
          onProject={onProject}
          onDone={() => setFixBeatId(null)}
        />
      )}

      <ContinuityPanel
        project={project}
        onFix={(page, instruction) => {
          const beat = project.storyboard[page - 1];
          if (beat?.art) {
            setFixInstruction(instruction);
            setFixBeatId(beat.id);
          }
        }}
      />
    </section>
  );
}

/** Book-level continuity review: the cross-page check no single-image gate can
 * do — reads the whole book in order and flags what a human editor would. */
function ContinuityPanel({ project, onFix }: { project: Project; onFix: (page: number, instruction: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<{
    pagesReviewed: number;
    issues: { pages: number[]; severity: string; what: string; fix: { kind: string; page: number; instruction: string } }[];
  } | null>(null);
  const lockedPages = project.storyboard.filter((b) => b.art).length;
  if (lockedPages < 2) return null;

  async function review() {
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/continuity`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) setError(d.error ?? "review failed");
      else setReport(d.report);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: "0.9rem", padding: "0.8rem", borderRadius: 12, background: "#00000006" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
        <button onClick={review} disabled={busy} style={btn(false)}>
          {busy ? "📖 Reading the whole book…" : "📖 Review the whole book"}
        </button>
        <span style={{ fontSize: "0.72rem", opacity: 0.6 }}>
          Checks the finished pages as a sequence — wardrobe, sizes, settings, cause-and-effect — like an editor would.
        </span>
      </div>
      {error && <Err>{error}</Err>}
      {report && report.issues.length === 0 && (
        <p style={{ fontSize: "0.8rem", margin: "0.6rem 0 0", color: "#2a9d8f", fontWeight: 600 }}>
          ✅ No continuity issues found across {report.pagesReviewed} pages.
        </p>
      )}
      {report && report.issues.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.6rem" }}>
          {report.issues.map((issue, i) => (
            <div key={i} style={{ fontSize: "0.78rem", background: "var(--surface)", borderRadius: 8, padding: "0.55rem 0.7rem" }}>
              <span style={{ fontWeight: 700, color: issue.severity === "major" ? "var(--accent-deep)" : "#8a6d3b" }}>
                {issue.severity === "major" ? "⚠️ major" : "◦ minor"}
              </span>{" "}
              <span style={{ opacity: 0.7 }}>page{issue.pages.length > 1 ? "s" : ""} {issue.pages.join(", ")}:</span> {issue.what}
              <div style={{ marginTop: 4, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {issue.fix.kind === "refine" && issue.fix.instruction && project.storyboard[issue.fix.page - 1]?.art ? (
                  <button onClick={() => onFix(issue.fix.page, issue.fix.instruction)} style={btnSmall(true)}>
                    ✏️ Fix page {issue.fix.page}: “{issue.fix.instruction.slice(0, 60)}{issue.fix.instruction.length > 60 ? "…" : ""}”
                  </button>
                ) : (
                  <span style={{ opacity: 0.65 }}>
                    Suggested: regenerate page {issue.fix.page} (Edit the page to adjust its scene — that clears the art — then generate again).
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Point-to-fix (Slice 3): say the fix plainly → edited variants that changed
 * only that → relock. Generic over what's being fixed (page art or a locked
 * cast reference). */
function RefineWorkspace({
  title,
  description,
  imageSrc,
  refinePath,
  lockPath,
  initialInstruction,
  onProject,
  onDone,
}: {
  title: string;
  description: string;
  imageSrc: string;
  refinePath: string;
  lockPath: string;
  /** Prefill (e.g. a continuity-review fix suggestion) — still editable. */
  initialInstruction?: string;
  onProject: (p: Project) => void;
  onDone: () => void;
}) {
  const [instruction, setInstruction] = useState(initialInstruction ?? "");

  return (
    <section style={{ border: "2px solid #c2724f33", borderRadius: 12, padding: "1rem", marginTop: "0.75rem" }}>
      <p style={{ fontSize: "0.9rem", fontWeight: 600, margin: "0 0 0.25rem" }}>{title}</p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-start" }}>
        <img src={imageSrc} alt="current art" style={{ width: 140, height: 140, objectFit: "cover", borderRadius: 8 }} />
        <div style={{ flex: 1, minWidth: 260 }}>
          <p style={{ fontSize: "0.75rem", opacity: 0.65, margin: "0 0 0.5rem" }}>{description}</p>
          <label style={{ display: "block", marginBottom: "0.5rem" }}>
            <span style={labelText}>What should change? (just this one thing)</span>
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="make the umbrella bigger"
              style={inputStyle(false)}
            />
          </label>
          <VariantChooser
            requestVariants={() =>
              fetch(refinePath, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ instruction }),
              })
            }
            requestLock={(dataUrl) =>
              fetch(lockPath, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ imageDataUrl: dataUrl }),
              })
            }
            onLocked={(p) => {
              onProject(p);
              onDone();
            }}
            idleHint="Everything else stays exactly as it is — the gate rejects edits that change more than you asked."
          />
          <button onClick={onDone} style={{ ...btn(false), marginTop: "0.5rem" }}>
            Done
          </button>
        </div>
      </div>
    </section>
  );
}

function AddBeatCard({
  project,
  onProject,
  onAdded,
}: {
  project: Project;
  onProject: (p: Project) => void;
  onAdded: (beatId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [sceneDescription, setSceneDescription] = useState("");
  const [text, setText] = useState("");
  const [castIds, setCastIds] = useState<string[]>([]);
  const [environmentId, setEnvironmentId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function toggleCast(id: string) {
    setCastIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function add() {
    setBusy(true);
    setErrors({});
    try {
      const res = await fetch(`/api/projects/${project.id}/beats`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sceneDescription, text, castIds, environmentId }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErrors(
          d.fields
            ? Object.fromEntries(Object.entries(d.fields as Record<string, { message: string }>).map(([k, v]) => [k, v.message]))
            : { sceneDescription: d.error ?? "Could not add the page." }
        );
        return;
      }
      onProject(d.project);
      setSceneDescription("");
      setText("");
      setCastIds([]);
      setEnvironmentId("");
      onAdded(d.beat.id);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div
        style={{ ...card(false), display: "flex", alignItems: "center", justifyContent: "center", minHeight: 60, marginTop: "0.6rem" }}
        onClick={() => setOpen(true)}
      >
        <span style={{ fontSize: "0.85rem", fontWeight: 600, opacity: 0.7 }}>＋ Add a page</span>
      </div>
    );
  }

  return (
    <div style={{ ...card(true), cursor: "default", marginTop: "0.6rem", maxWidth: 560 }}>
      <p style={{ fontSize: "0.85rem", fontWeight: 600, margin: "0 0 0.5rem" }}>Add a page</p>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        <span style={labelText}>What happens in this scene? (drives the art)</span>
        <textarea
          value={sceneDescription}
          onChange={(e) => setSceneDescription(e.target.value)}
          rows={2}
          maxLength={MAX_SCENE_DESCRIPTION + 20}
          placeholder="Mia meets the grumpy troll on the old stone bridge at dusk"
          style={{ ...inputStyle(!!errors.sceneDescription), resize: "vertical" }}
        />
        <span style={{ fontSize: "0.68rem", opacity: 0.55 }}>{sceneDescription.length}/{MAX_SCENE_DESCRIPTION}</span>
        {errors.sceneDescription && <Err>{errors.sceneDescription}</Err>}
      </label>
      {sceneDescription.length === 0 && (
        <Chips
          options={sceneChips(
            (castIds.length > 0 ? project.cast.filter((m) => castIds.includes(m.id)) : project.cast).map((m) => m.name)
          )}
          onPick={setSceneDescription}
        />
      )}
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        <span style={labelText}>Page text (typeset on the page — leave empty for a wordless page)</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={MAX_PAGE_TEXT + 20}
          style={{ ...inputStyle(!!errors.text), resize: "vertical" }}
        />
        {errors.text && <Err>{errors.text}</Err>}
      </label>
      <span style={labelText}>Who&apos;s in this page?</span>
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", margin: "0.35rem 0 0.5rem" }}>
        {project.cast.map((m) => (
          <button
            key={m.id}
            onClick={() => toggleCast(m.id)}
            style={{
              ...btnSmall(castIds.includes(m.id)),
              opacity: m.locked ? 1 : 0.55,
            }}
            title={m.locked ? undefined : "Not locked yet — lock before generating this page"}
          >
            {ROLE_META[m.role].emoji} {m.name}
            {!m.locked && " (unlocked)"}
          </button>
        ))}
        {project.cast.length === 0 && <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>No cast yet — an establishing shot is fine.</span>}
      </div>
      {errors.castIds && <Err>{errors.castIds}</Err>}
      {project.environments.length > 0 && (
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          <span style={labelText}>Where does it happen?</span>
          <select value={environmentId} onChange={(e) => setEnvironmentId(e.target.value)} style={inputStyle(!!errors.environmentId)}>
            <option value="">no locked setting</option>
            {project.environments.map((env) => (
              <option key={env.id} value={env.id}>
                🏞️ {env.name}
                {env.locked ? "" : " (not locked yet)"}
              </option>
            ))}
          </select>
          {errors.environmentId && <Err>{errors.environmentId}</Err>}
        </label>
      )}
      <button onClick={add} disabled={busy} style={{ ...btn(true), marginTop: "0.4rem" }}>
        {busy ? "Adding…" : "Add page"}
      </button>
    </div>
  );
}

function EditBeatCard({
  project,
  beat,
  pageNumber,
  onProject,
  onCancel,
}: {
  project: Project;
  beat: StoryBeat;
  pageNumber: number;
  onProject: (p: Project) => void;
  onCancel: () => void;
}) {
  const [sceneDescription, setSceneDescription] = useState(beat.sceneDescription);
  const [text, setText] = useState(beat.text);
  const [castIds, setCastIds] = useState<string[]>(beat.castIds);
  const [environmentId, setEnvironmentId] = useState(beat.environmentId ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function toggleCast(id: string) {
    setCastIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function save() {
    setBusy(true);
    setErrors({});
    try {
      const res = await fetch(`/api/projects/${project.id}/beats/${beat.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sceneDescription, text, castIds, environmentId }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErrors(
          d.fields
            ? Object.fromEntries(Object.entries(d.fields as Record<string, { message: string }>).map(([k, v]) => [k, v.message]))
            : { sceneDescription: d.error ?? "Could not save." }
        );
        return;
      }
      onProject(d.project);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ ...card(true), cursor: "default" }}>
      <p style={{ fontSize: "0.85rem", fontWeight: 600, margin: "0 0 0.5rem" }}>Editing page {pageNumber}</p>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        <span style={labelText}>What happens in this scene? (drives the art)</span>
        <textarea
          value={sceneDescription}
          onChange={(e) => setSceneDescription(e.target.value)}
          rows={2}
          maxLength={MAX_SCENE_DESCRIPTION + 20}
          style={{ ...inputStyle(!!errors.sceneDescription), resize: "vertical" }}
        />
        {errors.sceneDescription && <Err>{errors.sceneDescription}</Err>}
      </label>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        <span style={labelText}>Page text</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={MAX_PAGE_TEXT + 20}
          style={{ ...inputStyle(!!errors.text), resize: "vertical" }}
        />
        {errors.text && <Err>{errors.text}</Err>}
      </label>
      <span style={labelText}>Who&apos;s in this page?</span>
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", margin: "0.35rem 0 0.5rem" }}>
        {project.cast.map((m) => (
          <button key={m.id} onClick={() => toggleCast(m.id)} style={{ ...btnSmall(castIds.includes(m.id)), opacity: m.locked ? 1 : 0.55 }}>
            {ROLE_META[m.role].emoji} {m.name}
            {!m.locked && " (unlocked)"}
          </button>
        ))}
      </div>
      {errors.castIds && <Err>{errors.castIds}</Err>}
      {project.environments.length > 0 && (
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          <span style={labelText}>Where does it happen?</span>
          <select value={environmentId} onChange={(e) => setEnvironmentId(e.target.value)} style={inputStyle(!!errors.environmentId)}>
            <option value="">no locked setting</option>
            {project.environments.map((env) => (
              <option key={env.id} value={env.id}>
                🏞️ {env.name}
                {env.locked ? "" : " (not locked yet)"}
              </option>
            ))}
          </select>
          {errors.environmentId && <Err>{errors.environmentId}</Err>}
        </label>
      )}
      {beat.art && (
        <p style={{ fontSize: "0.72rem", color: "#a8442a", margin: "0.25rem 0" }}>
          Changing the scene, cast, or setting clears this page&apos;s locked art (the picture would no longer match).
        </p>
      )}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem" }}>
        <button onClick={save} disabled={busy} style={btn(true)}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button onClick={onCancel} disabled={busy} style={btn(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function BeatWorkspace({
  project,
  beat,
  pageNumber,
  onProject,
  onDone,
}: {
  project: Project;
  beat: StoryBeat;
  pageNumber: number;
  onProject: (p: Project) => void;
  onDone: () => void;
}) {
  return (
    <section style={{ border: "2px solid #c2724f33", borderRadius: 12, padding: "1rem", marginTop: "0.75rem" }}>
      <p style={{ fontSize: "0.9rem", fontWeight: 600, margin: "0 0 0.25rem" }}>Generating page {pageNumber}</p>
      <p style={{ fontSize: "0.78rem", opacity: 0.7, marginTop: 0 }}>{beat.sceneDescription}</p>
      <VariantChooser
        requestVariants={() =>
          fetch(`/api/projects/${project.id}/beats/${beat.id}/generate`, { method: "POST" })
        }
        requestLock={(dataUrl) =>
          fetch(`/api/projects/${project.id}/beats/${beat.id}/lock`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ imageDataUrl: dataUrl }),
          })
        }
        onLocked={(p) => {
          onProject(p);
          onDone();
        }}
        idleHint="Your locked cast is drawn into this scene, checked character-by-character behind the Output Gate."
      />
    </section>
  );
}

/* ---------------- Add a cast member ---------------- */

function AddMemberCard({
  project,
  onProject,
  onAdded,
}: {
  project: Project;
  onProject: (p: Project) => void;
  onAdded: (castId: string) => void;
}) {
  const hasHero = project.cast.some((c) => c.role === "hero");
  const [open, setOpen] = useState(project.cast.length === 0);
  const [role, setRole] = useState<CastRole>(hasHero ? "sidekick" : "hero");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    setErrors({});
    try {
      const res = await fetch(`/api/projects/${project.id}/cast`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, name, description }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErrors(
          d.fields
            ? Object.fromEntries(Object.entries(d.fields as Record<string, { message: string }>).map(([k, v]) => [k, v.message]))
            : { name: d.error ?? "Could not add the character." }
        );
        return;
      }
      onProject(d.project);
      setName("");
      setDescription("");
      setRole(d.project.cast.some((c: { role: string }) => c.role === "hero") ? "sidekick" : "hero");
      onAdded(d.member.id);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div
        style={{ ...card(false), display: "flex", alignItems: "center", justifyContent: "center", minHeight: 120 }}
        onClick={() => setOpen(true)}
      >
        <span style={{ fontSize: "0.85rem", fontWeight: 600, opacity: 0.7 }}>＋ Add a character</span>
      </div>
    );
  }

  return (
    <div style={{ ...card(true), cursor: "default", gridColumn: "span 2", minWidth: 260 }}>
      <p style={{ fontSize: "0.85rem", fontWeight: 600, margin: "0 0 0.5rem" }}>Add a character</p>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        <span style={labelText}>Role</span>
        <select value={role} onChange={(e) => setRole(e.target.value as CastRole)} style={inputStyle(!!errors.role)}>
          {CAST_ROLES.map((r) => (
            <option key={r} value={r} disabled={r === "hero" && hasHero}>
              {ROLE_META[r].emoji} {ROLE_META[r].label}
              {r === "hero" && hasHero ? " (already cast)" : ""}
            </option>
          ))}
        </select>
        {errors.role && <Err>{errors.role}</Err>}
      </label>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        <span style={labelText}>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle(!!errors.name)} />
        {errors.name && <Err>{errors.name}</Err>}
      </label>
      <label style={{ display: "block" }}>
        <span style={labelText}>Describe them</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={MAX_DESCRIPTION + 20}
          placeholder="a grumpy troll with orange hair and a mossy staff"
          style={{ ...inputStyle(!!errors.description), resize: "vertical" }}
        />
        <span style={{ fontSize: "0.68rem", opacity: 0.55 }}>
          {description.length}/{MAX_DESCRIPTION} · drives artwork only — never the story&apos;s plot
        </span>
        {errors.description && <Err>{errors.description}</Err>}
      </label>
      {description.length === 0 && <Chips options={CHARACTER_CHIPS[role]} onPick={setDescription} hint={CHARACTER_HINT} />}
      <button onClick={add} disabled={busy} style={{ ...btn(true), marginTop: "0.6rem" }}>
        {busy ? "Adding…" : "Add to cast"}
      </button>
    </div>
  );
}

/* ---------------- Generate → choose from 3 → lock ---------------- */

function GenerateWorkspace({
  project,
  member,
  onProject,
  onDone,
}: {
  project: Project;
  member: { id: string; role: CastRole; name: string; description: string };
  onProject: (p: Project) => void;
  onDone: () => void;
}) {
  return (
    <section style={{ border: "2px solid #c2724f33", borderRadius: 12, padding: "1rem", marginTop: "0.5rem" }}>
      <p style={{ fontSize: "0.9rem", fontWeight: 600, margin: "0 0 0.25rem" }}>
        {ROLE_META[member.role].emoji} Generating {member.name} <span style={{ opacity: 0.6 }}>({ROLE_META[member.role].label})</span>
      </p>
      <p style={{ fontSize: "0.78rem", opacity: 0.7, marginTop: 0 }}>{member.description}</p>
      <VariantChooser
        requestVariants={() =>
          fetch("/api/generate-character", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: member.name, description: member.description, styleId: project.styleId }),
          })
        }
        requestLock={(dataUrl) =>
          fetch(`/api/projects/${project.id}/cast/${member.id}/lock`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ imageDataUrl: dataUrl }),
          })
        }
        onLocked={(p) => {
          onProject(p);
          onDone();
        }}
        idleHint="Real artwork via Gemini, server-side behind the Output Gate (safety stub + quality + consistency, with auto-reroll). You'll pick your favourite of 3, then lock."
      />
    </section>
  );
}

/* ---------------- shared generate → choose from 3 → lock ---------------- */

function VariantChooser({
  requestVariants,
  requestLock,
  onLocked,
  idleHint,
}: {
  requestVariants: () => Promise<Response>;
  requestLock: (dataUrl: string) => Promise<Response>;
  onLocked: (p: Project) => void;
  idleHint: string;
}) {
  const [variants, setVariants] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [locking, setLocking] = useState(false);
  const [meta, setMeta] = useState("");

  async function generate() {
    setBusy(true);
    setMeta("Starting…");
    try {
      const res = await requestVariants();
      const contentType = res.headers.get("content-type") ?? "";
      let data: GenResponse | null = null;
      if (!res.ok || !contentType.includes("ndjson") || !res.body) {
        // Validation failures (4xx) and non-streaming responses are plain JSON.
        data = (await res.json()) as GenResponse;
        if (!res.ok) {
          setMeta(`⚠️ ${data.error ?? "Generation failed."}`);
          return;
        }
      } else {
        // NDJSON stream (W-3): {progress} lines, then one {done} or {error}.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamError: string | null = null;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const msg = JSON.parse(line) as { progress?: Progress; done?: GenResponse; error?: string };
            if (msg.progress) setMeta(progressText(msg.progress));
            else if (msg.error) streamError = msg.error;
            else if (msg.done) data = msg.done;
          }
        }
        if (streamError || !data) {
          setMeta(`⚠️ ${streamError ?? "Generation failed."}`);
          return;
        }
      }
      setVariants(data.variants ?? []);
      setSelected(0);
      setMeta(
        `${data.variants?.length ?? 0} options · ${data.attempts} generated · $${data.costUsd?.toFixed(3)}` +
          (data.satisfied ? "" : " · (budget reached)")
      );
    } catch (e) {
      setMeta(`⚠️ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function lock() {
    setLocking(true);
    try {
      const res = await requestLock(variants[selected]);
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
    <>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button onClick={generate} disabled={busy || locking} style={btn(true)}>
          {busy ? "Generating 3 options… (~60–120s)" : variants.length ? "Generate again" : "Generate 3 options"}
        </button>
        {variants.length > 0 && (
          <button onClick={lock} disabled={busy || locking} style={btn(false)}>
            {locking ? "Locking…" : "Lock this one 🔒"}
          </button>
        )}
      </div>
      {meta && <p style={{ fontSize: "0.75rem", opacity: 0.7, marginTop: 8 }}>{meta}</p>}

      {variants.length > 0 && (
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 300px", border: "3px solid #00000018", borderRadius: 12, overflow: "hidden", background: "#fffdf8" }}>
            <img src={variants[selected]} alt="option preview" style={{ width: "100%", display: "block" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {variants.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`option ${i + 1}`}
                onClick={() => setSelected(i)}
                style={{
                  width: 90,
                  height: 90,
                  objectFit: "cover",
                  borderRadius: 8,
                  cursor: "pointer",
                  border: `3px solid ${selected === i ? "#c2724f" : "transparent"}`,
                }}
              />
            ))}
          </div>
        </div>
      )}
      {variants.length === 0 && !busy && <p style={{ fontSize: "0.78rem", opacity: 0.6 }}>{idleHint}</p>}
    </>
  );
}

/* ---------------- shared bits ---------------- */

const labelText: React.CSSProperties = { fontSize: "0.8rem", fontWeight: 600 };

function card(active: boolean): React.CSSProperties {
  return {
    border: `2px solid ${active ? "var(--accent)" : "transparent"}`,
    borderRadius: 14,
    padding: "0.7rem",
    cursor: "pointer",
    background: "var(--surface)",
    boxShadow: "var(--shadow-soft)",
  };
}

function inputStyle(error: boolean): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    marginTop: 4,
    padding: "0.5rem 0.65rem",
    borderRadius: 9,
    border: `1px solid ${error ? "var(--accent)" : "var(--line)"}`,
    background: "var(--surface)",
    fontFamily: "inherit",
    fontSize: "0.9rem",
  };
}

function btn(primary: boolean): React.CSSProperties {
  return {
    padding: "0.5rem 0.95rem",
    borderRadius: 10,
    border: primary ? "none" : "1px solid var(--line)",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "0.85rem",
    background: primary ? "var(--accent)" : "var(--surface)",
    color: primary ? "#fff" : "#41403d",
    boxShadow: primary ? "0 1px 2px rgba(43,35,26,0.18)" : "0 1px 2px rgba(43,35,26,0.06)",
  };
}

function btnSmall(primary: boolean): React.CSSProperties {
  return { ...btn(primary), padding: "0.25rem 0.55rem", fontSize: "0.72rem" };
}

function Err({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "var(--accent-deep)", fontSize: "0.75rem", display: "block" }}>{children}</span>;
}

/** R-7 scaffolding: "try one" starters shown while a box is empty — click to fill, then edit. */
function Chips({ options, onPick, hint }: { options: string[]; onPick: (v: string) => void; hint?: string }) {
  return (
    <div style={{ margin: "0.3rem 0 0.2rem" }}>
      {hint && <span style={{ fontSize: "0.68rem", opacity: 0.55, display: "block", marginBottom: 4 }}>{hint}</span>}
      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onPick(o)}
            style={{
              fontSize: "0.7rem",
              padding: "0.2rem 0.55rem",
              borderRadius: 999,
              border: "1px dashed #c2724f66",
              background: "#fff",
              cursor: "pointer",
              color: "#7a4a35",
              textAlign: "left",
            }}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
