# Drawing a real thing

`kit.md` is the layout engine — boxes, arrows, charts. This is the other half:
how to draw an actual picture, with `SFSceneKit`, which is what the model uses
at lesson entry and what a hand-drawn template should match.

## The vocabulary

`SFSceneKit.fromSpec(spec)` → svg string, or **null**. Null is normal; the
caller falls back to whatever it had.

```json
{"type":"drawing","title":"short caption","w":400,"h":300,"shapes":[ ... ]}
```

Seven shape kinds. Anything else is dropped silently, so a typo'd `s` is an
invisible missing shape.

| `s` | Fields | Notes |
|---|---|---|
| `rect` | `x y w h r` | `r` is the corner radius, 0–40 |
| `circle` | `x y r` | `r` 1–max(W,H)/2, default 20 |
| `ellipse` | `x y rx ry` | |
| `line` | `x1 y1 x2 y2` | `"arrow":true` adds a head, `"dash":true` dashes it |
| `path` | `d` | `M L H V Q C A Z` + numbers only, ≤900 chars, must start with `M` |
| `poly` | `points` | `"x y x y …"`, digits/space/comma/dot/minus only, ≤500 chars |
| `text` | `x y t size anchor weight` | `t` ≤80 chars, `size` 7–26 (default 11), `anchor` start/middle/end |

Every shape also takes `fill`, `stroke`, `sw` (0.5–6, default 1.8) and
`opacity` (0–1).

**Colours are names, never hex.** `ink muted rule paper faint none`, and
`blue green red violet teal amber pink` each with a `…Fill` (pale) and `…Ink`
(dark) variant — `blueFill`, `blueInk`.

**Limits that bite:** 80 shapes max, `w` 160–900 (default 460), `h` 100–700
(default 260). Fewer than **3 shapes or 0 labels returns null**. Every
coordinate is clamped into the canvas, so a shape at x=900 on a 400 canvas is
squashed to the edge rather than lost — which looks like a design choice, not a
bug. Check your numbers.

**What the renderer does for you:** every label gets a paper-coloured stroke
behind the glyphs (`paint-order="stroke"`), so a label stays readable over any
fill; near-white text fills are coerced to `ink`, because this palette has no
dark grounds; label `x` is clamped so the whole *word* stays on the canvas; and
label `y` is pushed below the title band when a `title` is set.

## Scale, in the only units that matter

The board is `width:100%`. On a 375px phone the content box is ~343px, so:

```
rendered px = size × 343 / W
```

**Keep W ≤ 400 and every label ≥ 11.** At W=400 an 11 is 9.4px. At the default
W=460 the same 11 is 8.2px, and the `size:9` labels the art prompt's leaf used
to teach were **7.0px** — which is also why the curated templates, 440–516 wide,
had sub-labels at 5.6–7.3px on a phone. The renderers now enforce a 9px floor,
but design at 11 anyway: a floor rescues legibility, not layout.

Objects have a floor too: on a 400-wide canvas, **anything under ~50 units
cannot carry recognisable detail.** A 30-unit aeroplane is a blob no matter how
many points its polygon has. Draw it bigger, reduce it to an icon-level
silhouette, or leave it out. Two objects drawn properly beat five drawn small.

## Recipes

**A curved silhouette.** Two mirrored quadratics make a leaf, a blade, a
membrane, a hill. A quadratic only reaches *half way* to its control point, so
put the control at twice the bulge you want:

```json
{"s":"path","d":"M60 70 Q220 52 380 70 L380 168 Q220 186 60 168 Z",
 "fill":"greenFill","stroke":"green","sw":2}
```

**Stacked layers that follow a curve.** One helper shape, four times, with the
same control offset — the earth's curve, strata, the atmosphere, a soil
profile. Band from `low` to `up`:

```
M0 {low} Q200 {low−26} 400 {low} L400 {up} Q200 {up−26} 0 {up} Z
```

Tint one hue across them (`opacity` 0.85 → 0.28 going up) so the colour carries
the gradient instead of decorating it.

**A leader line and its label.** The line is `rule`-coloured and thin; the label
sits in the outer margin at the end of it, never on the drawing:

```json
{"s":"line","x1":118,"y1":74,"x2":118,"y2":48,"stroke":"rule","sw":1},
{"s":"text","x":118,"y":42,"t":"Palisade cells","size":11}
```

**Arrows mean movement or change** — light arriving, water rising, a force
acting. They are not how parts connect. Two boxes joined by an arrow is the
flowchart habit wearing a drawing's clothes.

**Zone the canvas before you draw.** Decide where labels live and keep the
drawing out of it. The atmosphere exemplar puts every layer label right-aligned
at x=392 and every object left of x=250, so no collision is possible. Placing
shapes one at a time and discovering collisions afterwards is how the plane
ended up flying through the words "Ozone layer" in the first draft of it.

**Check curve geometry by rendering.** On `Q(p0,c,p1)` the curve peaks at
`0.25·p0 + 0.5·c + 0.25·p1`. Anchor arrows and markers to a *computed* point on
the curve, not to an eyeballed one — the first photosynthesis draft had light
rays terminating inside the blade.

## The exemplar

`exemplar-atmosphere.json` renders two versions of one topic:

