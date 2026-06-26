"use client";

import { useMemo, useState } from "react";
import { theBigNewThing } from "@/content/skeletons/theBigNewThing";
import { CATALOG } from "@/content/motifs";
import { renderStory, type StorySelection } from "@/lib/skeleton/render";
import { validateInputs, type InputField } from "@/lib/validation";
import { SceneArt } from "@/components/SceneArt";

// Browser book-preview of a skeleton. Deterministic render (no API key). Change
// motifs + personalization and see the booklet re-render live. Art is PLACEHOLDER
// (see SceneArt / B-2). This is the parent-preview surface from the pipeline,
// minus the eventual Claude personalization + output-moderation passes.

const skeleton = theBigNewThing;

const serif =
  'Georgia, "Iowan Old Style", "Palatino Linotype", Palatino, serif';

function Field({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <label style={{ display: "block", marginBottom: "0.75rem" }}>
      <span style={{ display: "block", fontSize: "0.8rem", marginBottom: 2 }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "0.4rem 0.5rem",
          borderRadius: 6,
          border: `1px solid ${error ? "#c2724f" : "#00000022"}`,
          background: "#fff",
        }}
      />
      {error && (
        <span style={{ color: "#a8442a", fontSize: "0.75rem" }}>{error}</span>
      )}
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: "block", marginBottom: "0.75rem" }}>
      <span style={{ display: "block", fontSize: "0.8rem", marginBottom: 2 }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "0.4rem 0.5rem",
          borderRadius: 6,
          border: "1px solid #00000022",
          background: "#fff",
        }}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function PreviewPage() {
  const [heroName, setHeroName] = useState("Mia");
  const [sidekickName, setSidekickName] = useState("Pip");
  const [detail, setDetail] = useState("a red scarf");
  const [emotionId, setEmotionId] = useState("nervous");
  const [feelingId, setFeelingId] = useState("brave");
  const [environmentId, setEnvironmentId] = useState("big-school");
  const [lessonId, setLessonId] = useState("small-steps");
  const [sidekickId, setSidekickId] = useState("little-fox");

  // Run the real validation layer on the personalization inputs (also previews input safety).
  const validation = useMemo(() => {
    const fields: InputField[] = [
      { name: "heroName", kind: "name", required: true, raw: heroName },
      { name: "sidekickName", kind: "name", required: true, raw: sidekickName },
      { name: "detail", kind: "shortDetail", required: true, raw: detail },
    ];
    return validateInputs(fields);
  }, [heroName, sidekickName, detail]);

  const sceneTag = CATALOG.environments[environmentId].sceneTag;

  const render = useMemo(() => {
    if (!validation.ok) return null;
    const selection: StorySelection = {
      emotionId,
      feelingId,
      environmentId,
      lessonId,
      sidekickId,
      personalization: validation.values,
    };
    return renderStory(skeleton, CATALOG, selection);
  }, [validation, emotionId, feelingId, environmentId, lessonId, sidekickId]);

  const opt = {
    emotions: skeleton.motifs.emotions.map((id) => ({ id, label: CATALOG.emotions[id].word })),
    feelings: skeleton.motifs.feelings.map((id) => ({ id, label: CATALOG.feelings[id].word })),
    environments: skeleton.motifs.environments.map((id) => ({ id, label: CATALOG.environments[id].label })),
    lessons: skeleton.motifs.lessons.map((id) => ({ id, label: CATALOG.lessons[id].label })),
    sidekicks: skeleton.motifs.sidekicks.map((id) => ({ id, label: CATALOG.sidekicks[id].label })),
  };

  return (
    <main style={{ display: "flex", gap: "2rem", padding: "2rem", flexWrap: "wrap" }}>
      {/* Controls */}
      <aside style={{ width: 260, flexShrink: 0 }}>
        <h2 style={{ fontSize: "1.1rem" }}>Make a story</h2>
        <p style={{ fontSize: "0.75rem", opacity: 0.7, marginTop: 0 }}>
          Skeleton: <em>{skeleton.theme}</em> (ages {skeleton.ageBand})
        </p>

        <Field label="Child's name" value={heroName} onChange={setHeroName} error={validation.errors.heroName?.message} />
        <Field label="Sidekick's name" value={sidekickName} onChange={setSidekickName} error={validation.errors.sidekickName?.message} />
        <Field label="A special thing they bring" value={detail} onChange={setDetail} error={validation.errors.detail?.message} />

        <Select label="Sidekick" value={sidekickId} options={opt.sidekicks} onChange={setSidekickId} />
        <Select label="Feeling at the start (emotion)" value={emotionId} options={opt.emotions} onChange={setEmotionId} />
        <Select label="Where it happens (environment)" value={environmentId} options={opt.environments} onChange={setEnvironmentId} />
        <Select label="The gentle lesson" value={lessonId} options={opt.lessons} onChange={setLessonId} />
        <Select label="Feeling at the end" value={feelingId} options={opt.feelings} onChange={setFeelingId} />

        <p style={{ fontSize: "0.7rem", opacity: 0.6, marginTop: "1rem", lineHeight: 1.4 }}>
          Artwork is <strong>placeholder</strong> flat-vector, standing in until the real
          illustration library exists. Layout, text, and motif steering are real.
        </p>
      </aside>

      {/* Book */}
      <section style={{ flex: 1, minWidth: 320, maxWidth: 640 }}>
        {!render || !render.ok ? (
          <div style={{ padding: "2rem", background: "#fff5f0", borderRadius: 12 }}>
            Fix the highlighted fields to see the story.
          </div>
        ) : (
          <>
            {/* Title page */}
            <BookPage sceneTag={sceneTag} pageLabel="Title">
              <h1 style={{ fontFamily: serif, fontSize: "1.8rem", textAlign: "center", margin: 0 }}>
                {render.story.title}
              </h1>
            </BookPage>

            {render.story.pages.map((text, i) => (
              <BookPage key={i} sceneTag={sceneTag} pageLabel={`Page ${i + 1}`}>
                <p style={{ fontFamily: serif, fontSize: "1.15rem", lineHeight: 1.6, margin: 0 }}>
                  {text}
                </p>
              </BookPage>
            ))}
          </>
        )}
      </section>
    </main>
  );
}

function BookPage({
  sceneTag,
  pageLabel,
  children,
}: {
  sceneTag: string;
  pageLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#fffdf8",
        borderRadius: 12,
        boxShadow: "0 6px 20px #0000001a",
        overflow: "hidden",
        marginBottom: "1.5rem",
      }}
    >
      <SceneArt sceneTag={sceneTag} />
      <div style={{ padding: "1.25rem 1.5rem 1.75rem", position: "relative" }}>
        {children}
        <span style={{ position: "absolute", bottom: 6, right: 12, fontSize: "0.7rem", opacity: 0.4 }}>
          {pageLabel}
        </span>
      </div>
    </div>
  );
}
