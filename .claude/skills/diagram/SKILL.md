---
name: diagram
description: Draw a picture for StudyFlow that is correct AND worth looking at — a real illustration built from the material, not four coloured boxes with the words inside. Use this whenever a diagram, illustration, visual, chart, graph or "picture of how X works" is wanted; whenever touching curatedDiagramSVG, SFDiagramKit, SFSceneKit, SFStepVisual or the lesson-art prompt in app.html; whenever a lesson, whiteboard scene or question card needs a visual; and whenever a picture looks bad, cheap, generic, cramped, empty, mislabelled or "AI-made". Also use it when the request is only implicitly visual — "show me how this works", "make this clearer", "students can't picture it".
---

# Drawing for StudyFlow

A picture here has to be two things, and they fail separately:

- **True.** It teaches something the material actually says. Four key terms in
  four boxes with arrows between them asserts an order that does not exist.
- **Worth looking at.** A drawing a 7th grader would stop on. This is the half
  that has been losing: the app's generic layouts are rounded rectangles in six
  rotating hues with the entire content in the words, and they look it.

Both halves are checkable, and most of the second half is measurable. Do not
skip to the code — **§0 is the whole discipline** and takes about a minute.

## 0. The loop: render → audit → look → fix

```bash
python3 .claude/skills/diagram/scripts/preview_diagrams.py specs.json -o /tmp/p.html
python3 -m http.server 8765 --directory /tmp     # file:// is blocked in the pane
```

Open `http://localhost:8765/p.html`. Every diagram renders with the **real kit
pulled out of `lesson.html`**, and each one prints its own audit underneath:
`SFAudit` (`scripts/audit.js`) measures hue rotation, whether anything is
actually drawn, type size at phone width, label collisions, text sitting on a
line, invisible text, clipping, dead space, and words that went into the spec
and never came out.

`specs.json` is a list of `{"name": "...", "spec": {...}}`. A spec object goes
through the kit; a plain string exercises the curated matcher.

Read the findings by level. **fail** is a defect, always: overlap, clipping,
invisible text, a line through a word, words dropped, type under 7px.
**warn** is a question you must answer out loud: `rotated-hue` (does each hue
mean something?), `box-and-arrow` (is this a relation, or a thing that should be
drawn?), `small-text` (7–9px), `dead-space`.

Then **look at it**. The audit is necessary and not sufficient — it cannot see
that a picture is about the wrong thing, that an object is unrecognisable, or
that a composition is a mess. Both halves of this section are load-bearing:

- Every diagram bug in this codebase read as correct code. A wave's crest
  marker on the zero crossing, a caption struck through by an orbit, a bar chart
  silently demoted to plain boxes.
- And every *ugly* diagram passed a human skim. The rotating hues, the 6px
  labels and the animal cell served for a plant cell were all in production,
  looked at, and not noticed.

To audit something already on a page (a real lesson card, the live board), paste
`scripts/audit.js` in the console and call `SFAudit()` or
`SFAudit(document.querySelector('#lesson-art'))`.

## 1. What "cheap" looked like here — and what now guards against it

Every row was measured on real output. All of them shipped, all of them are
fixed, and each fix is a guard that will stop a NEW diagram making the same
mistake — so know what they are before working around one.

| Signature | What it was | Now |
|---|---|---|
| **Rotated hue** | `PAL` handed six hues out in rotation: node 1 blue, node 2 teal, node 3 violet… | One hue. `pal(i, n)` gives a tint ramp **only** when the items have an order; `pal()` is one tint; `FOCAL` (solid blue, white type) marks the one thing a diagram is about; `OTHER` (slate) is the second set of a compare/venn |
| **6px labels** | curated sub-labels at 5.5–7.3px on a 375px phone | `SFDiagramKit.legible()` raises any font-size that would land under 9px, computed per SVG from its own viewBox and max-width; `SFSceneKit` applies the same floor to model drawings. Kit layouts are capped at `MAX_W = 400` |
| **Silent word drop** | `wrap()` stopped at `maxLines` and threw the rest away: "Causes of the / French" | the rest is glued on and cut WITH an ellipsis; hubs get three lines |
| **Label on a line** | "Levels off" on its own curve | `buildGraph` tries six positions per label against a sampled curve; `T(..., {halo:true})` for anything near a line |
| **Rotated label grew the canvas** | a `<g transform="rotate">` label was read by `polish()` as text at (0,0), widening the viewBox 35 units | rotation goes ON the `<text>` (`T(..., {rotate:-90})`), which `polish()` skips |
| **Arrows lost their heads** | every SVG used marker id `sfdkArrow`; the first one on the page wins, and if it is hidden, none draw | `SFDiagramKit.uniqIds()` renames every id per SVG at the exit of `generateDiagramSVG` |
| **Facts wrong** | the atom (2 protons, 8 electrons, shell 2 half-full under shell 3); the brain (cerebellum under the front); the plant cell (drew an animal cell) | redrawn and correct — see `references/craft.md`. **Check the science, not just the pixels** |

