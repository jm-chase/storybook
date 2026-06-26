"use client";

import { useState } from "react";
import { HOUSE_STYLES } from "@/content/houseStyles";
import { buildCharacterBrief, MAX_DESCRIPTION } from "@/lib/art/brief";

// The studio character step (Slice 2): describe a character, pick a house style,
// generate via the server (real Gemini, behind the Output Gate), then CHOOSE FROM
// 3 clean variants and lock one. Generation + safety/quality/consistency run
// server-side (/api/generate-character) — the key never reaches the browser.

const styleCard = (active: boolean): React.CSSProperties => ({
  border: `2px solid ${active ? "#c2724f" : "#00000018"}`,
  borderRadius: 10,
  padding: "0.6rem",
  cursor: "pointer",
  background: "#fff",
});

interface GenResponse {
  variants?: string[];
  attempts?: number;
  costUsd?: number;
  satisfied?: boolean;
  error?: string;
  fields?: Record<string, { message: string }>;
}

export default function StudioPage() {
  const [name, setName] = useState("Mia");
  const [description, setDescription] = useState(
    "a blond-haired, spunky, brown-eyed 4-year-old girl in a red raincoat"
  );
  const [styleId, setStyleId] = useState(HOUSE_STYLES[0].id);

  const [variants, setVariants] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<string>("");

  const styleIds = HOUSE_STYLES.map((s) => s.id);

  async function generate() {
    // Client-side pre-validation for instant feedback (server re-validates).
    const built = buildCharacterBrief({ name, description, styleId }, styleIds);
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    setMeta("");
    try {
      const res = await fetch("/api/generate-character", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, description, styleId }),
      });
      const data: GenResponse = await res.json();
      if (!res.ok) {
        if (data.fields) {
          setErrors(Object.fromEntries(Object.entries(data.fields).map(([k, v]) => [k, v.message])));
        } else {
          setMeta(`⚠️ ${data.error ?? "Generation failed."}`);
        }
        return;
      }
      setVariants(data.variants ?? []);
      setSelected(0);
      setLocked(false);
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

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1 style={{ fontSize: "1.6rem" }}>Character studio</h1>
      <p style={{ fontSize: "0.85rem", opacity: 0.7, marginTop: 0 }}>
        Describe your character, pick a look, then choose your favourite of 3 and lock it.
      </p>

      <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", marginTop: "1rem" }}>
        {/* Inputs */}
        <section style={{ flex: 1, minWidth: 300 }}>
          <label style={{ display: "block", marginBottom: "1rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Hero&apos;s name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle(!!errors.name)} />
            {errors.name && <Err>{errors.name}</Err>}
          </label>

          <label style={{ display: "block", marginBottom: "0.25rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Describe your character</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={MAX_DESCRIPTION + 20}
              style={{ ...inputStyle(!!errors.description), resize: "vertical" }}
            />
            <span style={{ fontSize: "0.7rem", opacity: 0.55 }}>
              {description.length}/{MAX_DESCRIPTION} · drives artwork only — never the story&apos;s plot
            </span>
            {errors.description && <Err>{errors.description}</Err>}
          </label>

          <p style={{ fontSize: "0.85rem", fontWeight: 600, margin: "1rem 0 0.5rem" }}>Art style</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            {HOUSE_STYLES.map((s) => (
              <div key={s.id} style={styleCard(s.id === styleId)} onClick={() => setStyleId(s.id)}>
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
            <button onClick={generate} disabled={busy} style={btn(true)}>
              {busy ? "Generating 3 options…" : variants.length ? "Generate again" : "Generate character"}
            </button>
            {variants.length > 0 && !locked && (
              <button onClick={() => setLocked(true)} disabled={busy} style={btn(false)}>
                Lock this one 🔒
              </button>
            )}
          </div>
          {meta && <p style={{ fontSize: "0.75rem", opacity: 0.7, marginTop: 8 }}>{meta}</p>}
        </section>

        {/* Result: choose from 3 */}
        <section style={{ flex: 1, minWidth: 300 }}>
          {busy && variants.length === 0 ? (
            <Placeholder>Generating 3 clean options… this can take ~30s.</Placeholder>
          ) : variants.length === 0 ? (
            <Placeholder>Your 3 options will appear here. Pick your favourite, then lock.</Placeholder>
          ) : (
            <>
              {/* big selected preview */}
              <div
                style={{
                  border: `3px solid ${locked ? "#2a9d8f" : "#00000018"}`,
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "#fffdf8",
                  marginBottom: 8,
                }}
              >
                <img src={variants[selected]} alt="character option" style={{ width: "100%", display: "block" }} />
              </div>
              {/* thumbnails to choose */}
              <div style={{ display: "flex", gap: 8 }}>
                {variants.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`option ${i + 1}`}
                    onClick={() => !locked && setSelected(i)}
                    style={{
                      width: 90,
                      height: 90,
                      objectFit: "cover",
                      borderRadius: 8,
                      cursor: locked ? "default" : "pointer",
                      border: `3px solid ${selected === i ? "#c2724f" : "transparent"}`,
                      opacity: locked && selected !== i ? 0.4 : 1,
                    }}
                  />
                ))}
              </div>
              {locked && (
                <p style={{ color: "#2a9d8f", fontSize: "0.8rem", fontWeight: 600 }}>
                  🔒 Locked — this exact character stays consistent across every page.
                </p>
              )}
            </>
          )}
        </section>
      </div>

      <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid #00000012", opacity: 0.6 }}>
        <p style={{ fontSize: "0.85rem", fontWeight: 600 }}>Coming next:</p>
        <p style={{ fontSize: "0.8rem", margin: 0 }}>
          Point-to-fix any detail · build &amp; lock the <strong>environment</strong> · shape the{" "}
          <strong>emotional arc + pacing</strong> · lay out the <strong>storyboard</strong> · export the booklet.
        </p>
      </div>

      <p style={{ fontSize: "0.72rem", opacity: 0.55, marginTop: "1.5rem", lineHeight: 1.5 }}>
        Real artwork via Gemini, generated server-side behind the Output Gate (safety stub + quality + consistency,
        with auto-reroll). Each &quot;Generate&quot; produces a few images — see the cost line above.
      </p>
    </main>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "2px dashed #00000022",
        borderRadius: 12,
        minHeight: 280,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "1rem",
        opacity: 0.6,
        fontSize: "0.85rem",
      }}
    >
      {children}
    </div>
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
