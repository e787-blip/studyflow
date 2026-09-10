# SFDiagramKit — API and primitives

Lives in `lesson.html`, script block 1. Reached through `generateDiagramSVG()`,
which tries a curated template, then `SFDiagramKit.fromSpec`, then
`SFDiagramKit.forTopic`, and finally runs `polish()` over whatever won.

## Entry points

```js
generateDiagramSVG(specOrString)   // the one to call; handles fallback + polish
SFDiagramKit.fromSpec(spec)        // structured spec -> svg string, or null
SFDiagramKit.forTopic('text')      // free text -> svg string, or null
SFDiagramKit.polish(svg, opts)     // uncrop viewBox, push apart colliding text
curatedDiagramSVG('text')          // hand-drawn template, or null
diagramForDay(day)                 // {svg, caption} for a lesson card, or null
```

`diagramForDay` is what the lesson card uses. It tries `day.diagram`, then
`day.visual`, then a spec built from the day's own `steps` / `concepts` /
`keyTerms` / `pillars`, then the curated matcher on the topic.

## The 11 custom layouts

Pass `{ type: 'custom', layout: '<name>', title, ... }`.

| Layout | Required | Optional | Declines to |
|---|---|---|---|
| `flow` | `items` (2+) | `title` | — |
| `cycle` | `items` (3+) | `title` | `flow` if < 3 |
| `timeline` | `items` (2+) | `title` | — |
| `hierarchy` | `items` (2+) | `title` | — |
| `parts` | `items`, `center` | `title` | — |
| `concept` | `items`, `center` | `title` | — |
| `compare` | `left{title,items}`, `right{...}` | `title` | — |
| `graph` | — | `xLabel`, `yLabel`, `shape`, `items` (1-3) | always draws |
| `bars` | `items` all ending in a number | `title` | `flow` |
| `venn` | `left{title,items}`, `right{...}` | `shared[]`, `title` | `compare` |
| `matrix` | `items` (exactly 4) | `xLabel`,`yLabel`,`xLow`,`xHigh`,`yHigh`,`yLow` | `concept` |

Aliases accepted by `fromSpec`: `process`/`steps` → `flow`, `pyramid` →
`hierarchy`, `web` → `concept`, `bar`/`chart` → `bars`, `axes`/`plot`/`arcgraph`
→ `graph`, `quadrant`/`grid` → `matrix`.

### graph shapes

`shape` is one of `rise`, `fall`, `peak`, `scurve`, `exp`, `linear`. Omit it and
`curveShape()` reads it off the title and items — "levels off" gives `scurve`,
"rises then falls" gives `peak`, "declines" gives `fall`.

`items` label up to three points along the line, in order: early, middle, late.

### bars

Every item must carry a number: `"Nitrogen: 78"`, `"Oxygen 21%"`, or
`{label: 'Argon', value: 0.9}`. `valueOf()` parses a trailing number with an
optional unit. Fewer than two parse → `buildBars` returns null and the caller
falls back to `flow`.

**Careful upstream:** `dgLabels()` trims a label at its first clause so boxes
stay readable. It deliberately does *not* trim when the clause is only a number,
because that once turned `"Nitrogen: 78"` into `"Nitrogen"` and quietly demoted
every chart to plain boxes.

### Label length

Node labels are wrapped by `wrap()` to 2-3 lines and then **ellipsized** —
visibly, with a `…`, on the principle that a silently clipped label reads as a
complete and wrong one. In practice a `flow` box holds roughly 40-45 characters
and a `compare` bullet a little more.

A whole rule does not fit in a box. "Signed, it is law. Vetoed, two-thirds of
both chambers can still override" came out as "Signed, it is law. Vetoed,
two-thirds of…". Keep each label to a short phrase and put the qualification in
a second diagram or the card's caption. Check for `…` in the rendered text —
`Array.from(svg.querySelectorAll('text')).map(t => t.textContent)` — rather than
counting characters by eye.

### venn

Model-driven only. `specFromDayStructure` will never choose it from a flat list,
because deciding which side each item belongs on would assert something the
notes never said.

## The 21 curated templates

`brain`, `neuron`, `atom`, `supply-demand`, `dna`, `ecosystem`, `water-cycle`,
`mitosis`, `memory-model`, `plate-tectonics`, `photosynthesis`, `forces`,
`wave`, `circuit`, `number-line`, `fractions`, `place-value`, `area-model`,
`triangle`, `states-of-matter`, `solar-system`.

Matched on topic text with `[-_]` flattened to spaces, so both `water-cycle` and
`"the water cycle"` hit. Every name here must also appear in `app.html`'s
template list, or the generator can never ask for it.

## Primitives

Inside the kit (script block 1):

```js
T(x, y, str, {anchor, size, weight, fill})   // one line of text, esc()'d
multiT(cx, cy, lines, opts)                  // centred block of lines
roundRect(x, y, w, h, r, colour, strokeW)    // colour is a palette entry
arrow(x1, y1, x2, y2)                        // straight, arrowhead at the end
open(w, h)                                   // <svg> with arrow defs
titleBlock(title, w)                         // -> {svg, h}; h is 6 when no title
wrap(text, maxW, size, weight, maxLines)     // -> array of lines
measure(str, size, weight)                   // px width, real DM Sans metrics
widestLine(lines, size, weight)
pal(i)                                       // {s: stroke, f: fill, t: text}
r1(n)                                        // round to 1dp
```

Constants: `MARGIN` 14, `TITLE_SIZE` 13, `NODE_SIZE` 11, `SUB_SIZE` 9,
`INK` `#1a1d2e`, `MUTED` `#6b7280`, `RULE` `#cbd5e1`.

Palette rotates through seven: blue `#4a7cf6`, teal `#38bfa1`, violet `#7c3aed`,
amber `#f59e0b`, pink `#ec4899`, cyan `#0891b2`, red `#ef4444`.

## Hand-drawn templates

Written as raw SVG strings inside `curatedDiagramSVG`, using its own local style
constants rather than the kit's:

```js
var LF = "font-family:'DM Sans',sans-serif;";
var LS = 'font-size:9px;';                    // secondary label
var LP = 'font-size:10px;font-weight:600;';   // primary node label
var LT = 'font-size:8px;';                    // micro annotation
```

Shape: `<svg viewBox="0 0 W H" width="100%" style="max-width:...px;display:block;margin:0 auto;' + LF + '">`.

Give the viewBox headroom when a label sits above the artwork — `viewBox="0 -16 380 236"`
is how `plate-tectonics` fits its fault label. `polish()` uncrops too, but
building it in is clearer.
