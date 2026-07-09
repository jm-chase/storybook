"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type { Project } from "@/lib/project/types";

// The infinite storyboard board: a Figma-style pan/zoom canvas where every
// page, cast member, and setting is a draggable card. Reading order is SPATIAL:
// page cards sorted left-to-right ARE the book order — dragging a page
// horizontally reorders the book (synced via /beats/order). Card positions
// persist on the project (board.positions). No canvas library — pointer events
// + CSS transforms.

interface Pos {
  x: number;
  y: number;
}

type CardKind = "page" | "cast" | "env";

interface CardDef {
  id: string;
  kind: CardKind;
  title: string;
  subtitle?: string;
  imageSrc?: string;
  w: number;
  h: number;
}

const PAGE_W = 200;
const PAGE_H = 268;
const CAST_W = 132;
const CAST_H = 176;
const ENV_W = 156;
const ENV_H = 150;

function defaultLayout(project: Project): Record<string, Pos> {
  const pos: Record<string, Pos> = {};
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
  const [pan, setPan] = useState<Pos>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [narrative, setNarrative] = useState<NarrativeReport | null>(null);
  const [narrativeBusy, setNarrativeBusy] = useState(false);
  const [note, setNote] = useState("");

  const viewportRef = useRef<HTMLDivElement>(null);
  const drag = useRef<
    | { mode: "pan"; startClient: Pos; startPan: Pos }
    | { mode: "card"; id: string; kind: CardKind; startClient: Pos; startPos: Pos }
    | null
  >(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.project) return;
        const p: Project = d.project;
        setProject(p);
        setPositions({ ...defaultLayout(p), ...(p.board?.positions ?? {}) });
      });
  }, [id]);

  const schedulePersist = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ board: { positions: positionsRef.current } }),
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
      };
    } else {
      drag.current = { mode: "pan", startClient: { x: e.clientX, y: e.clientY }, startPan: pan };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startClient.x;
    const dy = e.clientY - d.startClient.y;
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
    if (d?.mode === "card") {
      schedulePersist();
      if (d.kind === "page") void syncPageOrder();
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const next = Math.min(3, Math.max(0.2, zoom * Math.exp(-e.deltaY * 0.0012)));
    // Keep the point under the cursor fixed while zooming.
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
    ];
  }, [project, narrative]);

  // Reading-order thread through the page cards (Figma-ish flow line).
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
                  background: "var(--surface)",
                  borderRadius: 12,
                  boxShadow: "var(--shadow-soft)",
                  padding: 8,
                  cursor: "move",
                  userSelect: "none",
                  border: card.kind === "page" ? "1px solid var(--line)" : "1px dashed #00000020",
                }}
              >
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
        <span style={{ fontSize: 11.5, opacity: 0.65, background: "var(--surface)", padding: "5px 10px", borderRadius: 8 }}>
          drag cards · drag the canvas to pan · scroll to zoom · page order follows left-to-right
        </span>
        <button onClick={runNarrative} disabled={narrativeBusy} style={{ ...toolBtn, pointerEvents: "auto" }}>
          {narrativeBusy ? "📖 Reading the story…" : "📖 Narrative check"}
        </button>
        <button
          onClick={() => {
            setPan({ x: 0, y: 0 });
            setZoom(1);
          }}
          style={{ ...toolBtn, pointerEvents: "auto" }}
        >
          ⤾ Reset view ({Math.round(zoom * 100)}%)
        </button>
        {note && (
          <span style={{ fontSize: 12, fontWeight: 700, color: "#2a9d8f", background: "var(--surface)", padding: "5px 10px", borderRadius: 8 }}>
            {note}
          </span>
        )}
      </div>

      {/* narrative panel */}
      {narrative && (
        <div
          style={{
            position: "absolute",
            right: 12,
            top: 60,
            width: 340,
            maxHeight: "75vh",
            overflowY: "auto",
            background: "var(--surface)",
            borderRadius: 12,
            boxShadow: "var(--shadow-soft)",
            padding: "0.9rem",
            fontSize: "0.8rem",
          }}
        >
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
      )}
    </div>
  );
}

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
