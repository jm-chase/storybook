"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type { BeatProduction, BoardNote, Project } from "@/lib/project/types";

// The infinite storyboard board: a Figma-style pan/zoom canvas where every
// page, cast member, setting, and sticky note is a draggable card. Reading
// order is SPATIAL: page cards sorted left-to-right ARE the book order —
// dragging a page horizontally reorders the book (synced via /beats/order).
// Click a card to open the right INSPECTOR (production notes editable on
// pages; note text editable on stickies). Positions + notes persist on the
// project (board). No canvas library — pointer events + CSS transforms.

interface Pos {
  x: number;
  y: number;
}

type CardKind = "page" | "cast" | "env" | "note" | "idea";

interface CardDef {
  id: string;
  kind: CardKind;
  title: string;
  subtitle?: string;
  imageSrc?: string;
  noteText?: string;
  w: number;
  h: number;
}

const PAGE_W = 200;
const PAGE_H = 268;
const CAST_W = 132;
const CAST_H = 176;
const ENV_W = 156;
const ENV_H = 150;
const NOTE_W = 170;
const NOTE_H = 120;

function defaultLayout(project: Project): Record<string, Pos> {
  const pos: Record<string, Pos> = {};
  (project.imageboard ?? []).forEach((im, i) => {
    pos[im.file] = { x: 60 + i * (ENV_W + 24), y: -180 };
  });
  project.cast.forEach((c, i) => {
    pos[c.id] = { x: 60 + i * (CAST_W + 28), y: 40 };
  });
  project.storyboard.forEach((b, i) => {
    pos[b.id] = { x: 60 + i * (PAGE_W + 44), y: 300 };
  });
  project.environments.forEach((e, i) => {
    pos[e.id] = { x: 60 + i * (ENV_W + 28), y: 640 };
  });
  return pos;
}

interface NarrativeReport {
  arcStages: { page: number; stage: string; note: string }[];
  issues: { pages: number[]; what: string; suggestion: string }[];
}

