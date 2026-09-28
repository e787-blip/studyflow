# Morning check log

Newest run first. Each morning adds one short entry and updates the backlog.

## Visual backlog

Top first. One item per morning. Tick it when done and say which run did it.

- [ ] **Walkthroughs with no picture still use the old text board**, which is
      sized for every row and shows one - a line of text over a screen of
      empty card (match, matchpairs, sentence and trace-table questions, and
      any question the lesson's picture does not cover). Give them the
      picture walkthrough's layout (`sfPicWalkRender`, `.pw-*`) without the
      picture: steps growing under each other, one tap each.
- [ ] **"Picture it" on the flashcard deck's back face** - a drawing of the
      concept, through `SFDraw.request` like `requestMomentArt`. A concept,
      not a question, so invariant 7 does not bite. Spends from the picture
      budget.
- [ ] **Dark mode sweep of every visual card at 320px**: lesson card, deck,
      worked board, picture walkthrough, labelling card, results slots.
      Screenshot each; fix anything unreadable or off-palette.
- [ ] **`workedExample.line` has no validator behind its 40-character cap**
      (live output broke it 2 of 4 times). Shorten or wrap it in `app.html`'s
      validator so the board's line never shrinks below phone size.
- [ ] **Concept-only days lean on `progressStrip`** - about half their rows
      have no picture. See CLAUDE.md Open items; a model `visual` is the fix.
- [ ] **The picture walkthrough's "In the picture" step** names the blue part
      only in general ("the part drawn in blue"). Read the blue labels out of
      the drawing and name them ("Look at the valve, in blue").

## Found, not fixed

(Anything a run found but did not get to. The next run starts here.)

## Runs

### 2026-09-28 - set up
The suite was moved into the repo (`scripts/run_all.sh`, 17 checks, all green
on main at `1e90cf4`). Checked that it catches real breakage: a syntax error
in `lesson.html` fails parse and every browser test; switching off the
"each picture once" rule fails the picture budget (60% of cards, 16 repeats).
The live site is blocked by this environment's network policy (`000`).
