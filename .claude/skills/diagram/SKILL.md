---
name: diagram
description: Build a correct, legible SVG diagram for any topic in StudyFlow — on demand, from the material itself, rather than reaching for a pre-written template. Use this whenever a diagram, chart, graph, visual, illustration or "picture of how X works" is wanted; whenever adding or changing anything in curatedDiagramSVG or SFDiagramKit in lesson.html; whenever a lesson, whiteboard scene or question card needs a visual; and whenever a diagram looks wrong, cramped, mislabelled or empty. Also use it when the request is only implicitly visual — "show me how this works", "make this clearer", "students can't picture it".
---

# Making a diagram

The job is a picture that teaches something true, drawn from the material in
front of you. Not a decoration, and not a shape you had lying around that the
topic was bent to fit.

Two failure modes, both common, both worth naming up front:

- **A diagram that is technically fine and says nothing.** Four key terms in
  four boxes with arrows between them is not a diagram of anything — the arrows
  assert an order that does not exist. If the material has no shape, say so and
  draw nothing. A missing diagram costs a little; a confidently wrong one
  teaches the wrong thing.
- **A diagram that looks right in the source and is broken on screen.** Nearly
  every diagram bug in this codebase read as correct code. See "Verify by
  looking" below — it is the single most important section here.

## 1. Find the shape of the material

Do not start from the subject. Start from what the content *is*. The shape is a
property of the material, and picking it is most of the work:

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
builders already decline and fall back for this reason — do not defeat that by
inventing values or guessing which side an item belongs on. Guessing makes the
diagram state something the notes never said, which is worse than a plainer
picture.

When nothing fits, `concept` around the topic is the honest default.

## 2. Use the kit before writing SVG by hand

`SFDiagramKit` in `lesson.html` (script block 1) already solves text wrapping,
box sizing, collision, palette and viewBox fitting. Building a spec and handing
it over gets all of that free:

```js
generateDiagramSVG({ type: 'custom', layout: 'flow', title: 'Photosynthesis',
                     items: ['Light absorbed', 'Water split', 'Glucose made'] });
```

Read `references/kit.md` for every layout, its required fields, and the drawing
primitives.

**Hand-draw only when the topic has a real physical form** that no generic
layout captures — an atom, a circuit, a free-body diagram, a wave. Those become
templates in `curatedDiagramSVG`. Everything else is a spec.

Before adding a template, check one is not already there: there are 21, and they
match on the topic text with hyphens flattened to spaces.

## 3. Verify by looking

**Render it and look at it. Every time. No exceptions.**

This is not caution, it is the lesson of every diagram bug in this file. Each of
these read as correct code and was wrong on screen:

- a wave's crest marker on the zero crossing, because a quadratic peaks at
  `0.25·p0 + 0.5·c + 0.25·p1` and not at its control point
- a battery label overlapping its own symbol, because default text anchoring
  runs *right* from `x`
- a caption struck through by the orbit ellipse it described
- a hub diagram printing its topic twice, as title and as hub
- a bar chart silently rendering as plain boxes, because the numbers had been
  trimmed off the labels upstream

None of these were visible by reading. All were obvious in one screenshot.

```bash
python3 .claude/skills/diagram/scripts/preview_diagrams.py specs.json -o /tmp/preview.html
```

That writes a standalone page containing the real kit from `lesson.html` with
every spec rendered and labelled. Open it in the browser and screenshot it.
`specs.json` is a list of `{"name": "...", "spec": {...}}` — a spec object, or a
plain topic string to exercise the curated matcher.

What to look for, in order:

1. **Is every label readable and clear of everything else?** Text on a line, on
   a shape, or on other text.
2. **Do the marks sit where the geometry says?** Peaks on peaks, arrows
   connecting the things they claim to connect.
3. **Does it say something true?** Would a student who trusted it be right?
4. **Is anything clipped at the edges?** `polish()` uncrops, but check.

## 4. House constraints

- **ES5 only** in `lesson.html` — `var`, no arrow functions, no template
  literals. Match the surrounding code.
- **Escape anything from the model or the user** with `esc()` before it enters
  SVG.
- **Never put an answer in a diagram** that the learner is about to be asked
  for. The opening whiteboard once printed worked solutions to the first two
  questions of the session. Worked answers belong on the wrong-answer board,
  after the learner has committed.
- **Comments explain why**, especially where the reason is not obvious from the
  code. Several existing comments record bugs that were fixed — leave them.

Palette, fonts and primitives: `references/kit.md`.
The specific traps, each with its symptom: `references/pitfalls.md`.

## 5. Before you call it done

- [ ] Rendered and looked at it, not just read the code
- [ ] Every label clear of every line, shape and other label
- [ ] The shape matches what the material actually is
- [ ] Nothing invented — every label traceable to the source material
- [ ] No answer to an upcoming question visible
- [ ] Falls back gracefully when its data is missing, rather than drawing a frame
- [ ] If it is a new template: reachable by its exact hyphenated name, and named
      in `app.html`'s template list so the generator can ask for it

The last one is easy to miss and fails silently: a name in the prompt with no
matching template just quietly produces a generic diagram instead.