export default function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [positions, setPositions] = useState<Record<string, Pos>>({});
  const [notes, setNotes] = useState<BoardNote[]>([]);
  const [pan, setPan] = useState<Pos>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<NarrativeReport | null>(null);
  const [narrativeBusy, setNarrativeBusy] = useState(false);
  const [note, setNote] = useState("");
  const [showNorthStar, setShowNorthStar] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const drag = useRef<
    | { mode: "pan"; startClient: Pos; startPan: Pos; moved: boolean }
    | { mode: "card"; id: string; kind: CardKind; startClient: Pos; startPos: Pos; moved: boolean }
    | null
  >(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const notesRef = useRef(notes);
  notesRef.current = notes;

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.project) return;
        const p: Project = d.project;
        setProject(p);
        setPositions({ ...defaultLayout(p), ...(p.board?.positions ?? {}) });
        setNotes(p.board?.notes ?? []);
      });
  }, [id]);

  const schedulePersist = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ board: { positions: positionsRef.current, notes: notesRef.current } }),
      }).catch(() => {});
    }, 800);
  }, [id]);

  /** After a page drag: book order = page cards sorted by x. */
  const syncPageOrder = useCallback(async () => {
    if (!project) return;
    const ordered = [...project.storyboard]
      .sort((a, b) => (positionsRef.current[a.id]?.x ?? 0) - (positionsRef.current[b.id]?.x ?? 0))
      .map((b) => b.id);
    const current = project.storyboard.map((b) => b.id);
    if (JSON.stringify(ordered) === JSON.stringify(current)) return;
    const res = await fetch(`/api/projects/${id}/beats/order`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ beatIds: ordered }),
    });
    const d = await res.json();
    if (res.ok) {
      setProject(d.project);
      setNote("Page order updated from the board ✓");
      setTimeout(() => setNote(""), 2500);
    }
  }, [id, project]);

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-inspector]") || target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.tagName === "BUTTON") return;
    const cardEl = target.closest("[data-card-id]") as HTMLElement | null;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (cardEl) {
      const cid = cardEl.dataset.cardId!;
      const kind = cardEl.dataset.cardKind as CardKind;
      drag.current = {
        mode: "card",
        id: cid,
        kind,
        startClient: { x: e.clientX, y: e.clientY },
        startPos: positionsRef.current[cid] ?? { x: 0, y: 0 },
        moved: false,
      };
    } else {
      drag.current = { mode: "pan", startClient: { x: e.clientX, y: e.clientY }, startPan: pan, moved: false };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startClient.x;
    const dy = e.clientY - d.startClient.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (d.mode === "pan") {
      setPan({ x: d.startPan.x + dx, y: d.startPan.y + dy });
    } else {
      setPositions((prev) => ({
        ...prev,
        [d.id]: { x: d.startPos.x + dx / zoom, y: d.startPos.y + dy / zoom },
      }));
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.mode === "card") {
      if (!d.moved) {
        setSelectedId(d.id);
        return;
      }
      schedulePersist();
      if (d.kind === "page") void syncPageOrder();
    } else if (!d.moved) {
      setSelectedId(null);
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const next = Math.min(3, Math.max(0.2, zoom * Math.exp(-e.deltaY * 0.0012)));
    setPan({ x: mx - ((mx - pan.x) * next) / zoom, y: my - ((my - pan.y) * next) / zoom });
    setZoom(next);
  };

  async function runNarrative() {
    setNarrativeBusy(true);
    try {
      const res = await fetch(`/api/projects/${id}/narrative`, { method: "POST" });
      const d = await res.json();
      if (res.ok) setNarrative(d.report);
      else setNote(d.error ?? "narrative review failed");
    } finally {
      setNarrativeBusy(false);
    }
  }

  function addNote() {
    const rect = viewportRef.current?.getBoundingClientRect();
    const cx = rect ? (rect.width / 2 - pan.x) / zoom : 200;
    const cy = rect ? (rect.height / 2 - pan.y) / zoom : 200;
    const n: BoardNote = { id: `note-${Date.now().toString(36)}`, text: "" };
    setNotes((prev) => [...prev, n]);
    setPositions((prev) => ({ ...prev, [n.id]: { x: cx - NOTE_W / 2, y: cy - NOTE_H / 2 } }));
    setSelectedId(n.id);
    schedulePersist();
  }

  function tidyBoard() {
    if (!project) return;
    const base = defaultLayout(project);
    notesRef.current.forEach((n, i) => {
      base[n.id] = { x: 60 + i * (NOTE_W + 24), y: -140 };
    });
    setPositions(base);
    schedulePersist();
    setNote("Board tidied ✓");
    setTimeout(() => setNote(""), 2000);
  }

  const cards: CardDef[] = useMemo(() => {
    if (!project) return [];
    const stageByPage = new Map((narrative?.arcStages ?? []).map((s) => [s.page, s.stage]));
    return [
      ...project.cast.map((c) => ({
        id: c.id,
        kind: "cast" as const,
        title: c.name,
        subtitle: c.role,
        imageSrc: c.locked ? `/api/projects/${project.id}/images/${c.locked.file}` : undefined,
        w: CAST_W,
        h: CAST_H,
      })),
      ...project.storyboard.map((b, i) => ({
        id: b.id,
        kind: "page" as const,
        title: `Page ${i + 1}${stageByPage.has(i + 1) ? ` · ${stageByPage.get(i + 1)}` : ""}`,
        subtitle: b.text || b.sceneDescription,
        imageSrc: b.art ? `/api/projects/${project.id}/images/${b.art.file}` : undefined,
        w: PAGE_W,
        h: PAGE_H,
      })),
      ...project.environments.map((e) => ({
        id: e.id,
        kind: "env" as const,
        title: e.name,
        subtitle: "setting",
        imageSrc: e.locked ? `/api/projects/${project.id}/images/${e.locked.file}` : undefined,
        w: ENV_W,
        h: ENV_H,
      })),
      ...(project.imageboard ?? []).map((im) => ({
        id: im.file,
        kind: "idea" as const,
        title: "inspiration",
        subtitle: "image board",
        imageSrc: `/api/projects/${project.id}/images/${im.file}`,
        w: ENV_W,
        h: ENV_H,
      })),
      ...notes.map((n) => ({
        id: n.id,
        kind: "note" as const,
        title: "note",
        noteText: n.text,
        w: NOTE_W,
        h: NOTE_H,
      })),
    ];
  }, [project, narrative, notes]);

  const thread = useMemo(() => {
    if (!project) return "";
    return project.storyboard
      .map((b) => {
        const p = positions[b.id];
        return p ? `${p.x + PAGE_W / 2},${p.y + PAGE_H / 2}` : null;
      })
      .filter(Boolean)
      .join(" ");
  }, [project, positions]);

  if (!project) {
    return <main style={{ padding: "2rem" }}>Loading board…</main>;
  }

  const selectedCard = cards.find((c) => c.id === selectedId) ?? null;

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "var(--paper)" }}>
      {/* canvas */}
      <div
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        style={{ position: "absolute", inset: 0, cursor: drag.current?.mode === "pan" ? "grabbing" : "grab", touchAction: "none" }}
      >
        <div
          style={{
            position: "absolute",
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          <svg width={8000} height={4000} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", overflow: "visible" }}>
            {thread && <polyline points={thread} fill="none" stroke="var(--accent)" strokeOpacity={0.35} strokeWidth={3} strokeDasharray="8 7" />}
          </svg>
          {cards.map((card) => {
            const p = positions[card.id] ?? { x: 0, y: 0 };
            const selected = card.id === selectedId;
            return (
              <div
                key={card.id}
                data-card-id={card.id}
                data-card-kind={card.kind}
                style={{
                  position: "absolute",
                  left: p.x,
                  top: p.y,
                  width: card.w,
                  minHeight: card.kind === "note" ? NOTE_H : undefined,
                  background: card.kind === "note" ? "#fff6c9" : "var(--surface)",
                  borderRadius: 12,
                  boxShadow: selected ? "0 0 0 2.5px var(--accent), var(--shadow-soft)" : "var(--shadow-soft)",
                  padding: 8,
                  cursor: "move",
                  userSelect: "none",
                  border: card.kind === "page" ? "1px solid var(--line)" : card.kind === "note" ? "1px solid #e8d98a" : "1px dashed #00000020",
                }}
              >
                {card.kind === "note" ? (
                  <div style={{ fontSize: 12, lineHeight: 1.45, whiteSpace: "pre-wrap", minHeight: NOTE_H - 20, opacity: card.noteText ? 0.85 : 0.4 }}>
                    {card.noteText || "empty note — click to write"}
                  </div>
                ) : (
                  <>
                    {card.imageSrc ? (
                      <img
                        src={card.imageSrc}
                        alt={card.title}
                        draggable={false}
                        style={{ width: "100%", height: card.h - 62, objectFit: "cover", borderRadius: 8, pointerEvents: "none" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: card.h - 62,
                          borderRadius: 8,
                          border: "2px dashed #00000018",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          opacity: 0.55,
                        }}
                      >
                        no art yet
                      </div>
                    )}
                    <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {card.title}
                    </div>
                    {card.subtitle && (
                      <div style={{ fontSize: 10.5, opacity: 0.6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {card.subtitle}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* top bar */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          right: 12,
          display: "flex",
          alignItems: "center",
          gap: 10,
          pointerEvents: "none",
          flexWrap: "wrap",
        }}
      >
        <a href="/studio" style={{ ...toolBtn, pointerEvents: "auto", textDecoration: "none" }}>
          ← Studio
        </a>
        <span style={{ fontWeight: 800, fontSize: 15, background: "var(--surface)", padding: "6px 12px", borderRadius: 10, boxShadow: "var(--shadow-soft)" }}>
          🗂️ {project.title}
        </span>
        <button onClick={runNarrative} disabled={narrativeBusy} style={{ ...toolBtn, pointerEvents: "auto" }}>
          {narrativeBusy ? "📖 Reading…" : "📖 Narrative check"}
        </button>
        <button onClick={addNote} style={{ ...toolBtn, pointerEvents: "auto" }}>
          📝 Note
        </button>
        <button onClick={() => setShowNorthStar((v) => !v)} style={{ ...toolBtn, pointerEvents: "auto" }}>
          🧭 North Star
        </button>
        <button onClick={tidyBoard} style={{ ...toolBtn, pointerEvents: "auto" }}>
          🧹 Tidy
        </button>
        <button
          onClick={() => {
            setPan({ x: 0, y: 0 });
            setZoom(1);
          }}
          style={{ ...toolBtn, pointerEvents: "auto" }}
        >
          ⤾ Reset ({Math.round(zoom * 100)}%)
        </button>
        {note && (
          <span style={{ fontSize: 12, fontWeight: 700, color: "#2a9d8f", background: "var(--surface)", padding: "5px 10px", borderRadius: 8 }}>
            {note}
          </span>
        )}
      </div>

      {/* North Star: docked left — the philosophy, always one click away */}
      {showNorthStar && (
        <div data-inspector style={{ ...panelStyle, right: undefined, left: 12, width: 300 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>🧭 North Star</strong>
            <button onClick={() => setShowNorthStar(false)} style={{ ...toolBtn, padding: "2px 8px" }}>
              ✕
            </button>
          </div>
          {!project.bible || Object.keys(project.bible).length === 0 ? (
            <p style={{ opacity: 0.65, marginTop: 8 }}>
              No North Star yet — write it in the studio (🧭 North Star section), or draft it from the book there.
            </p>
          ) : (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              {project.bible.theme && (
                <div>
                  <div style={nsLabel}>theme</div>
                  <div style={{ fontWeight: 700 }}>{project.bible.theme}</div>
                </div>
              )}
              {project.bible.message && (
                <div>
                  <div style={nsLabel}>message</div>
                  <div>{project.bible.message}</div>
                </div>
              )}
              {project.bible.voice && (
                <div>
                  <div style={nsLabel}>voice</div>
                  <div style={{ opacity: 0.85 }}>{project.bible.voice}</div>
                </div>
              )}
              {project.bible.artDirection && (
                <div>
                  <div style={nsLabel}>art direction</div>
                  <div style={{ opacity: 0.85 }}>{project.bible.artDirection}</div>
                </div>
              )}
              {(project.bible.motifs ?? []).length > 0 && (
                <div>
                  <div style={nsLabel}>motifs</div>
                  {(project.bible.motifs ?? []).map((m) => (
                    <div key={m.id} style={{ marginBottom: 4 }}>
                      {m.text}
                      {(m.pages ?? []).map((pg) => {
                        const beat = project.storyboard[pg - 1];
                        return beat ? (
                          <button
                            key={pg}
                            onClick={() => {
                              const p = positionsRef.current[beat.id];
                              const rect = viewportRef.current?.getBoundingClientRect();
                              if (p && rect) {
                                setPan({
                                  x: rect.width / 2 - (p.x + PAGE_W / 2) * zoom,
                                  y: rect.height / 2 - (p.y + PAGE_H / 2) * zoom,
                                });
                                setSelectedId(beat.id);
                              }
                            }}
                            style={{ ...toolBtn, padding: "1px 7px", marginLeft: 4, fontSize: 11 }}
                          >
                            p{pg}
                          </button>
                        ) : null;
                      })}
                    </div>
                  ))}
                </div>
              )}
              {(project.bible.inspiration ?? []).length > 0 && (
                <div>
                  <div style={nsLabel}>inspiration</div>
                  {(project.bible.inspiration ?? []).map((m) => (
                    <div key={m.id} style={{ opacity: 0.85, marginBottom: 3 }}>
                      {m.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* right side: inspector wins over narrative panel */}
      {selectedCard ? (
        <Inspector
          key={selectedCard.id}
          project={project}
          card={selectedCard}
          notes={notes}
          onProject={setProject}
          onNotes={(next) => {
            setNotes(next);
            schedulePersist();
          }}
          onClose={() => setSelectedId(null)}
        />
      ) : (
        narrative && (
          <div data-inspector style={panelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>📖 Narrative read-through</strong>
              <button onClick={() => setNarrative(null)} style={{ ...toolBtn, padding: "2px 8px" }}>
                ✕
              </button>
            </div>
            <div style={{ marginTop: 8 }}>
              {narrative.arcStages.map((s) => (
                <div key={s.page} style={{ display: "flex", gap: 6, padding: "2px 0" }}>
                  <span style={{ fontWeight: 700, minWidth: 52 }}>p{s.page}</span>
                  <span style={{ color: "var(--accent-deep)", fontWeight: 600, minWidth: 70 }}>{s.stage}</span>
                  <span style={{ opacity: 0.75 }}>{s.note}</span>
                </div>
              ))}
            </div>
            {narrative.issues.length === 0 ? (
              <p style={{ color: "#2a9d8f", fontWeight: 700 }}>✅ The story reads well — no structural issues.</p>
            ) : (
              narrative.issues.map((it, i) => (
                <div key={i} style={{ background: "#00000006", borderRadius: 8, padding: "0.5rem 0.6rem", marginTop: 8 }}>
                  <div>
                    <strong>p{it.pages.join(", ")}:</strong> {it.what}
                  </div>
                  <div style={{ opacity: 0.75, marginTop: 3 }}>💡 {it.suggestion}</div>
                </div>
              ))
            )}
          </div>
        )
      )}
    </div>
  );
}

/** Right inspector: page production notes are editable; notes are editable;
 * cast/settings show their description. */
function Inspector({
  project,
  card,
  notes,
  onProject,
  onNotes,
  onClose,
}: {
  project: Project;
  card: CardDef;
  notes: BoardNote[];
  onProject: (p: Project) => void;
  onNotes: (n: BoardNote[]) => void;
  onClose: () => void;
}) {
  const beatIndex = project.storyboard.findIndex((b) => b.id === card.id);
  const beat = beatIndex >= 0 ? project.storyboard[beatIndex] : null;
  const member = project.cast.find((c) => c.id === card.id) ?? null;
  const env = project.environments.find((e) => e.id === card.id) ?? null;
  const boardNote = notes.find((n) => n.id === card.id) ?? null;

  const [production, setProduction] = useState<BeatProduction>(beat?.production ?? {});
  const [colorScript, setColorScript] = useState(beat?.colorScript ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function saveProduction() {
    if (!beat) return;
    setBusy(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/projects/${project.id}/beats/${beat.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ production, colorScript }),
      });
      const d = await res.json();
      if (res.ok) {
        onProject(d.project);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-inspector style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong>
          {beat ? `📄 Page ${beatIndex + 1}` : member ? `🧸 ${member.name}` : env ? `🏞️ ${env.name}` : "📝 Note"}
        </strong>
        <button onClick={onClose} style={{ ...toolBtn, padding: "2px 8px" }}>
          ✕
        </button>
      </div>

      {beat && (
        <>
          <BeatSceneEditor project={project} beat={beat} onProject={onProject} />
          <label style={{ display: "block", marginBottom: 6, marginTop: 10 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", opacity: 0.55 }}>
              🎨 color script (feeds the art)
            </span>
            <input value={colorScript} onChange={(e) => setColorScript(e.target.value)} style={inspectorInput} />
          </label>
          {(["camera", "shotNotes", "timing", "dialogue"] as const).map((key) => (
            <label key={key} style={{ display: "block", marginBottom: 6 }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", opacity: 0.55 }}>{key}</span>
              <input
                value={production[key] ?? ""}
                onChange={(e) => setProduction((p) => ({ ...p, [key]: e.target.value }))}
                style={inspectorInput}
              />
            </label>
          ))}
          <button onClick={saveProduction} disabled={busy} style={{ ...toolBtn, marginTop: 4 }}>
            {busy ? "Saving…" : saved ? "Saved ✓" : "Save production notes"}
          </button>
          <BeatArtStudio project={project} beat={beat} onProject={onProject} />
        </>
      )}

      {member && <div style={{ opacity: 0.75 }}>{member.description}</div>}
      {env && <div style={{ opacity: 0.75 }}>{env.description}</div>}

      {boardNote && (
        <>
          <textarea
            value={boardNote.text}
            onChange={(e) => onNotes(notes.map((n) => (n.id === boardNote.id ? { ...n, text: e.target.value.slice(0, 300) } : n)))}
            rows={6}
            placeholder="Write the note…"
            style={{ ...inspectorInput, resize: "vertical", minHeight: 100 }}
          />
          <button
            onClick={() => {
              onNotes(notes.filter((n) => n.id !== boardNote.id));
              onClose();
            }}
            style={{ ...toolBtn, marginTop: 6 }}
          >
            🗑 Delete note
          </button>
        </>
      )}
    </div>
  );
}

/** Inline scene/text editing on the board (scene changes clear art — the
 * server enforces that; the UI states it). */
function BeatSceneEditor({
  project,
  beat,
  onProject,
}: {
  project: Project;
  beat: Project["storyboard"][number];
  onProject: (p: Project) => void;
}) {
  const [scene, setScene] = useState(beat.sceneDescription);
  const [text, setText] = useState(beat.text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = scene !== beat.sceneDescription || text !== beat.text;

  async function save() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${project.id}/beats/${beat.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sceneDescription: scene, text, castIds: beat.castIds, environmentId: beat.environmentId ?? "" }),
      });
      const d = await res.json();
      if (res.ok) onProject(d.project);
      else setError(d.fields ? Object.values(d.fields as Record<string, { message: string }>).map((f) => f.message).join(" ") : d.error ?? "save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label style={{ display: "block", marginBottom: 6 }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", opacity: 0.55 }}>scene (drives the art)</span>
        <textarea value={scene} onChange={(e) => setScene(e.target.value)} rows={3} style={{ ...inspectorInput, resize: "vertical" }} />
      </label>
      <label style={{ display: "block", marginBottom: 6 }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", opacity: 0.55 }}>page text</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} style={{ ...inspectorInput, resize: "vertical" }} />
      </label>
      {dirty && (
        <button onClick={save} disabled={busy} style={toolBtn}>
          {busy ? "Saving…" : scene !== beat.sceneDescription && beat.art ? "Save (scene changed — clears the art)" : "Save"}
        </button>
      )}
      {error && <div style={{ color: "var(--accent-deep)", fontSize: 11, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

/** Full generation on the board: generate / regenerate / point-to-fix with
 * live progress and choose-from-variants, without leaving the canvas. */
function BeatArtStudio({
  project,
  beat,
  onProject,
}: {
  project: Project;
  beat: Project["storyboard"][number];
  onProject: (p: Project) => void;
}) {
  const [progress, setProgress] = useState("");
  const [variants, setVariants] = useState<string[]>([]);
  const [fixText, setFixText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function runStream(path: string, body: unknown) {
    setBusy(true);
    setError("");
    setVariants([]);
    setProgress("starting…");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (!res.headers.get("content-type")?.includes("ndjson")) {
        const d = await res.json();
        setError(d.error ?? "failed");
        return;
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line) as { progress?: { phase: string; attempt: number }; done?: { variants: string[] }; error?: string };
          if (msg.progress) setProgress(`${msg.progress.phase} (attempt ${msg.progress.attempt})…`);
          if (msg.error) setError(msg.error);
          if (msg.done) setVariants(msg.done.variants ?? []);
        }
      }
    } finally {
      setProgress("");
      setBusy(false);
    }
  }

  async function lock(dataUrl: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/beats/${beat.id}/lock`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      const d = await res.json();
      if (res.ok) {
        onProject(d.project);
        setVariants([]);
      } else setError(d.error ?? "lock failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button onClick={() => runStream(`/api/projects/${project.id}/beats/${beat.id}/generate`, {})} disabled={busy} style={toolBtn}>
          {beat.art ? "♻ Regenerate" : "🎨 Generate art"}
        </button>
        {beat.art && (
          <>
            <input
              value={fixText}
              onChange={(e) => setFixText(e.target.value)}
              placeholder="point to fix: make the lantern glow"
              style={{ ...inspectorInput, width: 180, display: "inline-block", marginTop: 0 }}
            />
            <button
              onClick={() => runStream(`/api/projects/${project.id}/beats/${beat.id}/refine`, { instruction: fixText })}
              disabled={busy || fixText.trim().length === 0}
              style={toolBtn}
            >
              ✏️ Fix
            </button>
          </>
        )}
      </div>
      {progress && <div style={{ fontSize: 11.5, marginTop: 6, opacity: 0.7 }}>⏳ {progress}</div>}
      {error && <div style={{ color: "var(--accent-deep)", fontSize: 11, marginTop: 4 }}>{error}</div>}
      {variants.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.65, marginBottom: 4 }}>Pick one to lock:</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {variants.map((v, i) => (
              <img
                key={i}
                src={v}
                alt={`option ${i + 1}`}
                onClick={() => lock(v)}
                style={{ width: 92, height: 92, objectFit: "cover", borderRadius: 8, cursor: "pointer", border: "2px solid var(--line)" }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  position: "absolute",
  right: 12,
  top: 60,
  width: 340,
  maxHeight: "78vh",
  overflowY: "auto",
  background: "var(--surface)",
  borderRadius: 12,
  boxShadow: "var(--shadow-soft)",
  padding: "0.9rem",
  fontSize: "0.8rem",
};

const nsLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  opacity: 0.5,
};

const inspectorInput: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 2,
  padding: "0.4rem 0.5rem",
  borderRadius: 8,
  border: "1px solid var(--line)",
  background: "var(--surface)",
  fontFamily: "inherit",
  fontSize: "0.8rem",
};

const toolBtn: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 10,
  border: "1px solid var(--line)",
  background: "var(--surface)",
  fontWeight: 700,
  fontSize: 12.5,
  cursor: "pointer",
  boxShadow: "var(--shadow-soft)",
  color: "inherit",
};
