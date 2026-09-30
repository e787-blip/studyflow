# Morning check log

Newest run first. Each morning adds one short entry and updates the backlog.

## Visual backlog

Top first. One item per morning. Tick it when done and say which run did it.

- [x] **Walkthroughs with no picture still use the old text board** (2026-09-30: `kind:'text'`, and every walk says the answer), which is
      sized for every row and shows one - a line of text over a screen of
      empty card (match, matchpairs, sentence and trace-table questions, and
      any question the lesson's picture does not cover). Give them the
      picture walkthrough's layout (`sfPicWalkRender`, `.pw-*`) without the
      picture: steps growing under each other, one tap each.
- [ ] **"Picture it" on the flashcard deck's back face** - a drawing of the
      concept, through `SFDraw.request` like `requestMomentArt`. A concept,
      not a question, so invariant 7 does not bite. Spends from the picture
      budget.
- [~] **Dark mode sweep of every visual card at 320px** (2026-09-30 at 390px: lesson art, labelling card, graded menus, feedback, results, worked-board heading fixed; 320px not yet swept): lesson card, deck,
      worked board, picture walkthrough, labelling card, results slots.
      Screenshot each; fix anything unreadable or off-palette.
- [x] **`workedExample.line` has no validator behind its 40-character cap** (2026-09-30: split at a clause break, never an equation)
      (live output broke it 2 of 4 times). Shorten or wrap it in `app.html`'s
      validator so the board's line never shrinks below phone size.
- [ ] **Concept-only days lean on `progressStrip`** - about half their rows
      have no picture. See CLAUDE.md Open items; a model `visual` is the fix.
- [x] **The picture walkthrough's "In the picture" step** (2026-09-30) names the blue part
      only in general ("the part drawn in blue"). Read the blue labels out of
      the drawing and name them ("Look at the valve, in blue").

## Found, not fixed

(Anything a run found but did not get to. The next run starts here.)

## Runs

### 2026-09-30 - the visual pass (asked for, not a morning run)
Walked whole sessions at 390px, light and dark, and looked at every card.
Fixed: faux-bold serif headings (lesson + dashboard); dark-mode drawings on a
black ground (title invisible, labels smeared) - now paper; unreadable graded
menus in dark mode; eleven chip colours -> one blue + a difficulty meter;
purple UI accents -> blue/slate; the "slow down" banner firing off the
pre-test and staying on every card; results: 0% on an orange slab -> a ring,
duplicate questions in "What to study more", "Your answer: Check answers" /
"—"; text-only walkthroughs; bigger label pins; worked-example line cap;
dashboard header wrapping, dark ring number, orphan tile. New
`test_visuals.js` (fails 12 ways on the old code); `test_moment.js` updated
for the de-duplicated list. Suite 20/20.

### 2026-09-28 - set up
The suite was moved into the repo (`scripts/run_all.sh`, 17 checks - 18 with the plan builder's review test added 2026-09-29, all green
on main at `1e90cf4`). Checked that it catches real breakage: a syntax error
in `lesson.html` fails parse and every browser test; switching off the
"each picture once" rule fails the picture budget (60% of cards, 16 repeats).
The live site is blocked by this environment's network policy (`000`).