```bash
python3 .claude/skills/diagram/scripts/preview_diagrams.py \
  .claude/skills/diagram/references/exemplar-atmosphere.json -o /tmp/p.html
```

**BEFORE** is the `hierarchy` layout: four rounded rectangles in blue, green,
purple and pink. The audit returns `box-and-arrow` (nothing drawn, 4 boxes, 5
labels) and `rotated-hue` (3 hues across one series). It is also, almost
exactly, the example `app.html`'s day prompt showed the model until this was
written — and the model copied it.

**AFTER** audits clean, and its parts map one-to-one onto §2 of the skill:

| Rule | How it shows up |
|---|---|
| draw the thing | 9 paths and 3 polys: the earth's curve, a mountain with a snow cap, four sky bands, a cloud, an aircraft |
| one hue | a single blue tinted by altitude, so the tint *is* the lesson; one red, for the meteor, because it is burning |
| W ≤ 400, labels ≥ 11 | W=400, every label `size:11` → 9.4px on a phone |
| labels outside | layer names right-aligned in the margin at x=392; objects all left of x=250 |
| fill the frame | bands run edge to edge; ground closes the bottom |
| nothing cut | longest label is 23 characters, comfortably inside the clamp |

Each band carries one real object at its real altitude — aircraft in the
troposphere, weather balloon and ozone in the stratosphere, a meteor burning up
in the mesosphere, a satellite in the thermosphere. That is what makes it a
picture rather than four labelled stripes: the objects are the altitudes.

## The label pattern every redrawn template uses

Copy it; it is why they audit clean.

- **Name** bold 11.5, ink `#1a1d2e`. **Sub-line** regular 10.5, muted `#5b6478`,
  **15 units** below. At 11 or 13 apart the two lines overlap once the phone
  floor lifts them.
- **Leader**: a 1px ink line at 50% opacity, starting just OUTSIDE the label
  block (above, below or beside it — never through it) and ending on a 2.4-unit
  ink **dot inside the part**, not on its outline, which would name the edge.
- **Zone first.** Labels in a column or in the corners; the drawing gets the
  rest. The atom puts one label in each corner and moves the electrons onto the
  diagonals to clear them.
- **Anchor end-labels 5 units inside the frame** (x = W − 5). At W − 2,
  `polish()` pads the viewBox to W + 1 and every label on the card shrinks.
- Near a line or over a fill, give text the paper halo:
  `stroke="#ffffff" stroke-width="3" stroke-linejoin="round" paint-order="stroke"`.

## The kit's visual language (`SFDiagramKit`)

| Token | Value | Use |
|---|---|---|
| `TINTS` | `#f4f7ff` → `#c3d4fd` | `pal(i, n)` ramps along an ORDER; `pal()` is one flat tint |
| `FOCAL` | `#3563e9`, white type (5.1:1) | the one node the diagram is about — a converge's outcome, a hub |
| `OTHER` | slate `#9aa6b8` / `#f1f4f8` | the second set of a compare or venn, and nothing else |
| `LINK` | `#9aabcc` | connectors and arrowheads |
| `SERIF` | Instrument Serif 17 | titles, so the diagram belongs to the card it sits on |
| sizes | node 12, secondary 10.5 | never smaller |
| `MAX_W` | 400 | widest any layout may draw |

Shapes that carry meaning, not boxes: `hierarchy` is a real trapezoid pyramid;
`parts` labels on leader lines into the whole; `concept` is a focal hub with
dot-ended spokes; `timeline` runs down the card with rows **spaced by elapsed
time**, so a cluster of events looks like one; `bars` are solid on a pale track;
`graph` places each label by testing six spots against the sampled curve.

## Redrawn templates worth reading before drawing a new one

`curatedDiagramSVG` in `lesson.html`: **brain** (lobes clipped to one
silhouette so edges cannot gap — `<clipPath>` with an id from
`curatedDiagramSVG.seq`), **neuron** (one cell, one colour, the signal in the
focal blue), **water-cycle** (a landscape; the sea drawn first so the land's
beach overlaps it), **plate-tectonics** (two drawings chosen by topic:
subduction, or the Earth's layers), **atom** (a real element — carbon),
**rock-cycle** (the texture IS the lesson), **mitosis**, **memory-model**
(vertical, because a readable row cannot fit a phone).

The day-generation prompt in `app.html` now shows the model
`exemplar-atmosphere.json`, generated from the file. It used to show four
rectangles in four hues directly under a rule forbidding exactly that. If you
change the exemplar, regenerate that block.

## What this still is not

Honest limits, so nobody expects more than the tools give:

- This is **schematic textbook art**, not anatomical illustration. Complexes
  come out as shapes with names beside them; composition is hit and miss.
- The 23 curated templates are hand-drawn and genuinely better *where they
  match* — 23 topics. A generated drawing is always on-topic and usually
  plainer. Order today: model drawing → the day's own material → curated last.
- A **focused prompt gets a real picture; the same request buried in the 29k
  day prompt gets a box diagram.** Measured: the dedicated ~3k lesson-entry art
  prompt drew a chloroplast with thylakoid, ATP synthase and a proton gradient;
  the day prompt, same model and topic, returned 3 rects and 15 text labels.
