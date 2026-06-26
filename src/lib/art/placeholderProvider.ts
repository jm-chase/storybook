import type { CharacterBrief, HouseStyle, ImageProvider, ImageRef } from "./types";

// A stand-in ImageProvider so the studio flow works end to end with no API key.
// It renders a simple SVG "character sheet" that varies by style palette + seed,
// so clicking "regenerate" visibly changes the result — enough to demonstrate
// the describe → generate → iterate → lock loop before a real model is wired.

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function wrap(text: string, max: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > max) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = (line + " " + w).trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function svgDataUrl(style: HouseStyle, brief: CharacterBrief, seed: number): string {
  const c = style.swatches;
  const body = c[seed % c.length];
  const accent = c[(seed + 2) % c.length];
  const tilt = ((seed % 5) - 2) * 4; // -8..8 deg, varies the "pose"
  const captionLines = wrap(esc(brief.description), 34);
  const caption = captionLines
    .map((l, i) => `<text x="200" y="${312 + i * 18}" text-anchor="middle" font-size="13" fill="#6b6b6b">${l}</text>`)
    .join("");

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'>
    <rect width='400' height='400' fill='#fffdf8'/>
    <rect x='10' y='10' width='380' height='380' rx='14' fill='none' stroke='#00000012' stroke-width='2'/>
    <g transform='translate(200,150) rotate(${tilt})'>
      <ellipse cx='0' cy='60' rx='62' ry='70' fill='${body}'/>
      <circle cx='0' cy='-20' r='48' fill='${body}'/>
      <circle cx='-18' cy='-26' r='8' fill='#fff'/><circle cx='-18' cy='-26' r='4' fill='#222'/>
      <circle cx='18' cy='-26' r='8' fill='#fff'/><circle cx='18' cy='-26' r='4' fill='#222'/>
      <path d='M-14 -2 q 14 12 28 0' stroke='#222' stroke-width='3' fill='none' stroke-linecap='round'/>
      <circle cx='0' cy='110' r='14' fill='${accent}'/>
    </g>
    <text x='200' y='40' text-anchor='middle' font-size='16' font-weight='700' fill='#2b2b2b'>${esc(brief.name)}</text>
    <text x='200' y='285' text-anchor='middle' font-size='12' fill='#9a8'>${esc(style.name)} · placeholder</text>
    ${caption}
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const placeholderProvider: ImageProvider = {
  id: "placeholder",
  async generateCharacterSheet(
    brief: CharacterBrief,
    style: HouseStyle,
    seed = 0
  ): Promise<ImageRef> {
    return {
      src: svgDataUrl(style, brief, seed),
      kind: "placeholder",
      prompt: `${style.promptFragment} — character: ${brief.description}`,
    };
  },
};
