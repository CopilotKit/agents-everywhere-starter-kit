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

const SURFACES = ["SLACK", "TEAMS", "WEB", "VOICE", "CHATGPT", "MOBILE"];

const spec = {
  eyebrow: { font: SSM, wght: 500, text: "GLOBAL HACKATHON · 12 SEPTEMBER 2026", size: 15, tracking: 2.6 },
  hero: { font: PJS, wght: 800, text: "Agents, everywhere", size: 76, tracking: -1.2 },
  sub: { font: PJS, wght: 400, text: "Build an agent that belongs where people already work.", size: 22 },
  foot: { font: PJS, wght: 500, text: "Starter kit · one agent, every surface", size: 13, tracking: 0.1 },
  ...Object.fromEntries(
    SURFACES.map((label) => [`pill_${label}`, { font: SSM, wght: 500, text: label, size: 14, tracking: 1.4 }]),
  ),
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

// ── pills, sized from their own measured label widths ───────────────────────
const PILL_PAD = 22;
const PILL_H = 38;
const PILL_GAP = 12;
const PILL_Y = 340;
let pillX = 96;
const pills = SURFACES.flatMap((label) => {
  const w = runs[`pill_${label}`].width;
  const boxW = Math.round(w + PILL_PAD * 2);
  const parts = [
    `  <rect x="${pillX}" y="${PILL_Y}" width="${boxW}" height="${PILL_H}" rx="${PILL_H / 2}" fill="${C.white}" stroke="${C.line}"/>`,
    place(`pill_${label}`, pillX + PILL_PAD, PILL_Y + 24, "#2B2B2B"),
  ];
  pillX += boxW + PILL_GAP;
  return parts;
});

// ── the packaged logotype, never redrawn ───────────────────────────────────
const logo = readFileSync(join(assets, "copilotkit-logo-full.svg"), "utf8");
const logoB64 = Buffer.from(logo).toString("base64");
const LOGO_W = 264;
const LOGO_H = +(LOGO_W * (200 / 1044.21)).toFixed(2);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1600" height="500" viewBox="0 0 1600 500" fill="none">
  <title>Agents, everywhere — starter kit</title>
  <defs>
${[["Lilac", C.lilac, 0.55], ["Mint", C.mint, 0.4], ["Primary", C.primary, 0.85]]
  .map(
    ([id, color, op]) => `    <radialGradient id="glow${id}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${color}" stop-opacity="${op}"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </radialGradient>`,
  )
  .join("\n")}
  </defs>

  <rect width="1600" height="500" fill="${C.ground}"/>

  <!-- ambient glow: soft, diffuse, and strictly behind the content -->
  <circle cx="1330" cy="120" r="330" fill="url(#glowLilac)"/>
  <circle cx="1520" cy="430" r="270" fill="url(#glowMint)"/>
  <circle cx="1120" cy="380" r="300" fill="url(#glowPrimary)"/>
  <circle cx="120" cy="470" r="240" fill="url(#glowLilac)" opacity="0.5"/>

${place("eyebrow", 96, 132, C.body)}
${place("hero", 94, 228, C.ink)}
${place("sub", 96, 286, C.body)}

${pills.join("\n")}

${place("foot", 96, 438, C.faint)}

  <!-- clearspace >= 1/2 the logotype height on every side -->
  <image x="1240" y="${(500 - LOGO_H - 58).toFixed(2)}" width="${LOGO_W}" height="${LOGO_H}"
         xlink:href="data:image/svg+xml;base64,${logoB64}"/>
</svg>
`;

writeFileSync(join(assets, "banner.svg"), svg);
// 1600px wide is ~2x the width GitHub renders a README at, which is crisp on
// retina without shipping a multi-megabyte PNG.
await sharp(Buffer.from(svg), { density: 96 })
  // No palette quantization: it dithers the ambient gradient into visible speckle.
  .png({ compressionLevel: 9 })
  .toFile(join(assets, "banner.png"));

const meta = await sharp(join(assets, "banner.png")).metadata();
console.log(`banner.svg  ${(svg.length / 1024).toFixed(0)}kB (self-contained, outlines)`);
console.log(`banner.png  ${meta.width}x${meta.height}`);
console.log(`hero run width ${runs.hero.width.toFixed(0)}px · pills end at ${pillX - PILL_GAP}px`);
