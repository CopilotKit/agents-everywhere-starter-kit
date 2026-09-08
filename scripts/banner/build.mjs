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

/**
 * The sponsor lineup, in the event's own order: global sponsors first, then the
 * developer-infrastructure partners. Every mark in assets/sponsors/ is the
 * brand's own official lockup, flattened to one colour by monochrome.py —
 * shapes untouched, paint only.
 *
 * `scale` is an OPTICAL correction, not a whim. Normalising every lockup to the
 * same box height makes them look wrong, because they carry different amounts
 * of internal padding: Mozilla.ai's wordmark fills its viewBox edge to edge
 * while Auth0's sits small inside a tall box. These multipliers were tuned by
 * eye against a contact sheet so the row reads as one weight.
 *
 * CopilotKit is a global sponsor too, but sits bottom-right as the kit's
 * publisher rather than appearing twice.
 */
const SPONSORS = [
  { slug: "openai", name: "OpenAI", scale: 1.0 },
  { slug: "openrouter", name: "OpenRouter", scale: 1.18 },
  { slug: "exa", name: "Exa", scale: 1.06 },
  { slug: "trigger", name: "Trigger.dev", scale: 1.05 },
  { slug: "auth0", name: "Auth0", scale: 1.3 },
  { slug: "mozilla", name: "Mozilla.ai", scale: 0.72 },
  { slug: "ambiguous", name: "Ambiguous AI", scale: 0.95 },
];

const MARK_H = 23; // base optical height, before each mark's scale

const spec = {
  eyebrow: { font: SSM, wght: 500, text: "GLOBAL HACKATHON · 12 SEPTEMBER 2026", size: 15, tracking: 2.6 },
  hero: { font: PJS, wght: 800, text: "Agents, everywhere", size: 76, tracking: -1.2 },
  sub: { font: PJS, wght: 400, text: "Build an agent that belongs where people already work.", size: 22 },
  foot: { font: PJS, wght: 500, text: "Starter kit · one agent, every surface", size: 13, tracking: 0.1 },
  builtwith: { font: SSM, wght: 500, text: "BUILT WITH", size: 12, tracking: 2.4 },
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

// ── sponsor row ────────────────────────────────────────────────────────────
// Each mark is embedded as its own <image> data URI, so gradient ids from the
// original brand files cannot collide. `currentColor` is substituted for a
// literal here because an <image> is a separate document and would not inherit
// the parent's colour.
const MARK_FILL = C.body;
const ROW_Y = 372; // vertical centre of the row
const ITEM_GAP = 40;

const sponsorMark = (slug) => {
  const raw = readFileSync(join(assets, "sponsors", `${slug}.svg`), "utf8");
  const vb = raw.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  const painted = raw.replaceAll("currentColor", MARK_FILL);
  return {
    ratio: vb[2] / vb[3],
    href: `data:image/svg+xml;base64,${Buffer.from(painted).toString("base64")}`,
  };
};

let rowX = 96;
const sponsorRow = SPONSORS.map((sp) => {
  const mark = sponsorMark(sp.slug);
  const h = +(MARK_H * sp.scale).toFixed(2);
  const w = +(h * mark.ratio).toFixed(2);
  const el = `  <image x="${rowX}" y="${(ROW_Y - h / 2).toFixed(2)}" width="${w}" height="${h}" xlink:href="${mark.href}"><title>${sp.name}</title></image>`;
  rowX += w + ITEM_GAP;
  return el;
});
const rowWidth = rowX - ITEM_GAP - 96;

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

${place("eyebrow", 96, 128, C.body)}
${place("hero", 94, 224, C.ink)}
${place("sub", 96, 282, C.body)}

${place("builtwith", 96, 340, C.faint)}
${sponsorRow.join("\n")}

${place("foot", 96, 448, C.faint)}

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
console.log(`hero ${runs.hero.width.toFixed(0)}px · sponsor row ${rowWidth.toFixed(0)}px of 1408px available`);
