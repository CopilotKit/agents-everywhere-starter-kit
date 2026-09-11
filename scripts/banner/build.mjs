/**
 * Generates assets/banner.svg and assets/banner.png.
 *
 * Type is converted to OUTLINES rather than left as <text>, for two reasons:
 * the brand fonts are not system-installed, and sharp's librsvg on macOS does
 * not read a scoped fontconfig — so a <text> banner silently renders in
 * Helvetica. Outlines also make the committed SVG self-contained: it renders
 * identically anywhere, with no font to install.
 *
 * Regenerating needs a Python venv with fonttools — see ./README.md. The
 * committed assets need nothing.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "../..");
const assets = join(root, "assets");
const fonts = join(assets, "fonts");
const PJS = join(fonts, "PlusJakartaSans.ttf");
const SSM = join(fonts, "SplineSansMono.ttf");

const PY = process.env.FONTTOOLS_PYTHON ?? "python3";

// ── verified CopilotKit palette ─────────────────────────────────────────────
const C = {
  ground: "#FAFAFC", // grey/25
  ink: "#010507", // grey/1000
  body: "#57575B", // grey/800
  faint: "#838389", // grey/700
  line: "#E2E2EA", // grey/400
  white: "#FFFFFF", // grey/0
  lilac: "#BEC2FF",
  mint: "#85ECCE",
  primary: "#EEE6FE",
};

// Sponsor hierarchy follows the event: OpenAI, then CopilotKit/OpenRouter,
// then the featured developer partners. Use official marks at each tier.
const spec = {
  eyebrow: { font: SSM, wght: 500, text: "GLOBAL HACKATHON · 12 SEPTEMBER 2026", size: 14, tracking: 2.2 },
  hero: { font: PJS, wght: 800, text: "Agents,", size: 92, tracking: -1.5 },
  hero2: { font: PJS, wght: 800, text: "everywhere", size: 92, tracking: -1.5 },
  sub: { font: PJS, wght: 400, text: "Build an agent that belongs where", size: 25 },
  sub2: { font: PJS, wght: 400, text: "people already work, talk, and live.", size: 25 },
  foot: { font: SSM, wght: 500, text: "TEMPLATES · AGENT GUIDES · RESOURCES", size: 12, tracking: 1.4 },
  marquee: { font: SSM, wght: 500, text: "PRESENTED WITH", size: 12, tracking: 2 },
  sponsors: { font: SSM, wght: 500, text: "SPONSORS", size: 12, tracking: 2 },
  partners: { font: SSM, wght: 500, text: "DEVELOPER PARTNERS", size: 12, tracking: 2 },
};

// The brand fonts are fetched on demand rather than vendored, so the repo
// carries no font binaries or licences it does not need.
const FONT_SOURCES = [
  [PJS, "https://raw.githubusercontent.com/google/fonts/main/ofl/plusjakartasans/PlusJakartaSans%5Bwght%5D.ttf"],
  [SSM, "https://raw.githubusercontent.com/google/fonts/main/ofl/splinesansmono/SplineSansMono%5Bwght%5D.ttf"],
];
mkdirSync(fonts, { recursive: true });
for (const [dest, url] of FONT_SOURCES) {
  if (existsSync(dest)) continue;
  console.log(`fetching ${dest.split("/").pop()}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not fetch ${url}: ${response.status}`);
  writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
}

const runs = JSON.parse(
  execFileSync(PY, [join(import.meta.dirname, "textpath.py")], {
    input: JSON.stringify(spec),
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  }),
);

/** A run placed at (x, baseline). */
const place = (key, x, y, fill) =>
  `  <path transform="translate(${x} ${y})" d="${runs[key].d}" fill="${fill}"/>`;

// Embed official SVGs so the final asset has no external dependencies.
const mark = (slug, name, x, centerY, width) => {
  const path = slug === "copilotkit"
    ? join(assets, "copilotkit-logo-full.svg")
    : join(assets, "sponsors", `${slug}.svg`);
  const raw = readFileSync(path, "utf8").replaceAll("currentColor", C.ink);
  const [, , vbWidth, vbHeight] = raw.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  const height = width * vbHeight / vbWidth;
  const href = `data:image/svg+xml;base64,${Buffer.from(raw).toString("base64")}`;
  return `  <image x="${x}" y="${(centerY - height / 2).toFixed(2)}" width="${width}" height="${height.toFixed(2)}" xlink:href="${href}"><title>${name}</title></image>`;
};
const centered = (key, y) => place(key, 1228 - runs[key].width / 2, y, C.body);
const sponsorMarks = [
  mark("openai", "OpenAI — marquee sponsor", 1093, 196, 270),
  mark("copilotkit", "CopilotKit — sponsor", 994, 334, 202),
  mark("openrouter", "OpenRouter — sponsor", 1242, 334, 220),
  mark("exa", "Exa — developer partner", 997, 464, 83),
  mark("auth0", "Auth0 — developer partner", 1130, 464, 102),
  mark("ambiguous", "Ambiguous AI — developer partner", 1282, 464, 177),
];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1600" height="600" viewBox="0 0 1600 600" fill="none">
  <title>Agents, everywhere — hackathon starter kit</title>
  <desc>Build an agent that belongs where people already work, talk, and live. OpenAI is the marquee sponsor. CopilotKit and OpenRouter share the second tier. Exa, Auth0, and Ambiguous AI form the third tier.</desc>
  <defs>
${[["Lilac", C.lilac, 0.55], ["Mint", C.mint, 0.4], ["Primary", C.primary, 0.85]]
  .map(([id, color, op]) => `    <radialGradient id="glow${id}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${color}" stop-opacity="${op}"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </radialGradient>`).join("\n")}
  </defs>
  <rect width="1600" height="600" fill="${C.ground}"/>
  <circle cx="1390" cy="90" r="360" fill="url(#glowLilac)"/>
  <circle cx="1510" cy="570" r="290" fill="url(#glowMint)"/>
  <circle cx="1110" cy="370" r="310" fill="url(#glowPrimary)"/>
  <circle cx="100" cy="610" r="260" fill="url(#glowLilac)" opacity="0.5"/>
  <path d="M900 96V510" stroke="${C.line}"/>
${place("eyebrow", 96, 113, C.body)}
${place("hero", 90, 238, C.ink)}
${place("hero2", 90, 336, C.ink)}
${place("sub", 96, 406, C.body)}
${place("sub2", 96, 443, C.body)}
${place("foot", 96, 526, C.body)}
${centered("marquee", 122)}
${centered("sponsors", 282)}
${centered("partners", 418)}
${sponsorMarks.join("\n")}
</svg>
`;

writeFileSync(join(assets, "banner.svg"), svg);
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(join(assets, "banner.png"));
const meta = await sharp(join(assets, "banner.png")).metadata();
console.log(`banner.svg ${(svg.length / 1024).toFixed(0)}kB (self-contained, outlines)`);
console.log(`banner.png ${meta.width}x${meta.height}`);
