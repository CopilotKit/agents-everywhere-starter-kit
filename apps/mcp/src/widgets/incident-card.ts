/**
 * The widget ChatGPT renders for `incident_card`.
 *
 * Must be self-contained — no external scripts or stylesheets. It reads the
 * tool's `structuredContent` from `window.openai.toolOutput`, and respects
 * `window.openai.theme` so it does not glow white inside a dark conversation.
 */
export const INCIDENT_CARD_HTML = /* html */ `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Incident</title>
<style>
  :root { --bg:#fff; --fg:#1b1721; --muted:#6e6779; --line:#e0dbe7; --accent:#c4145f; }
  html[data-theme="dark"] { --bg:#1b1724; --fg:#eeebf2; --muted:#948ca1; --line:#2e2739; --accent:#ff5c9b; }
  * { box-sizing:border-box; }
  body { margin:0; padding:14px 16px; background:var(--bg); color:var(--fg);
         font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; }
  h1 { margin:0 0 6px; font-size:1.05rem; letter-spacing:-.01em; }
  p.summary { margin:0 0 12px; color:var(--muted); }
  dl { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin:0 0 12px; }
  dt { font:500 10px/1.4 ui-monospace,monospace; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); }
  dd { margin:2px 0 0; }
  ul { margin:0; padding-left:18px; color:var(--muted); }
  .rail { border-left:3px solid var(--accent); padding-left:12px; }
  .empty { color:var(--muted); font-style:italic; }
</style></head>
<body>
<div id="root" class="rail"><p class="empty">Waiting for content…</p></div>
<script>
  var api = window.openai || {};
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
    return { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]; }); }

  function paint() {
    var d = (api.toolOutput || {});
    if (!d.headline) return;
    var facts = Array.isArray(d.facts) ? d.facts : [];
    var steps = Array.isArray(d.nextSteps) ? d.nextSteps : [];
    document.getElementById("root").innerHTML =
      "<h1>" + esc(d.headline) + "</h1>" +
      "<p class='summary'>" + esc(d.summary) + "</p>" +
      (facts.length ? "<dl>" + facts.map(function(f){
        return "<div><dt>" + esc(f.label) + "</dt><dd>" + esc(f.value) + "</dd></div>"; }).join("") + "</dl>" : "") +
      (steps.length ? "<ul>" + steps.map(function(s){ return "<li>" + esc(s) + "</li>"; }).join("") + "</ul>" : "");
    if (typeof api.notifyIntrinsicHeight === "function") {
      api.notifyIntrinsicHeight(document.documentElement.scrollHeight);
    }
  }

  if (api.theme) document.documentElement.setAttribute("data-theme", api.theme);
  paint();
  // toolOutput can arrive after first paint.
  window.addEventListener("openai:set_globals", function(){
    if (api.theme) document.documentElement.setAttribute("data-theme", api.theme);
    paint();
  });
</script>
</body></html>`;
