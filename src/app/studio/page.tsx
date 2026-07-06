"use client";

import { useEffect, useState } from "react";
import { HOUSE_STYLES, HOUSE_STYLE_BY_ID } from "@/content/houseStyles";
import { MAX_DESCRIPTION } from "@/lib/art/brief";
import { CAST_ROLES, type CastRole, type Project, type ProjectSummary } from "@/lib/project/types";

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

      <section style={{ marginTop: "1.5rem", maxWidth: 560 }}>
        <p style={{ fontSize: "0.85rem", fontWeight: 600 }}>Start a new book</p>
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
    </>
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
  const active = project.cast.find((c) => c.id === activeId) ?? null;

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

      <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid #00000012", opacity: 0.6 }}>
        <p style={{ fontSize: "0.85rem", fontWeight: 600 }}>Coming next:</p>
        <p style={{ fontSize: "0.8rem", margin: 0 }}>
          the <strong>storyboard</strong> — every beat says who&apos;s in it, and your locked cast appears together in
          each scene · point-to-fix any detail · export the print-ready booklet.
        </p>
      </div>
    </>
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
  const [variants, setVariants] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [locking, setLocking] = useState(false);
  const [meta, setMeta] = useState("");

  async function generate() {
    setBusy(true);
    setMeta("");
    try {
      const res = await fetch("/api/generate-character", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: member.name, description: member.description, styleId: project.styleId }),
      });
      const data: GenResponse = await res.json();
      if (!res.ok) {
        setMeta(`⚠️ ${data.error ?? "Generation failed."}`);
        return;
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
      const res = await fetch(`/api/projects/${project.id}/cast/${member.id}/lock`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageDataUrl: variants[selected] }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMeta(`⚠️ ${d.error ?? "Could not lock."}`);
        return;
      }
      onProject(d.project);
      onDone();
    } finally {
      setLocking(false);
    }
  }

  return (
    <section style={{ border: "2px solid #c2724f33", borderRadius: 12, padding: "1rem", marginTop: "0.5rem" }}>
      <p style={{ fontSize: "0.9rem", fontWeight: 600, margin: "0 0 0.25rem" }}>
        {ROLE_META[member.role].emoji} Generating {member.name} <span style={{ opacity: 0.6 }}>({ROLE_META[member.role].label})</span>
      </p>
      <p style={{ fontSize: "0.78rem", opacity: 0.7, marginTop: 0 }}>{member.description}</p>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button onClick={generate} disabled={busy || locking} style={btn(true)}>
          {busy ? "Generating 3 options… (~60s)" : variants.length ? "Generate again" : "Generate 3 options"}
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
            <img src={variants[selected]} alt="character option" style={{ width: "100%", display: "block" }} />
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
      {variants.length === 0 && !busy && (
        <p style={{ fontSize: "0.78rem", opacity: 0.6 }}>
          Real artwork via Gemini, server-side behind the Output Gate (safety stub + quality + consistency, with
          auto-reroll). You&apos;ll pick your favourite of 3, then lock.
        </p>
      )}
    </section>
  );
}

/* ---------------- shared bits ---------------- */

const labelText: React.CSSProperties = { fontSize: "0.8rem", fontWeight: 600 };

function card(active: boolean): React.CSSProperties {
  return {
    border: `2px solid ${active ? "#c2724f" : "#00000018"}`,
    borderRadius: 10,
    padding: "0.6rem",
    cursor: "pointer",
    background: "#fff",
  };
}

function inputStyle(error: boolean): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    marginTop: 4,
    padding: "0.45rem 0.55rem",
    borderRadius: 6,
    border: `1px solid ${error ? "#c2724f" : "#00000022"}`,
    background: "#fff",
    fontFamily: "inherit",
    fontSize: "0.9rem",
  };
}

function btn(primary: boolean): React.CSSProperties {
  return {
    padding: "0.5rem 0.9rem",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.85rem",
    background: primary ? "#c2724f" : "#eee",
    color: primary ? "#fff" : "#333",
  };
}

function btnSmall(primary: boolean): React.CSSProperties {
  return { ...btn(primary), padding: "0.25rem 0.55rem", fontSize: "0.72rem" };
}

function Err({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "#a8442a", fontSize: "0.75rem", display: "block" }}>{children}</span>;
}
