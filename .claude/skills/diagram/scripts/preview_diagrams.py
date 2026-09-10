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
        return {"name": entry, "spec": entry}
    if not isinstance(entry, dict):
        sys.exit("Entry %d is neither a string nor an object" % index)
    spec = entry.get("spec", entry.get("diagram"))
    if spec is None:
        sys.exit('Entry %d has no "spec"' % index)
    return {"name": str(entry.get("name") or "spec %d" % index), "spec": spec}


def build_page(script_src, specs):
    """The kit runs against a live DOM, so the page executes block 1 and then
    draws each spec. Block 1 also defines init(), which is deferred to
    DOMContentLoaded and bails immediately without a signed-in user - harmless
    here, but the try/catch keeps a redirect from taking the page away."""
    payload = json.dumps(specs)
    return """<!doctype html>
<meta charset="utf-8">
<title>StudyFlow diagram preview</title>
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
</style>
<div id="out"></div>
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
             '<div class="meta" data-i="' + i + '"></div></div>');
}
out.innerHTML = parts.join('');
/* Shape and label counts, so an empty-looking frame is obvious without
   counting by eye. */
var cards = out.querySelectorAll('.card');
for (var j = 0; j < cards.length; j++) {
  var s = cards[j].querySelector('svg');
  var meta = cards[j].querySelector('.meta');
  if (!s) { meta.textContent = 'no svg'; continue; }
  meta.textContent = s.querySelectorAll('*').length + ' shapes, ' +
                     s.querySelectorAll('text').length + ' labels, viewBox ' +
                     (s.getAttribute('viewBox') || '?');
}
</script>
""" % (script_src, payload)


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

    page = build_page(first_script_block(args.lesson), specs)
    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write(page)

    print("Wrote %s (%d diagram%s)" % (args.out, len(specs), "" if len(specs) == 1 else "s"))
    print("Open it and look at it — shape counts alone will not tell you it is right.")


if __name__ == "__main__":
    main()
