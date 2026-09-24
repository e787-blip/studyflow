#!/usr/bin/env python3
"""Render StudyFlow diagrams to a standalone page so they can be looked at.

Reading diagram source does not tell you whether the diagram is right. Every
diagram bug in this codebase read as correct code: a crest marker on a zero
crossing, a caption struck through by an orbit, a chart quietly demoted to plain
boxes. All were obvious in one screenshot.

This pulls the real drawing kit out of lesson.html and renders whatever specs
you give it into one labelled page, so checking is one command instead of the
serve-seed-navigate-inject dance.

Usage
-----
    preview_diagrams.py specs.json [-o out.html] [--lesson path/to/lesson.html]
    preview_diagrams.py --demo -o out.html

specs.json is a list. Each entry is either:

    {"name": "wave", "spec": {"type": "custom", "layout": "graph", ...}}
    {"name": "photosynthesis", "spec": "photosynthesis in the chloroplast"}

A string spec goes through the curated matcher; an object goes through the kit.
A bare string in the list works too, and is used as its own name.

Then open the file and look at it.
"""

import argparse
import html
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_LESSON = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", "lesson.html"))

DEMO = [
    {"name": "curated / forces", "spec": {"type": "forces", "label": "forces"}},
    {"name": "curated / wave", "spec": {"type": "wave", "label": "wave"}},
    {"name": "custom / flow", "spec": {"type": "custom", "layout": "flow", "title": "Photosynthesis",
                                       "items": ["Light absorbed", "Water split", "Glucose made"]}},
    {"name": "custom / graph", "spec": {"type": "custom", "layout": "graph", "title": "Population growth",
                                        "xLabel": "Time", "yLabel": "Population", "shape": "scurve",
                                        "items": ["Slow start", "Rapid growth", "Levels off"]}},
    {"name": "custom / bars", "spec": {"type": "custom", "layout": "bars", "title": "Dry air",
                                       "items": ["Nitrogen: 78", "Oxygen: 21", "Argon: 0.9"]}},
    {"name": "custom / venn", "spec": {"type": "custom", "layout": "venn", "title": "Mitosis and meiosis",
                                       "left": {"title": "Mitosis", "items": ["2 cells", "Identical DNA"]},
                                       "right": {"title": "Meiosis", "items": ["4 cells", "Varied DNA"]},
                                       "shared": ["Cell division"]}},
    {"name": "custom / matrix", "spec": {"type": "custom", "layout": "matrix", "title": "Market structures",
                                         "xLabel": "Number of firms", "yLabel": "Barriers",
                                         "xLow": "few", "xHigh": "many", "yHigh": "high", "yLow": "low",
                                         "items": ["Monopoly", "Oligopoly", "Monopolistic", "Perfect"]}},
]


def first_script_block(lesson_path):
    """lesson.html's block 1 holds SFDiagramKit, curatedDiagramSVG and
    generateDiagramSVG. Block 2 is the whiteboard and is not needed here."""
    with open(lesson_path, encoding="utf-8") as fh:
        source = fh.read()
    blocks = re.findall(r"<script>(.*?)</script>", source, re.S)
    if not blocks:
        sys.exit("No <script> blocks found in %s" % lesson_path)
    return blocks[0]


def normalise(entry, index):
    if isinstance(entry, str):
        return {"name": entry, "spec": entry, "sources": [entry]}
    if not isinstance(entry, dict):
        sys.exit("Entry %d is neither a string nor an object" % index)
    spec = entry.get("spec", entry.get("diagram"))
    if spec is None:
        sys.exit('Entry %d has no "spec"' % index)
    return {"name": str(entry.get("name") or "spec %d" % index), "spec": spec,
            "sources": source_strings(spec)}


def source_strings(spec):
    """Every string the spec put in, so the audit can notice one coming out
    shorter than it went in. "Causes of the French Revolution" rendered as
    "Causes of the French" is not a styling problem — the label now says
    something the material did not.

    "label" is skipped: on a curated spec it is the CARD's caption, not content
    the drawing has to contain, and counting it reported every hand-drawn
    template as having lost words it was never given."""
    found = []

    def walk(node):
        if isinstance(node, str):
            found.append(node)
        elif isinstance(node, list):
            for item in node:
                walk(item)
        elif isinstance(node, dict):
            for key, value in node.items():
                if key in ("type", "layout", "shape", "label", "caption"):
                    continue
                walk(value)

    walk(spec)
    return found


