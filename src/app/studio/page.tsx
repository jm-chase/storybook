"use client";

import { useState } from "react";
import { HOUSE_STYLES, HOUSE_STYLE_BY_ID } from "@/content/houseStyles";
import { buildCharacterBrief, MAX_DESCRIPTION } from "@/lib/art/brief";
import { placeholderProvider } from "@/lib/art/placeholderProvider";
import type { ImageRef } from "@/lib/art/types";

// The studio shell: describe a character (freeform, art-only), pick a house
// style, then generate → iterate → lock. Art is PLACEHOLDER (no model wired);
// the ImageProvider seam means a real model drops in with no UI change.

const card = (active: boolean): React.CSSProperties => ({
  border: `2px solid ${active ? "#c2724f" : "#00000018"}`,
  borderRadius: 10,
  padding: "0.6rem",
  cursor: "pointer",
  background: "#fff",
});

export default function StudioPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [styleId, setStyleId] = useState(HOUSE_STYLES[0].id);
  const [seed, setSeed] = useState(0);
  const [sheet, setSheet] = useState<ImageRef | null>(null);
  const [locked, setLocked] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const styleIds = HOUSE_STYLES.map((s) => s.id);

  async function generate(nextSeed: number) {
    const result = buildCharacterBrief({ name, description, styleId }, styleIds);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    const style = HOUSE_STYLE_BY_ID[styleId];
    const ref = await placeholderProvider.generateCharacterSheet(result.brief, style, nextSeed);
    setSheet(ref);
    setLocked(false);
    setSeed(nextSeed);
    setBusy(false);
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1 style={{ fontSize: "1.6rem" }}>Character studio</h1>
      <p style={{ fontSize: "0.85rem", opacity: 0.7, marginTop: 0 }}>
        Step 1 of the book: create your main character. Describe them however you like, pick a look,
        then iterate until it&apos;s right and lock it.
      </p>

      <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", marginTop: "1rem" }}>
        {/* Inputs */}
        <section style={{ flex: 1, minWidth: 300 }}>
          <label style={{ display: "block", marginBottom: "1rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Hero&apos;s name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mia"
              style={inputStyle(!!errors.name)}
            />
            {errors.name && <Err>{errors.name}</Err>}
          </label>

          <label style={{ display: "block", marginBottom: "0.25rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Describe your character</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. a blond-haired, spunky, brown-eyed 4-year-old boy — or a baby African elephant"
              rows={3}
              maxLength={MAX_DESCRIPTION + 20}
              style={{ ...inputStyle(!!errors.description), resize: "vertical" }}
            />
            <span style={{ fontSize: "0.7rem", opacity: 0.55 }}>
              {description.length}/{MAX_DESCRIPTION} · used for artwork only — never the story&apos;s plot
            </span>
            {errors.description && <Err>{errors.description}</Err>}
          </label>

          <p style={{ fontSize: "0.85rem", fontWeight: 600, margin: "1rem 0 0.5rem" }}>Art style</p>
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

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
            <button onClick={() => generate(0)} disabled={busy} style={btn(true)}>
              {sheet ? "Generate again" : "Generate character"}
            </button>
            {sheet && (
              <button onClick={() => generate(seed + 1)} disabled={busy} style={btn(false)}>
                Iterate ↻
              </button>
            )}
            {sheet && !locked && (
              <button onClick={() => setLocked(true)} disabled={busy} style={btn(false)}>
                Lock character 🔒
              </button>
            )}
          </div>
        </section>

        {/* Result */}
        <section style={{ flex: 1, minWidth: 280 }}>
          <div
            style={{
              border: `2px solid ${locked ? "#2a9d8f" : "#00000018"}`,
              borderRadius: 12,
              padding: "0.75rem",
              background: "#fffdf8",
              minHeight: 280,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {sheet ? (
              <img src={sheet.src} alt="character placeholder" style={{ width: "100%", maxWidth: 360 }} />
            ) : (
              <span style={{ opacity: 0.5, fontSize: "0.85rem", textAlign: "center" }}>
                Your character will appear here.
              </span>
            )}
          </div>
          {locked && (
            <p style={{ color: "#2a9d8f", fontSize: "0.8rem", fontWeight: 600 }}>
              🔒 Locked — this exact character will stay consistent across every page.
            </p>
          )}
        </section>
      </div>

      {/* What's next (stubs) */}
      <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid #00000012", opacity: 0.6 }}>
        <p style={{ fontSize: "0.85rem", fontWeight: 600 }}>Coming next in the studio:</p>
        <p style={{ fontSize: "0.8rem", margin: 0 }}>
          Build &amp; lock the <strong>environment</strong> → shape the <strong>emotional arc + pacing</strong>{" "}
          → lay out the <strong>storyboard</strong> → preview the book → export the printable booklet.
        </p>
      </div>

      <p style={{ fontSize: "0.72rem", opacity: 0.55, marginTop: "1.5rem", lineHeight: 1.5 }}>
        Artwork here is a <strong>placeholder</strong> — no image model is wired yet (pending the B-2 stack pick).
        The describe → generate → iterate → lock flow, the firewall (description drives art only), and the house-style
        system are real. Content moderation of the description runs at generate time once a model + key are connected.
      </p>
    </main>
  );
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

function Err({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "#a8442a", fontSize: "0.75rem" }}>{children}</span>;
}
