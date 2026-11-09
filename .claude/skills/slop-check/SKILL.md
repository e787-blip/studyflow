---
name: slop-check
description: Check a StudyFlow page for AI-design slop (defaults nobody chose), count the measurable tells, and fix them. Use when asked whether a page looks AI-made, generic, templated or "slop", when redesigning or adding a marketing section, and before shipping any change to index, about or pricing.
---

# Slop check

A tell is **a default nobody chose**, not proof a model made the page. A gradient,
a serif, a card is fine when it belongs to this product. The question for every
hit: *did a person choose this for StudyFlow, or did it arrive by default?*

StudyFlow's own choices (do not "fix" these; `CLAUDE.md` wins): Instrument Serif +
DM Sans, the one blue `#4a7cf6`, the ruled notebook paper, the falling-paper hero,
the hold-to-build demo, the app-card mockups (they are the real card styles).

## 1. Measure

Serve the repo (`python3 -m http.server` from a folder you can read), open the page,
then load the script and read the result:

```js
var s = document.createElement('script'); s.src = '/.claude/skills/slop-check/audit-slop.js';
document.body.appendChild(s);          // then read:  window.__slop
```

It counts 13 tells with thresholds and gives a band (pixelslop's scale):
0-1 CLEAN, 2-3 MILD, 4-6 SLOPPY, 7+ TERMINAL. The tells: gradient text, an italic
accent word in headings, tracked all-caps labels, hero metrics (big number + small
label), backdrop blur, glow gradients, infinite animations, count-up stats, border
plus wide shadow, pill controls, icon above heading, dot-grid textures, one reveal
on everything.

Results on 2026-11-09 (before -> after the de-slop pass): landing 10 -> 2, Our story
6 -> 3 (rest are hidden elements the script still sees), Plans 6 -> see git log.
The two left on the landing are the uppercase tags inside the app-card mockups,
which copy the real app.

## 2. Look, because counts miss things

These are not countable and were found by looking:
- **The page order is the stock SaaS template** (hero, stats strip, 3 steps, mock,
  research, features, 3 pricing cards, FAQ, gradient CTA). Reorder around what is
  specific to StudyFlow.
- **Every feature gets exactly three bullets.** Vary length; drop the list when the
  paragraph already says it.
- **An initial in a circle as an avatar** is a placeholder. Use a real photo or none.
- **Invented proof**: stats, ratings, school names, percentages a source does not
  state. Worse than any visual tell. Delete any number you cannot source.
- **Generic headlines** that fit any company. Write what the button does.
- **Phone width**: fanned or overlapping cards collide on a 375px screen.

## 3. Fix, in this order of payoff

1. Remove invented claims.
2. Make headings plain; keep one italic accent at most (the hero).
3. Cut eyebrow labels and badges above headlines; keep labels that label real data.
4. Remove glow blobs, blur/glass, dot textures, running lights, pulsing dots,
   count-ups, and the same word-by-word reveal on every heading.
5. Flat closing band, blocky buttons (12px, matching the nav), no coloured glow
   shadows, border OR shadow on a card, not both.
6. Add what no template has: a real screenshot, a real photo, a line in the
   founder's own voice.

## Sources (read 2026-11-09)

- Impeccable slop catalogue: https://impeccable.style/slop
- pixelslop pattern catalogue (the thresholds): https://cdn.jsdelivr.net/npm/pixelslop@0.3.8/dist/skill/resources/ai-slop-patterns.md
- Capital & Compute, fix AI slop tell by tell: https://capitalandcompute.net/blog/fix-ai-slop-design/
- UX Collective, how to de-slopify your designs: https://uxdesign.cc/how-to-de-slopify-your-designs-4c40c57c1dc9
- Anthropic's frontend-design skill (avoid generic AI aesthetics)

Caveat from the sources: these are vendor and community heuristics, not measured
standards. Filters alone make a page correct and forgettable; a page that looks
chosen still needs a reason to exist.
