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
