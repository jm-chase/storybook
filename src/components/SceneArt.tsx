// PLACEHOLDER flat-vector scene art. Stands in for the real per-skeleton
// illustration library (blocked on B-2: image-gen vendor + IP/licensing). These
// are simple inline SVGs in a limited palette — enough to preview booklet LAYOUT
// and the flat-vector direction (D-005), not final art. The real library will
// map one scene per beat; here we render one scene per environment.

const PALETTE = {
  sky: "#cfe3ec",
  skyNight: "#2b3a55",
  ground: "#e8dcc0",
  grass: "#bcd29a",
  sun: "#f2c14e",
  moon: "#f4f1ea",
  trunk: "#9c7a52",
  leaf: "#86a96b",
  roof: "#c2724f",
  wall: "#efe7d6",
  sea: "#8fb8c9",
  snow: "#f4f6f8",
  star: "#f5e6a8",
  heroBody: "#5b7aa3",
  heroHead: "#e9c39b",
  pal: "#c98a5e", // sidekick
};

/** Shared hero + sidekick pair, placed bottom-centre for character continuity. */
function Pair() {
  return (
    <g transform="translate(170,210)">
      {/* sidekick */}
      <ellipse cx="46" cy="42" rx="16" ry="13" fill={PALETTE.pal} />
      <circle cx="46" cy="26" r="10" fill={PALETTE.pal} />
      <path d="M40 17 l-4 -8 l7 4 z" fill={PALETTE.pal} />
      <path d="M52 17 l4 -8 l-7 4 z" fill={PALETTE.pal} />
      {/* hero */}
      <rect x="0" y="20" width="26" height="34" rx="11" fill={PALETTE.heroBody} />
      <circle cx="13" cy="14" r="12" fill={PALETTE.heroHead} />
    </g>
  );
}

function Frame({ children, bg }: { children: React.ReactNode; bg: string }) {
  return (
    <svg viewBox="0 0 400 280" width="100%" role="img" aria-label="placeholder illustration">
      <rect x="0" y="0" width="400" height="280" fill={bg} />
      {children}
      <rect
        x="2"
        y="2"
        width="396"
        height="276"
        fill="none"
        stroke="#00000010"
        strokeWidth="2"
        rx="6"
      />
    </svg>
  );
}

const SCENES: Record<string, React.ReactNode> = {
  school: (
    <Frame bg={PALETTE.sky}>
      <rect x="0" y="200" width="400" height="80" fill={PALETTE.ground} />
      <circle cx="340" cy="56" r="26" fill={PALETTE.sun} />
      <rect x="60" y="90" width="200" height="120" fill={PALETTE.wall} />
      <polygon points="50,90 270,90 160,40" fill={PALETTE.roof} />
      <rect x="140" y="150" width="40" height="60" fill="#7fa0c0" />
      <rect x="80" y="120" width="28" height="28" fill={PALETTE.sky} />
      <rect x="212" y="120" width="28" height="28" fill={PALETTE.sky} />
      <Pair />
    </Frame>
  ),
  wood: (
    <Frame bg={PALETTE.sky}>
      <rect x="0" y="200" width="400" height="80" fill={PALETTE.grass} />
      {[40, 110, 300, 360].map((x, i) => (
        <g key={i}>
          <rect x={x} y={120} width="16" height="90" fill={PALETTE.trunk} />
          <circle cx={x + 8} cy={120} r="34" fill={PALETTE.leaf} />
        </g>
      ))}
      <Pair />
    </Frame>
  ),
  seaside: (
    <Frame bg={PALETTE.sky}>
      <rect x="0" y="150" width="400" height="70" fill={PALETTE.sea} />
      <rect x="0" y="210" width="400" height="70" fill={PALETTE.ground} />
      <circle cx="60" cy="56" r="24" fill={PALETTE.sun} />
      <path d="M0 175 q 50 -14 100 0 t 100 0 t 100 0 t 100 0" fill="none" stroke="#ffffff70" strokeWidth="3" />
      <Pair />
    </Frame>
  ),
  snow: (
    <Frame bg={PALETTE.sky}>
      <path d="M0 220 q 120 -70 220 -10 t 180 10 v 60 H0 Z" fill={PALETTE.snow} />
      {[40, 90, 150, 260, 330].map((x, i) => (
        <circle key={i} cx={x} cy={50 + (i % 3) * 18} r="4" fill="#ffffff" />
      ))}
      <Pair />
    </Frame>
  ),
  house: (
    <Frame bg={PALETTE.sky}>
      <rect x="0" y="200" width="400" height="80" fill={PALETTE.grass} />
      <rect x="90" y="100" width="220" height="110" fill={PALETTE.wall} />
      <polygon points="80,100 320,100 200,46" fill={PALETTE.roof} />
      <rect x="180" y="150" width="40" height="60" fill={PALETTE.trunk} />
      <rect x="110" y="125" width="34" height="30" fill={PALETTE.sky} />
      <rect x="256" y="125" width="34" height="30" fill={PALETTE.sky} />
      <Pair />
    </Frame>
  ),
  "night-garden": (
    <Frame bg={PALETTE.skyNight}>
      <rect x="0" y="210" width="400" height="70" fill="#3b4a3a" />
      <circle cx="330" cy="56" r="22" fill={PALETTE.moon} />
      {[30, 70, 120, 180, 240, 300, 360].map((x, i) => (
        <circle key={i} cx={x} cy={30 + (i % 4) * 22} r="2.5" fill={PALETTE.star} />
      ))}
      {[60, 130, 280, 350].map((x, i) => (
        <path key={i} d={`M${x} 210 q 6 -40 0 -60`} stroke="#5d7a52" strokeWidth="5" fill="none" />
      ))}
      <Pair />
    </Frame>
  ),
};

export function SceneArt({ sceneTag }: { sceneTag: string }) {
  return <>{SCENES[sceneTag] ?? <Frame bg={PALETTE.sky}><Pair /></Frame>}</>;
}
