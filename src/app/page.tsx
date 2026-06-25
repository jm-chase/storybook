export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
        Storybook <span style={{ opacity: 0.5 }}>(working name)</span>
      </h1>
      <p style={{ fontSize: "1.05rem", lineHeight: 1.6 }}>
        A parent-authored, AI-assisted personalized children&apos;s storybook
        generator. The wizard, generation pipeline, safety checks, and
        print-ready PDF export are being built. This page is the scaffold
        placeholder.
      </p>
      <p style={{ fontSize: "0.9rem", opacity: 0.7, marginTop: "2rem" }}>
        Status, decisions, and next steps live in the tracking docs at the repo
        root (<code>PROJECT_STATUS.md</code>, <code>DECISIONS.md</code>,{" "}
        <code>ACCOUNTABILITY.md</code>).
      </p>
    </main>
  );
}
