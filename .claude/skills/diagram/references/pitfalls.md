# Diagram pitfalls

Every one of these shipped. Every one read as correct code. They are grouped by
what makes them invisible, because that is the part worth internalising — the
fix is usually one line, but noticing is the whole problem.

## Geometry that lies

### A Bézier does not pass through its control point

On `Q(p0, c, p1)` the curve peaks at the *midpoint x*, at

```
y = 0.25·p0y + 0.5·cy + 0.25·p1y
```

With a rest line at y=108 and controls at 40 and 176, the crests sit at y=74 and
the troughs at y=142 — not at 40 and 176, and not at the segment ends.

**Symptom:** the wave template's "crest" and "trough" dots sat on the zero
crossings, labelling the two points on the wave where nothing happens.

Compute the peak. Do not eyeball the control point.

### Text on a curve you drew yourself

A caption placed at a plausible-looking coordinate is placed *relative to
nothing*. The solar-system note sat at `(40, 176)`, and the outer orbit ellipse
passes through x=66..174 at that height — so the sentence was struck through by
the orbit it described.

Before placing free text, work out what else occupies that band. When a ring or
curve is nearby, put the text in a caption block outside it rather than trying
to thread the gap.

### Default text anchoring runs right

`<text x="30">battery</text>` starts at x=30 and extends *right*. Placing a
label to the left of something means `text-anchor="end"` with x at the label's
right edge — otherwise it grows into whatever it was labelling.

**Symptom:** the circuit's battery label sat on top of the battery symbol.

## Silent fallbacks

The kit is built to decline rather than draw an empty frame. That is correct,
but it means a broken input produces a *plainer diagram*, not an error — so the
failure looks like a design choice.

### A name that matches nothing

Templates match on text with `[-_]` flattened to spaces. Before that
normalisation existed, `water-cycle` and `plate-tectonics` — the exact names the
prompt tells the model to use — matched nothing and fell through to a generic
auto-built diagram. It went unnoticed for a long time because the fallback
always drew *something*.

Test a template by its exact hyphenated name, not by a spaced phrase that
happens to work.

### Data trimmed away upstream

`dgLabels()` cuts a label at its first clause so a node stays readable. That
turned `"Nitrogen: 78"` into `"Nitrogen"`, which left `buildBars` with nothing
to measure, so it declined, so every chart rendered as a row of plain boxes.

When a layout needs particular data, check the data still has it *at the point
the builder sees it*, not where you wrote it.

### A field nothing reads

`day.visual` was requested by the prompt, validated in `app.html`, and consumed
only by `fromDay()` — which returns null on every subject. A whole diagram spec
was generated and discarded on every day of every plan.

If you add a field, grep for who reads it.

## Load order

`init()` sat inline at the end of script block 1. `window.SFWhiteboard` is
defined in block 2, which has not parsed yet — so `buildOpeningBoard()` found
nothing, its try/catch returned null, and the opening whiteboard was dropped
from every session ever built. Silently, while the module tested fine when
called from the console.

Anything in block 1 that touches `SFWhiteboard` must run after
`DOMContentLoaded`. And a diagram that works when you call it by hand may still
never appear in a real session — load the page and look.

## Saying the same thing twice

Hub layouts (`concept`, `parts`) draw a centre and spokes. Passing the topic as
both `title` and `center` printed it above the drawing and again inside it. The
lesson card already captions the diagram underneath, so the hub keeps the name
and the title goes empty.

## Precedence between shapes

`dgLayoutFor` returns the first pattern that matches, so a phrase matching two
patterns goes to whichever is tested first. "two axes" matches both the graph
pattern (`\baxes\b`) and the matrix pattern (`two axes`) — with graph first,
every two-by-two classification was drawn as a line chart.

Order the tests most-specific first, and when adding a pattern, check what else
already matches the phrases you are adding.

## Ordering cards graded against arbitrary data

Not a drawing bug, but the same family. `checkSequence` compares the learner's
order against `q.items` verbatim, so whatever the card was built from *is* the
answer key. An ordering card built from `day.keyTerms` therefore graded against
the order the model happened to list the vocabulary in — marking the learner
wrong for 23 of 24 arrangements of four terms that have no order at all.

A visual that is also assessed must be built from content that genuinely has the
property being assessed.
