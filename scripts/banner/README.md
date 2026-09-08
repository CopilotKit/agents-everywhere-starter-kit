# Regenerating the banner

The committed `assets/banner.svg` and `assets/banner.png` are **self-contained** —
all type is converted to outlines, so they render identically anywhere with no
font to install. You only need this directory if you want to change the banner.

```bash
python3 -m venv /tmp/fontenv && /tmp/fontenv/bin/pip install fonttools
FONTTOOLS_PYTHON=/tmp/fontenv/bin/python node scripts/banner/build.mjs
```

Plus Jakarta Sans and Spline Sans Mono are downloaded on first run into
`assets/fonts/` (gitignored), straight from `google/fonts`.

## Why outlines instead of `<text>`

Two reasons, both found the hard way:

1. The brand fonts are not system-installed, and **sharp's librsvg on macOS does
   not read a scoped `FONTCONFIG_FILE`** — a `<text>` banner silently renders in
   Helvetica and looks almost right, which is the worst kind of wrong.
2. Only variable TTFs are published for these families, so a weight-800 headline
   needs the `wght` axis instanced first. `textpath.py` does that with
   `fontTools.varLib.instancer`, then walks the glyphs with `SVGPathPen` and lays
   them out using `hmtx` advances plus `kern` pairs.

## Brand constraints this honours

- The **full logotype** (`assets/copilotkit-logo-full.svg`, the packaged asset —
  never redrawn) with clearspace of at least half the logotype height on every
  side.
- **Plus Jakarta Sans** for the headline and supporting copy, in sentence case.
- **Spline Sans Mono**, uppercase, only for the eyebrow and the surface pills —
  the technical/detail treatment it is scoped to.
- Only **verified palette tokens**: grey/25 ground, grey/1000 ink, grey/800 body,
  grey/700 faint, grey/400 borders, and lilac / mint / primary-100 for the glow.
- Glow sits **behind** the content, soft and low-saturation — never the contrast
  layer.

## Sponsor marks — where each one came from

`assets/sponsors/*.svg` are the brands' **own official lockups**, each fetched
from the source below and flattened to a single colour by `monochrome.py`.
Shapes are never traced, redrawn, or approximated — only paint is changed, and
the row renders in grey/800 so no brand is given more visual weight than
another.

| Mark | Source |
|---|---|
| OpenAI | the wordmark from openai.com's own Design Guidelines page (shipped as `fill="currentColor"`, so recolouring is intended). Their guidelines say **not** to use the Blossom as primary branding, which is why this is the wordmark. |
| OpenRouter | `openrouter.ai/brand/v2/openrouter-light.svg` |
| Exa | `exa.ai/images/logo/exa-logo-blue.svg` |
| Trigger.dev | the inline `<svg><title>Trigger.dev logo</title>` from trigger.dev |
| Auth0 | the header lockup from auth0.com |
| Mozilla.ai | the nav wordmark from mozilla.ai |
| Ambiguous AI | `ambiguous.ai/brand/wordmark.svg` |
| CopilotKit | the packaged `assets/copilotkit-logo-full.svg` from the brand skill |

Two traps worth knowing if you swap a mark:

1. **Pick the logo deliberately, not by viewBox aspect ratio.** A first pass
   scored candidate SVGs by "widest viewBox that mentions logo" and pulled
   **Vercel's** logo off exa.ai — a deployed-on badge. It rendered perfectly and
   was completely wrong. Always eyeball a contact sheet.
2. **The root element must paint.** Several of these ship `<path>` elements with
   no `fill` and rely on inheritance, so a root of `fill="none"` cascades down
   and makes the whole mark invisible with no error. `monochrome.py` sets
   `fill="currentColor"` on the root for exactly this reason.

`SPONSORS[].scale` in `build.mjs` is an optical correction: normalising every
lockup to the same box height looks wrong because they carry different internal
padding. Retune it against a contact sheet, not by arithmetic.
