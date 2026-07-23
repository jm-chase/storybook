export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
        Storybook <span style={{ opacity: 0.5 }}>(working name)</span>
      </h1>
      <p style={{ fontSize: "1.05rem", lineHeight: 1.6 }}>
        A parent-authored, AI-assisted personalized children&apos;s storybook
        generator. Tell it your idea and it writes the story, then guides you
        step by step through illustrating every page — cast, settings, and
        pages all staying on-model, behind real safety checks, ending in a
        print-ready PDF.
      </p>
      <p style={{ fontSize: "1.05rem", marginTop: "1.5rem" }}>
        <a
          href="/new"
          style={{
            display: "inline-block",
            padding: "0.6rem 1.1rem",
            background: "#c2724f",
            color: "#fff",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
            marginRight: "0.75rem",
          }}
        >
          Make a book →
        </a>
        <a href="/studio" style={{ fontSize: "0.9rem", color: "#c2724f", marginRight: "0.75rem" }}>
          (or the full studio)
        </a>
        <a href="/preview" style={{ fontSize: "0.9rem", color: "#c2724f" }}>
          (or the prose preview)
        </a>
      </p>

      <p style={{ fontSize: "0.9rem", opacity: 0.7, marginTop: "2rem" }}>
        Status, decisions, and next steps live in the tracking docs at the repo
        root (<code>PROJECT_STATUS.md</code>, <code>DECISIONS.md</code>,{" "}
        <code>ACCOUNTABILITY.md</code>).
      </p>
    </main>
  );
}
