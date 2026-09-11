"""Flatten a brand SVG to a single-colour mark.

Sponsor rows read as one system only if every mark carries the same weight and
colour. Some of these ship gradients (for example, Ambiguous AI), so those
get stripped: <defs> goes, every `fill="url(#...)"` and hard-coded hex becomes
`currentColor`, and `fill="none"` survives only on the root element where it
means "don't paint the canvas".

Shapes are never touched — only paint.
"""
import re, sys, pathlib

def monochrome(src: str, title: str) -> str:
    vb = re.search(r'viewBox="([^"]+)"', src)
    if not vb:
        raise SystemExit(f"{title}: no viewBox")

    body = src
    body = re.sub(r"<defs\b.*?</defs>", "", body, flags=re.S)        # gradients, filters
    body = re.sub(r"<style\b.*?</style>", "", body, flags=re.S)
    body = re.sub(r"<title\b.*?</title>", "", body, flags=re.S)

    inner = re.sub(r"^.*?<svg\b[^>]*>", "", body, flags=re.S)
    inner = re.sub(r"</svg>\s*$", "", inner, flags=re.S)

    # every paint becomes currentColor; `none` is preserved so counters stay open
    inner = re.sub(r'fill="(?!none")[^"]*"', 'fill="currentColor"', inner)
    inner = re.sub(r'stroke="(?!none")[^"]*"', 'stroke="currentColor"', inner)
    # drop paint-only attributes that fight a flat fill
    inner = re.sub(r'\s(?:fill-opacity|stroke-opacity|opacity)="[^"]*"', "", inner)
    inner = re.sub(r"\s*class=\"[^\"]*\"", "", inner)

    # The root MUST paint, not `fill="none"`. Several of these marks (the
    # simple-icons ones, Exa) ship <path> elements with no fill attribute and
    # rely on inheritance — a root of `fill="none"` cascades down and renders
    # the whole logo invisible, silently.
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb.group(1)}" fill="currentColor">'
        f"<title>{title}</title>{inner.strip()}</svg>"
    )

if __name__ == "__main__":
    src_path, out_path, title = sys.argv[1], sys.argv[2], sys.argv[3]
    out = monochrome(pathlib.Path(src_path).read_text(), title)
    pathlib.Path(out_path).write_text(out)
    print(f"{out_path}  {len(out)}B")
