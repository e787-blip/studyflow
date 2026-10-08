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

### 2026-10-08 - every language, not just Spanish (asked for)
17 languages through the plan builder and lesson (`test_languages.js`, fails
13 ways on the code before). Fixed: CJK fill-ins and dictations dropped by
length/spacing rules; French elided dictation; Japanese dakuten graded wrong
instead of prompted; Russian/Hawaiian/Hindi/Mandarin/Turkish/Dutch plans
filed general (title-led match only, so history titles keep history).

### 2026-10-08 - "do the new cards actually show up?" (asked for, not a morning run)
Built history and Spanish plans in the real plan builder (every day's reply
filled in from the exact question list its prompt asked for) and ran every
day in the lesson page, with the notes-map call composing, naming a premade
shape, and failing. Found: a composed history day asked for none of the
three history cards; a composed Spanish day had no dictation, and a vocab
part listed as `categories` lost its sentence builder too; with the map
failing, the French Revolution went to civics on every day (era had no
terms) and never got "Then and now". Fixed in `sf-topics.js`
(`FAMILY_FIRST`, language parts always have `sentences`) and `app.html`
(era terms). New `test_e2e_cards.js` (fails 8 ways on the old code);
`check_topics.js` and `test_history.js` extended.

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
