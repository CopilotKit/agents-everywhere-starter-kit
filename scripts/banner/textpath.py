"""Turn a string into an SVG path using a variable font instanced at a weight.

Emits path data plus the laid-out advance width, so the caller can position and
centre runs without guessing at metrics. Kerning comes from the font's `kern`
table where present.
"""
import sys, json
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.misc.transform import Transform

_cache = {}

def load(path, wght):
    key = (path, wght)
    if key not in _cache:
        font = TTFont(path)
        if "fvar" in font:
            font = instancer.instantiateVariableFont(font, {"wght": wght}, inplace=False)
        _cache[key] = font
    return _cache[key]

def kern_pairs(font):
    pairs = {}
    if "kern" in font:
        for st in font["kern"].kernTables:
            pairs.update(st.kernTable)
    return pairs

def run(path, wght, text, size, tracking=0.0):
    font = load(path, wght)
    upem = font["head"].unitsPerEm
    cmap = font.getBestCmap()
    glyphset = font.getGlyphSet()
    hmtx = font["hmtx"]
    kerns = kern_pairs(font)
    scale = size / upem

    pen_out = []
    x = 0.0
    prev = None
    for ch in text:
        name = cmap.get(ord(ch))
        if name is None:
            x += size * 0.35
            prev = None
            continue
        if prev is not None:
            x += kerns.get((prev, name), 0) * scale
        spen = SVGPathPen(glyphset, ntos=lambda v: f"{v:.2f}")
        # flip Y (font space is y-up, SVG is y-down) and place at the pen position
        tpen = TransformPen(spen, Transform(scale, 0, 0, -scale, x, 0))
        glyphset[name].draw(tpen)
        d = spen.getCommands()
        if d:
            pen_out.append(d)
        x += hmtx[name][0] * scale + tracking
        prev = name
    return {"d": " ".join(pen_out), "width": x - (tracking if text else 0)}

if __name__ == "__main__":
    spec = json.loads(sys.stdin.read())
    out = {}
    for key, r in spec.items():
        out[key] = run(r["font"], r["wght"], r["text"], r["size"], r.get("tracking", 0.0))
    print(json.dumps(out))