def audit_src():
    path = os.path.join(HERE, "audit.js")
    if not os.path.exists(path):
        return ""
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def build_page(script_src, specs, audit_js):
    """The kit runs against a live DOM, so the page executes block 1 and then
    draws each spec. Block 1 also defers init() to DOMContentLoaded, and init()
    opens with an auth guard that *navigates* - with no signed-in user it sent
    this preview page to the live login screen before a single diagram drew.
    So the listener is swallowed below. The drawing functions are all defined at
    parse time and need nothing init() does."""
    payload = json.dumps(specs)
    return """<!doctype html>
<meta charset="utf-8">
<title>StudyFlow diagram preview</title>
<!-- The app's own fonts. Without them every label renders in a system
     fallback whose widths differ from what the kit measured, and what you look
     at here is not what a learner sees. -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap">
<style>
  body { margin:0; padding:18px; background:#f6f8fb;
         font-family:'DM Sans',system-ui,-apple-system,sans-serif; color:#1a1d2e; }
  h1 { font-size:15px; margin:0 0 14px; letter-spacing:-.01em; }
  .card { background:#fff; border:1px solid #e2e8f0; border-radius:12px;
          padding:12px 14px 16px; margin:0 0 14px; max-width:620px; }
  .name { font-size:10px; font-weight:700; text-transform:uppercase;
          letter-spacing:.07em; color:#64748b; margin-bottom:8px; }
  .fail { color:#b91c1c; font-size:12px; font-weight:600; }
  .meta { font-size:10px; color:#94a3b8; margin-top:8px; }
  .aud { margin-top:10px; border-top:1px solid #eef2f7; padding-top:8px; }
  .f { font-size:11px; line-height:1.45; margin:4px 0; padding-left:56px;
       text-indent:-56px; }
  .f b { display:inline-block; width:44px; margin-right:8px; text-indent:0;
         font-size:9px; text-transform:uppercase; letter-spacing:.06em;
         text-align:center; border-radius:4px; padding:1px 0; }
  .f-fail b { background:#fdecec; color:#991b1b; }
  .f-warn b { background:#fff4e5; color:#92400e; }
  .f-info b { background:#eef2f7; color:#64748b; }
  .ok { font-size:11px; color:#15803d; font-weight:600; }
</style>
<div id="out"></div>
<script>
/* Block 1 registers init() on DOMContentLoaded, and init()'s auth guard
   redirects to studyflow-ten-vert.vercel.app when localStorage has no
   studyflow_user - which is always, here. Drop that one listener before block 1
   parses. Seeding a fake user instead does not work: init() then runs on to the
   next guard and redirects to the dashboard. */
(function () {
  var add = document.addEventListener.bind(document);
  document.addEventListener = function (type, fn, opts) {
    if (type === 'DOMContentLoaded') return;
    return add(type, fn, opts);
  };
})();
</script>
<script>%s</script>
<script>%s</script>
<script>
var SPECS = %s;
var out = document.getElementById('out');
var parts = [];
for (var i = 0; i < SPECS.length; i++) {
  var entry = SPECS[i], svg = null, err = null;
  try {
    svg = generateDiagramSVG(entry.spec);
  } catch (e) {
    err = e && e.message ? e.message : String(e);
  }
  var body;
  if (err) body = '<div class="fail">threw: ' + err + '</div>';
  else if (!svg) body = '<div class="fail">returned null &mdash; declined to draw</div>';
  else body = svg;
  parts.push('<div class="card"><div class="name">' + entry.name + '</div>' + body +
             '<div class="meta" data-i="' + i + '"></div><div class="aud"></div></div>');
}
out.innerHTML = parts.join('');
/* Shape and label counts, so an empty-looking frame is obvious without
   counting by eye. */
var cards = out.querySelectorAll('.card');
var report = [];
/* Measure only once the web fonts are in: the audit reads real glyph boxes,
   and a label measured in the fallback font is a different width. */
function runAudit() {
for (var j = 0; j < cards.length; j++) {
  var s = cards[j].querySelector('svg');
  var meta = cards[j].querySelector('.meta');
  if (!s) { meta.textContent = 'no svg'; continue; }
  meta.textContent = s.querySelectorAll('*').length + ' shapes, ' +
                     s.querySelectorAll('text').length + ' labels, viewBox ' +
                     (s.getAttribute('viewBox') || '?');

  /* The audit runs here rather than in a separate pass so that looking at the
     picture and reading what is wrong with it happen on the same screen. It
     measures what is measurable; it cannot tell you the diagram is about the
     wrong thing. Look at it as well. */
  var res = (typeof SFAudit === 'function') ? SFAudit(s, { sources: SPECS[j].sources || [] }) : [];
  var box = cards[j].querySelector('.aud'), html = '', fs = res.length ? res[0].findings : [];
  if (!fs.length) {
    html = '<div class="ok">no mechanical faults — now look at it</div>';
  } else {
    for (var k = 0; k < fs.length; k++) {
      html += '<div class="f f-' + fs[k].level + '"><b>' + fs[k].level + '</b>' +
              fs[k].code + ' — ' + fs[k].message + '</div>';
    }
  }
  box.innerHTML = html;
  report.push({ name: SPECS[j].name, findings: fs, counts: res.length ? res[0].counts : null });
}
window.SF_REPORT = report;
window.SF_READY = true;
console.log('SFAudit: ' + report.length + ' diagrams, ' +
            report.filter(function (r) {
              return r.findings.some(function (f) { return f.level === 'fail'; });
            }).length + ' with failures');
}
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(runAudit, runAudit);
} else {
  runAudit();
}
</script>
""" % (audit_js, script_src, payload)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("specs", nargs="?", help="JSON file of specs to render")
    ap.add_argument("-o", "--out", default="/tmp/sf-diagram-preview.html")
    ap.add_argument("--lesson", default=DEFAULT_LESSON,
                    help="path to lesson.html (default: repo root)")
    ap.add_argument("--demo", action="store_true",
                    help="render one of each layout instead of reading a file")
    args = ap.parse_args()

    if not args.demo and not args.specs:
        ap.error("give a specs.json, or --demo")
    if not os.path.exists(args.lesson):
        sys.exit("lesson.html not found at %s (pass --lesson)" % args.lesson)

    if args.demo:
        raw = DEMO
    else:
        with open(args.specs, encoding="utf-8") as fh:
            raw = json.load(fh)
        if not isinstance(raw, list):
            sys.exit("specs.json must be a list")

    specs = [normalise(e, i) for i, e in enumerate(raw)]
    for s in specs:
        s["name"] = html.escape(s["name"])

    page = build_page(first_script_block(args.lesson), specs, audit_src())
    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write(page)

    print("Wrote %s (%d diagram%s)" % (args.out, len(specs), "" if len(specs) == 1 else "s"))
    print("Open it and look at it — shape counts alone will not tell you it is right.")


if __name__ == "__main__":
    main()