## 2. The standard

Six rules. Five are mechanical, and the audit checks them.

**1. Draw the thing, not a box with its name in it.** If the picture's
information is entirely in its labels, it is a list with extra steps — delete it
and keep the list. A drawing needs **at least 6 `path` or `poly` shapes**; rects,
circles and text alone are a flowchart. Never an acronym inside a circle: that
is a label pretending to be a drawing. Draw the structure, put the name outside
on a leader line.

**2. One hue, unless the hue means something.** Rotating colour through a series
is decoration — position already distinguishes the items. Use **one hue at
different tints**, and reach for a second only when it carries meaning the
learner can name: hot vs cold, in vs out, before vs after, water vs air. The
atmosphere exemplar tints a single blue by altitude, so the colour *is* the
lesson (air thins as you go up), and adds exactly one second hue: a red meteor,
because it is burning.

**3. `W` sets the type size. Keep W ≤ 400 and labels ≥ 11.** The board is
`width:100%`, so a wide viewBox scales the whole drawing *down* on a phone:

| viewBox W | label size 9 | 11 | 12 |
|---|---|---|---|
| 460 (SceneKit default) | 6.7px | 8.2px | 9.0px |
| 440 (the art prompt's exemplar) | **7.0px** | 8.6px | 9.4px |
| 400 | 7.7px | **9.4px** | 10.3px |

Nothing is rasterised, so a narrower board scales *up* where there is room. A
narrower canvas is free; small type is not.

**4. Labels outside, on leader lines, with a halo.** Put a label in the outer
margin and run a thin `rule`-coloured line to the part it names. Work out where
the shapes are *before* placing text: a label whose x,y falls inside another
shape is wrong. `SFSceneKit` already draws every label with a paper-coloured
stroke behind the glyphs (`paint-order="stroke"`) and coerces near-white text to
ink — if you hand-write SVG elsewhere, do both yourself. Placing text in a space
it cannot measure is the single thing a language model is worst at, so make the
geometry do the work.

**5. Fill the frame, and give it one focal point.** Content should fill ≥70% of
the viewBox in both directions; an empty band reads as a mistake. Crop the
viewBox to the drawing, or use the room. And compose deliberately — zone the
canvas before drawing (objects left, labels right; or drawing centre, labels
around) rather than placing shapes one at a time and discovering the collisions.

**6. Nothing cut, nothing dropped.** No clipping at the edges — clamp the whole
*word*, not its anchor point, since a middle-anchored label hangs half its width
either side of `x`. And no label trimmed to fit: rewrite it shorter at the
source. A trimmed label says something the material did not.

## 3. A drawing, or a layout?

Ask what the material **is**, not what subject it belongs to:

**Does the topic have a physical form?** A leaf, a neuron, an atmosphere, a
circuit, a trebuchet, a sarcomere, a heart. → **Draw it.** A cross-section,
cutaway or side view, with real proportions. This is where the good pictures
live, and it is under-used because a layout is always easier.

**Is it a relation between named things?** Steps, a loop, a contrast, a
hierarchy, a trend. → **Layout**, from the table below — but apply §2 to it
anyway: one hue, ≥11pt labels, no truncation.

**Neither?** Draw nothing. A missing diagram costs a little; a confidently wrong
one teaches the wrong thing.

| The material is… | Shape | Needs |
|---|---|---|
| ordered steps, a causal chain | `flow` | 2+ items in order |
| a repeating loop | `cycle` | 3+ items |
| dated or sequenced events | `timeline` | 2+ items, ideally with dates |
| ranked levels | `hierarchy` | 2+ items, broadest last |
| a whole and its components | `parts` | items + a `center` |
| an idea and related ideas | `concept` | items + a `center` |
| two things contrasted | `compare` | `left` and `right`, each named |
| two overlapping sets | `venn` | `left`, `right`, and `shared` |
| real quantities | `bars` | every item ending in a number |
| a relationship or trend | `graph` | axis names + a curve shape |
| four groups on two traits | `matrix` | exactly 4 items, two axis names |

**If the data a shape needs is missing, use a different shape.** A bar chart
with no numbers is not a bar chart; a Venn with one side is a circle. The
builders decline for this reason — do not defeat that by inventing values or
guessing which side an item belongs on. Guessing makes the diagram state
something the notes never said.

Full layout reference, fields and fallbacks: `references/kit.md`.

## 4. How to draw a real thing

The vocabulary, the recipes and the worked exemplar are in
**`references/craft.md`**. The short version:

1. **Silhouette first.** The outline of the real object, as one `path` with
   curves in it. A leaf is two mirrored quadratics; the atmosphere is arcs that
   follow the curve of the earth.
2. **Then interior structure**, then **markers** (arrows for movement and change
   — not for "these two things are related"), then **labels** last, into the
   space you have left for them.
3. **Mind the size floor.** On a 400-wide canvas, an object under ~50 units
   cannot carry recognisable detail; it will read as a blob whatever you do.
   Make it bigger, simplify it to an icon-level silhouette, or leave it out. Two
   objects drawn properly beat five drawn small.
4. **Check the geometry by rendering, never by reading the path data.** On a
   quadratic `Q(p0,c,p1)` the curve peaks at `0.25·p0 + 0.5·c + 0.25·p1`, not at
   the control point — that one mistake put the wave template's crest markers on
   its zero crossings.

**The exemplar is `references/exemplar-atmosphere.json`** — the layers of the
atmosphere, which `app.html`'s own prompt currently shows the model as four
rectangles. Render it; it audits clean. Copy its habits: one tinted hue, objects
zoned left and labels right, every label 11pt, a real horizon with a mountain in
it, and one second hue that means heat.

**The model copies the example, not the instructions.** The lesson-art prompt
demanded "not a flowchart" while showing an example made of rectangles, and got
flowcharts back. If generated art regresses, look at the exemplar in the prompt
before touching the wording.

## 5. Geometry that lies, and silent fallbacks

`references/pitfalls.md` has each one with its symptom. The families:

- **A Bézier does not pass through its control point** (crest markers on zero
  crossings).
- **Default text anchoring runs right** — a label to the left of something needs
  `text-anchor="end"`.
- **A name that matches nothing** falls through to a generic diagram rather than
  erroring. Templates match with hyphens flattened to spaces; test
  `generateDiagramSVG({type:'water-cycle'})` by its exact hyphenated name.
- **Data trimmed upstream** silently demotes a layout (`"Nitrogen: 78"` → 
  `"Nitrogen"` left `buildBars` nothing to measure, so every chart became plain
  boxes).
- **A field nothing reads.** If you add one, grep for its consumer.
- **Hub layouts print the topic twice** if you pass it as both `title` and
  `center`. Pass `center`, leave `title` empty.

## 5b. A picture generated at runtime: `sf-draw.js`

When the app should draw something itself - while a plan is made, during a
lesson, on a tap - it goes through `sf-draw.js`, the one file both pages load.
Never a second copy of a prompt in another file.

1. **Prompt**: add a function next to `lessonPrompt` / `momentPrompt`. Build it
   the same way: the facts, `SCENE_SHAPES_DOC`, the colour names, the checkable
   rules, and **an example you rendered and audited first** (§0) - the model
   copies the example, not the rules.
2. **Call**: `SFDraw.request(prompt, ms)` → `{spec}` / `{none}`, or a rejection
   for a failed call.
3. **Judge**: `SFSceneKit.fromSpec(spec)` in `lesson.html`. Null means no picture.
4. **Cache**: the spec, or `null` for `{none}` and refusals. **Nothing** on a
   rejection, so it can be asked again.
5. **Never block, never auto-fire in a loop, never before an answer** if the
   picture could contain one (invariant 7).
6. **Test with `api/generate` mocked**: a good spec, `{"type":"none"}`, prose,
   a 502, an abort, a timeout with a late reply, and a hostile spec. Then look
   at a real one before calling it done.

## 6. House constraints

- **ES5 only** in `lesson.html` — `var`, no arrow functions, no template
  literals. Match the surrounding code.
- **Escape anything from the model or the user** with `esc()` before it enters
  SVG. `SFSceneKit` is the security boundary for model-authored drawings and
  must stay one: fixed shape kinds, colours by name, numbers clamped, path `d`
  grammar-checked.
- **Never put an answer in a diagram** the learner is about to be asked for. The
  opening board once printed worked solutions to the session's first two
  questions. Worked answers belong on the wrong-answer board.
- **Comments explain why.** Several existing ones record bugs that were fixed;
  leave them.

## 7. Before you call it done

- [ ] Rendered it, ran the audit, and **looked** at the picture
- [ ] Zero `fail` findings, and every `warn` either fixed or justified out loud
- [ ] It is a drawing if the topic has a form, a layout if it is a relation, and
      absent if it is neither
- [ ] One hue, or every extra hue names something the learner could state
- [ ] Smallest label ≥ 9px at 375px width (W ≤ 400, size ≥ 11)
- [ ] Every label clear of every line, shape and other label, and readable
      against what is behind it
- [ ] Nothing invented: every label traceable to the source material
- [ ] No answer to an upcoming question visible
- [ ] If it is a new curated template: reachable by its exact hyphenated name
      **and** named in `app.html`'s template list

The last one fails silently — a name in the prompt with no matching template
just quietly produces a generic diagram instead.
