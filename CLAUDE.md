# StudyFlow

AI study-plan app. A learner describes what they need to study; the app generates a
multi-day plan and runs each day as a card-by-card session (lesson → whiteboard →
practice questions → recap).

Built by a 7th grader at Punahou School. Prefer complete file edits over long
multi-step terminal workflows.

## Stack

| Piece | What |
|---|---|
| Frontend | Vanilla HTML/CSS/JS. No build step, no framework, no bundler. |
| Hosting | Vercel — `studyflow-ten-vert.vercel.app` (also pushed to GitHub Pages) |
| Backend | Vercel serverless, `api/*.js`, uses `module.exports` (not ESM) |
| AI | Anthropic API, `claude-haiku-4-5`, key in `ANTHROPIC_API_KEY` env var on Vercel. `api/generate.js` caps the prompt at 60 000 chars — the whole prompt must fit, because the JSON schema sits at the end of it. |
| Auth | localStorage only. Accounts in `studyflow_accounts`, session in `studyflow_user` |
| Storage | All plan data in localStorage, namespaced per account via `SFStore` |

There is no test runner, no `package.json` for the frontend, and no lint config.
Each HTML file is self-contained: markup, CSS and JS in one file.

## Files

| File | Size | Role |
|---|---|---|
| `index.html` | ~130 KB | Marketing / landing page |
| `app.html` | ~172 KB | Plan generation. Subject detection, AI prompt, question schemas, validators |
| `lesson.html` | ~590 KB | The session runtime. Card queue, all question renderers, the whiteboard |
| `dashboard.html` | ~101 KB | Plan list and progress |

`lesson.html` has **two `<script>` blocks**. Block 1 is the session runtime.
Block 2 is the whiteboard module (`window.SFWhiteboard`). Both must stay
syntactically valid — a break in either kills the session silently.

**Block 1 must not use `window.SFWhiteboard` at parse time.** Block 2 has not run
yet. `init()` is therefore deferred to `DOMContentLoaded` at the end of block 1;
do not move it back inline. It was inline for a long time, and the effect was that
`buildOpeningBoard()` found no `SFWhiteboard`, caught the miss, returned null, and
the opening whiteboard card was dropped from every session ever built — silently,
while the module itself tested fine from the console.

## Design system

- Brand blue `#4a7cf6`, ink `#1a1d2e`
- Fonts: Instrument Serif (headings), DM Sans (body)
- Card hover: blue border only. **No pop/scale transform** — this was a deliberate
  decision, don't reintroduce it.
- **The streak mark is monochrome**, sized and shaped like the score pill beside
  it. It was a 44px orange-to-red gradient flame with the count reversed out in
  white — the loudest thing on a page whose palette is one blue. At 14px the
  flame keeps its inner tongue on purpose: the simplified outline read as a
  water droplet.
- **No amber on either whiteboard** (the lesson-card `supply-demand` chart is
  the one deliberate exception: demand is red, supply is blue, and amber marks
  the equilibrium between them — recolouring it would collide with a curve).
- **No amber on either whiteboard.** It was in three places and only fixing all
  three worked: `SFBoard`'s accent (`ACCENT` was Accent Gold), the OUT column of
  `SFStepVisual.inOut`, and — the one that kept it coming back — the 4th entry
  of `SFDiagramKit`'s `PAL` rotation, which any diagram with 4+ items handed a
  node to. Amber stays where it *means* something: hints, flagged questions, the
  unsure button, the struggling header. Check by rendering and scanning output
  for hues 25–70°, never by grepping source.

## Pricing

| Plan | Price | Limits |
|---|---|---|
| Free | $0 | 1 plan/month, 7-day max |
| Pro | $7.99/mo | 5 plans, 14 days |
| VIP | $14.99/mo | Unlimited + AI chat |

---

## How a session is built

`buildQueue()` in `lesson.html` assembles `sessionCards` from `day.questions`.
This is the highest-risk function in the codebase. Read it fully before editing.

The flow:

1. Opening cards — welcome, lesson, flashcards, whiteboard **worked**
   (see "The opening, and what it stopped saying three times")
2. Pre-test (day 1 only) — 3 questions drawn from `simpleQuestions`
3. Main loop over `regularQuestions` (everything **not** in `SPECIAL_TYPES`)
4. Targeted injectors splice in each special type at fixed positions
5. `applyFeynmanOrder()` adds two "teach it back" write cards

### The SPECIAL_TYPES rule

```js
var SPECIAL_TYPES = { fill:1, bigequation:1, wordproblem:1, errorspot:1,
                      passage:1, sentence:1, write:1, classify:1,
                      scenario:1, sequence:1 };
```

**Any question type that has its own injector MUST be listed here**, and must also
be listed in `SPECIAL_TYPES_PRETEST`. Omitting one means the main loop queues it
*and* the injector splices it again — the learner sees the same question twice.
This is exactly how `sequence` got duplicated on every history and geography day.
Keep the two lists identical.

### Subject → question type matrix

10 subject types, **18 question types**. Schemas live in `app.html`.

The original 12 are `mcq`, `truefalse`, `fill`, `write`, `classify`, `sequence`,
`sentence`, `passage`, `errorspot`, `scenario`, `wordproblem`, `bigequation`.
Six more were added for formats those could not express — see
**Extended formats** below.

| Subject | Types generated |
|---|---|
| math | bigequation ×6, errorspot, wordproblem |
| science | mcq ×2, truefalse ×2, fill ×2, classify, sequence, write |
| psychology | mcq ×3, truefalse ×2, scenario, fill ×2, write |
| geography | mcq ×3, truefalse ×2, classify, sequence, fill ×2 |
| economics | mcq ×3, truefalse ×2, scenario, wordproblem, fill ×2 |
| cs | mcq ×3, truefalse ×2, errorspot, classify, fill, write |
| history | passage ×3, mcq ×2, truefalse, classify, sequence, fill |
| english | passage ×3, mcq ×2, truefalse, write, fill ×2 |
| language | sentence ×2, mcq ×3, truefalse, fill ×3 |
| general | mcq ×3, truefalse ×2, fill ×2, write |

Math carries no MCQ on purpose — see invariant 1. Science's `sequence` replaced a
third MCQ when the synthetic key-terms ordering card was removed (invariant 6).

Every type has a renderer (`renderFill`, `renderBigEquation`, `renderPassage`,
`renderErrorSpot`, `renderSentence`, `renderSequence`, `renderMatch`,
`renderWrite`, `renderClassify`, `renderScenario`, `renderWordProblem`,
`renderGraph`, `renderQuestion`) dispatched by `card.type` in `renderCardInner`.

**If you add a question type, you must touch eight places.** The old note said
four; four is what the compiler would catch if this had one. The full list:

1. `qtpl()` in `app.html` — the JSON fragment. Its shape must match the
   renderer field for field.
2. `QTYPE_NAME` in `app.html`, or the quota line prints a raw slug.
3. A branch in `sanitizeDayQuestions` in `app.html`. Without one the type falls
   through to the unknown-type catch-all, which only checks that question text
   exists — so a malformed card reaches a renderer intact.
4. `SPECIAL_TYPES` **and** `SPECIAL_TYPES_PRETEST` in `lesson.html`, identical.
5. `DIRECT` in `cardTypeFor`, or the card is served as a generic question.
6. An injector in `buildQueue` — ungated on subject.
7. A renderer plus its `renderCardInner` dispatch case.
8. A `feynmanConcept()` case, or the teach-it-back card prints the raw stem
   (invariant 4).

Anything with its own check button also belongs in `submitControl()`'s id list,
or Enter and Cmd-Enter will not reach it.

### Extended formats

Six formats, each a distinct interaction rather than a relabelled MCQ, and each
reused across every subject whose material has that shape. That is why there are
six rather than one per subject — two-tier diagnostics (science) and
evidence-based selected response (English) are the same card.

| Type | Interaction | Used by |
|---|---|---|
| `twopart` | Part A answer, then Part B reason or text evidence; Part B is hidden until A is committed, and credit needs both | science, english, history, psychology, economics, geography, cs, language, general |
| `corroborate` | two short sources side by side, asked what they disagree about | history, english, science, psychology |
| `highlight` | pick the one sentence that carries the evidence | english, history, geography, cs, language, general |
| `tracetable` | run a procedure by hand, filling one column of a table | cs, science, economics |
| `matchpairs` | model-authored matching, one `<select>` per row | every subject except math |
| `estimate` | a number judged inside a tolerance band | math-adjacent subjects: science, geography, economics, cs, psychology |

**Math deliberately uses none of them.** Its mix is governed by `MATH_MIX` and
the synthesis floor, and adding a non-core type lowers the solving share — the
same reason invariant 1 forbids adding to `MATH_CORE_TYPES`.

Two gotchas already paid for:

- **Option lists need `<div class="q-options">` around them.** A bare `<button
  class="q-option">` sizes to its text; the full-width look comes from that
  wrapper being a column flexbox.
- **`esc()` in block 1 replaces newlines with spaces** — it is written for
  attribute and JS-string contexts. It collapsed a whole procedure onto one line
  inside `tracetable`'s `<pre>`. Escape line by line and rejoin.

### Subtopics

A subject is not one kind of knowledge, so the matrix above is the **fallback**,
not the whole story. `SUBTOPICS` in `app.html` splits the nine non-maths
subjects into 25 subtopics, each with its own mix, its own "ask this / avoid
that" guidance, and the diagram shape that suits the material:

| Subject | Subtopics |
|---|---|
| science | life · physical · earth |
| english | reading · grammar · literature |
| history | civics · social · era |
| geography | physical · human · maps |
| psychology | methods · bioCog · social |
| economics | personal · macro · micro |
| cs | programming · algorithms · systems |
| language | grammar · reading · vocab |
| general | study |

`resolveSubtopics(subjectType, subjectText, notes)` returns the subtopics a
plan actually covers, best first. Each subtopic scores its `terms` against the
subject line (counted triple — it is what the learner meant) and the first 3000
characters of the notes. A runner-up joins the list only with a score of 2+ and
at least half the leader's, so one stray word cannot split a plan that is
really about one thing. Ties break on declaration order, so **the narrower
subtopic is listed first** — the same ordering trap as the humanities and
language classifiers below. An entry marked `fallback:true` is used only when
nothing matches.

**Days are dealt round-robin across that list.** All days generate in parallel
from `subjectType` alone and no day knows its own title yet, so this is how a
plan covering both reading comprehension and comma splices teaches each on its
own days instead of averaging them. `generateDay` picks
`subtopics[(dayNum - 1) % subtopics.length]` and uses that subtopic's guide.

`terms` are regex fragments, not literals. A term of five characters or more
matches any suffix (`variable` catches `variables`, `develop` catches
`developmental`); shorter ones stay exact, or `map` would match `maple`.

The evidence these mixes rest on, and the three things it does **not**
establish, are in [docs/question-design.md](docs/question-design.md).

Maths has no subtopics on purpose: its mix is governed by `MATH_MIX` and the
synthesis floor, and `picked.subtopic` is forced null for it.

Two things follow from how mixes are written:

- A mix is a **list of type names** (`['passage:inference', 'fill', ...]`) and
  `buildQuestionSchema` generates the JSON from it. Only the twelve types with
  renderers are valid; a name with no renderer is queued and silently skipped.
- The quota line the model reads is counted by `tallyFor()` from that same
  list, so the tally and the schema cannot drift apart. They were two
  hand-maintained strings, and a tally disagreeing with the schema reads to
  the model as permission to improvise.

Adding a subtopic is a `SUBTOPICS` entry and nothing else. Adding a question
*type* is still the four-place job described above.

### `concepts[].visual` — a picture per main idea

The main-ideas card draws one row per concept and asks each for its own
diagram spec. Shape, and the only layouts kept:

```json
"concepts": [{ "name":"", "definition":"", "why":"", "misconception":"",
               "visual": { "layout":"flow|timeline|compare|parts",
                           "items":["",""], "center":"" } }]
```

The validator drops anything else: a layout outside that set, fewer than two
items, or a `parts` with no `center`. Dropping it is the right outcome — the
row then falls back to what `lesson.html` can infer from the words, which beats
a spec the kit would decline anyway.

`why` is folded into the row's detail text as well as displayed, because the
visual chooser reads that same text: "Demand / Quantity buyers purchase at each
price" has no relationship in it, and the `why` that follows — "It falls as
price rises" — is exactly what `trendGraph` needs. Dropping `why` meant the
economics ideas could never be drawn.

### `workedExample` — generated with the lesson

`app.html`'s prompt asks for one on every day, and its validator keeps it only
when at least two steps carry a real line:

```json
"workedExample": { "problem": "", "steps": [ {"title":"", "line":"", "why":""} ] }
```

`line` is printed large, so it is capped at 40 characters in the prompt. The
prompt also states the rule the whole feature rests on: **the example must not
be any of the day's questions, or share their numbers or answers.**

Three files move together here: the prompt text, the output schema string, and
the validator. Add the field to the prompt but not the schema string and the
model never returns it — silently, because `workedFor` just falls through to
the day's steps and the board still looks fine.

### Subject classification

`resolveSubjectType(plan, day)` is the single source of truth. It honours a saved
`plan.subjectType` first, then falls back to text patterns over the subject and
day title.

Two rules that are easy to break:

- **The humanities patterns are tested BEFORE the language pattern, deliberately.**
  The language pattern matches bare nationality words, so while it sat first,
  "Causes of the French Revolution" resolved to `language`, not `history`. Same for
  the German invasion of Poland, the Spanish conquest of the Americas, the Japanese
  occupation of China.
- **`buildQueue`'s `isMath` / `isScience` / `isHistory` / `isEnglish` / `isLanguage`
  flags defer to `qType`**, and only fall back to their own text patterns when
  `qType` is `general`. Those patterns recognise far more arithmetic than the
  classifier does ("Order of Operations", "Long Division", "Rounding"), which is
  why they are kept — but when they were the *only* signal they contradicted
  `qType`. Computer Science matched `isScience` off the word "Science", which is
  the only reason its errorspot was ever queued.

---

## Invariants — do not break these

### 1. Math must stay ~80% solving work, and must not be one shape repeated

```js
var MATH_MIX = { bigequation: 0.80, wordproblem: 0.13 };
var MATH_DAY_QUESTIONS = 12;      // denominator, and the floor on day length
var MATH_CORE_TYPES   = { bigequation: 1, wordproblem: 1 };
```

**Do NOT add `errorspot` or `sequence` to `MATH_CORE_TYPES`.** It looks like a
reasonable idea — error-spotting is solving practice — but `MATH_CORE_TYPES`
drives the *synthesis floor*, not just measurement. Counting more types makes
`enforceFormatMix` think the quota is already met and it generates fewer real
equations. This was tried and reverted.

**Target the two core formats separately.** A single combined floor is what
produced the one-shape day: it counted equations and word problems together, and
the generator only produced a word problem on every third item, so a day short by
one or two got equations and nothing else — always 7 equations, always exactly 1
word problem, whatever the model sent.

A math day should produce **10 bigequation, 2 wordproblem, 1 errorspot**
(≈77% / 15% / 8%), **0 vocabulary match cards, 0 definition sequence cards, 0 fill
cards**. Use that as a regression check. `MATH_DAY_QUESTIONS` is the one number to
change if sessions should be longer or shorter.

### 2. Vocabulary cards must not appear on math days

`match` is gated with `!isMath`. Math has a solving mandate; a "match each term to
its definition" card directly violates it. The gate previously checked only
`keyTerms.length >= 4`, which let math through.

### 3. Every generated question must reach the learner

Fill / bigequation / wordproblem are excluded from the main loop, so they depend
entirely on their injector. That injector was once gated behind `if (isMath)`,
which silently discarded 1–2 fill questions per session on seven subjects and
**every economics word problem, permanently**. The errorspot injector was gated on
`isMath || isScience` and dropped every CS errorspot the moment the subject flags
stopped false-matching. **Injectors should not be gated on subject at all** — a
question of type X exists only because a schema asked for it.

### 4. Feynman prompts must be concepts, not instructions

`renderWrite` shows a "Teach it back" card. It must never print `q.question`
raw — most stems are instructions ("Solve for x", "Sort:", "Find the mistake:")
or fill sentences still carrying blanks. `feynmanConcept()` converts each type:

- bigequation → `Walk through a sample problem: 2x + 3 = 11`
- wordproblem → `Walk through this problem: <scenario>`
- fill → `Explain the definition of: <key term>` (never reveal the answer)
- classify → `The difference between <A> and <B>`
- errorspot → `The most common mistake in <topic>, and how to avoid it`

Also: **don't interpolate raw `day.title` into a sentence.** Titles arrive as
chapter headings ("Algebra: Variables, Expressions, and Equations") and produce
broken grammar. Use `feynmanTopic(dayObj)`, which strips the prefix and truncates
on a word boundary. `applyFeynmanOrder` printed the raw title for a long time.

**`feynmanTopic` also has to split the breadcrumb.** `microTopic` is preferred
over `title` and arrives as a path — `Algebra › Equation solving › Isolating the
variable` — so every prompt spliced the chevrons into the middle of its own
sentence: *"explain Algebra › Equation solving › Isolating the variable in your
own words"*. It now keeps the **last** segment, which is the specific thing the
path narrows to and the only part that reads as English. The welcome card still
shows the whole path: `buildTopicPath` draws it as a stepped trail, which is
what a breadcrumb is for.

`getFeynmanTip()` must have an entry for all 10 subjects.

### 5. Injected cards go in the practice run, never the opening block

`practiceStart` is captured **before** the main loop and every injector places
relative to it via `injectAt` / `injectSpread`. Capture it after the loop and it
points at the end of the question run, which silently disables the spreading.

Injectors used fixed absolute indices for a long time, which assumed the queue
began with question cards. It never does. On day 0 a passage card was spliced
into the middle of the pre-test and the welcome, whiteboard and lesson cards
were pushed to positions 10, 12 and 13 — a learner's first session asked them to
sort and match vocabulary before being taught anything.

`applyFeynmanOrder` shares the trap: pre-test cards are ordinary question cards,
so its scan for "where practice begins" must skip `isPretest` / `isReview` or the
explain-first card lands inside the pre-test.

Fixed offsets also do not survive a short day — three passage offsets all clamp
to the end and the learner reads three passages back to back. Use `injectSpread`
for any group of more than one.

### 6. An ordering card needs content that has a real order

`checkSequence` grades by comparing the learner's order against `q.items`
verbatim — so whatever the card was built from **is** the answer key.

`buildSequenceQuestion` built its items from `day.keyTerms.slice(0, 4)`, meaning
the "correct" order was nothing more than the order the model happened to list the
vocabulary in. It shipped cards like *Chloroplast, Mitochondrion, Glucose,
Stomata* — four terms with no order between them — and marked the learner wrong
for 23 of the 24 arrangements. It was reaching eight of the ten subjects.

That injector is gone. `buildSequenceQuestion` is kept, unused, with a note.
**Ordering cards come only from a model-generated `sequence` question**, which
arrives with a real order and an explanation. To give a subject one, add
`sequence` to its schema in `app.html` — do not re-wire the builder.

### 7. Never leak an answer onto the opening whiteboard

`briefFor` builds the board shown *before* any practice. Its math branch pulls
real equations out of the day's own `bigequation` questions — that is intended,
it is a preview of the shape of the work — but it must not draw the answers. It
used to push `'= ' + q.answer` after each equation, so the opening card displayed
worked solutions to the first two questions the learner was about to be asked.

Worked lines with answers belong on `fromWrongAnswer`, where the learner has
already committed to an answer.

**The opening board now works a full solution, answer and all — and the
invariant still holds, because the problem is not one of theirs.**
`buildParallelMath` synthesises a problem of the same form with different
numbers. The learner sees the whole method; none of their own questions are
spent. See "The parallel maths example" below.

Where the line sits, so this is not re-litigated: the invariant is about a
**computed result** the learner is about to produce, not about vocabulary. A
photosynthesis lesson says "glucose" and one of its fill questions has "glucose"
as the answer — the lesson card and the key-terms card print it too. Teaching
the thing the day is about is the app, not a leak. What must never appear is a
question's stem next to its own answer, or the worked result of a problem in the
queue.

### 8. A question belongs to its subject, and must be framed as its subject

Two things used to drag questions out of their own subject:

- **The fill/bigequation/wordproblem injector re-cast on every subject.** Any
  fill question carrying a number and the words "how many" became a word
  problem, so a science fill about ATP and NADPH counts was served as one. Only
  `QUANTITATIVE_SUBJECTS` (math, economics) may be re-cast now — those are the
  only schemas that ask for these formats.
- **`renderWordProblem` hard-coded the heading "Real world math"**, on every
  subject that produced a word problem. `wordProblemHeading()` names the card
  after the resolved subject instead.

`app.html`'s prompt also carries a QUESTION TYPE LOCK: the per-subject tally
("3 MCQ, 2 True/False...") reads as a suggestion on its own, and the model would
reach for a word problem the moment the notes contained numbers.

### 9. Question badges are chosen in `renderQuestion`, from the card

Pass the card: `renderQuestion(card.q, !!card.isReview, card)`.

Badges used to be patched in afterwards by string-replacing `class="card-tag"` on
the rendered HTML — and `renderQuestion` has never emitted a `card-tag`, only a
`card-badge`. All three replacements silently matched nothing, so the
spaced-repeat, review and pre-test badges were invisible for as long as they
existed. `isReview` was also hard-coded to `false` at the call site.

Current states: plain practice, `isReview` → "Review Question" (amber header),
`isSpacedRepeat` → "Try again", `isRetest` → "You saw this in the pre-test"
(green `retest-header`).

---

## Diagrams

Two separate systems, often confused:

| | Where | Drawn by |
|---|---|---|
| `day.diagram` | the **lesson card**, above the stepped board | `generateDiagramSVG` → `curatedDiagramSVG`, else `SFDiagramKit` |
| the opening board | card 2 of the session | `SFWhiteboard.briefFor` → `SFBoard` scenes |

**Every lesson gets a diagram, built from that lesson.** `diagramForDay(day)`
is the single entry point for the lesson card, and it tries four sources in
order of how specific they are:

1. `day.diagram` — what the model chose deliberately
2. `day.visual` — the second spec the prompt asks for. Nothing read it before:
   its only consumer was the dormant `fromDay`, so a whole diagram spec was
   generated, validated in `app.html`, and thrown away on every day of every
   plan.
3. **the day's own structure** — `steps`, `concepts`, `keyTerms`, `pillars`,
   with the layout chosen from the day's own words (cycle / timeline / parts /
   hierarchy / flow / concept). This is the workhorse: it is drawn from *this*
   lesson's material, so two lessons never get the same picture.
4. the curated matcher, against the topic text

### Who owns the lesson card

`LESSON_CARD_STEPPED` (block 1, near `buildOpeningBoard`) — **`false`**.

Three things could replace that card, and all three did: `SFWhiteboard.fromDay`
(a stepped `SFBoard` scene, fires on the *first* view of a topic),
`whiteboard.js` (a stepped beat-by-beat board, fires always), and the static
card. The session already opens on two stepped boards — the main-ideas card and
the sideways worked example — so a third directly after them meant **three
stepped boards in a row before a single question**, and the third was the
weakest: `whiteboard.js`'s beats are generic kit strips, not the hand-drawn
picture the day actually has.

So the lesson card is the lesson: the picture, then the prose, the steps and
the concepts. Teaching by beats happens on the two cards before it. Set the
flag to `true` to hand the card back — both branches read it and nothing else
needs changing.

### The lesson card is PAGED — `.lp-*` and `sfLessonJump`

Being the lesson does not mean being a column. The card used to append every
block to one body — picture, prose, every step, every concept, every trap, the
case study — which came to **~2 200px on an ordinary algebra day**: half a
minute of scrolling before the first question. Nothing was wrong with any one
block; there were eight of them stacked.

It is now a **spread**: one part at a time, moving sideways, with a rail across
the top saying how many there are and where you are. The longest part of that
same day is **609px**. Deliberately *not* the whiteboard — same prose, same
cards, same picture, no SVG board and no beats. The motion is the only thing
borrowed: a 170ms slide out, the new part rising in on a staggered fade, and
the viewport's height animated between the two.

```
The idea | How it works | Core concepts | More concepts | Common traps | In the real world
```

- **The footer button turns the page.** On every part but the last it reads
  the *next* part's name and advances the pager; only on the last does it say
  "Got it" and leave the card. `sfLessonChrome()` rebinds it after
  `sc.innerHTML` is committed — `buildCard` still hardcodes `showNextCard()`,
  so every other card's footer is untouched.
- **A section longer than a screen becomes two short parts, evenly split.**
  `per` in `lpSection` is a ceiling, not a stride: five steps are 3+2, never
  4+1. A part carrying a single item is a page turn that buys nothing.
- **The rail label IS the section heading.** It was printed twice — once in
  the rail, again as the first line of the part. The label takes the part's
  own tone, which is the only reason a page of traps still reads amber.
- **One part means no pager at all.** A prose-only day renders exactly as it
  always did, with the ordinary footer.
- **A height of zero means nothing is being laid out** — background tab, or a
  `display:none` ancestor (the 10-minute recap overlay does this). Animating
  to it collapses the card to a line, so `sfLessonJump` hands the height
  straight back to `auto` instead.
- **`lpLive()`, not `sfLesson`, is the guard.** The whiteboard cards render
  through `SFWhiteboard`'s own `renderCard` branch, which returns *before*
  `renderCardInner` and so never clears `sfLesson`. "Is there a viewport in
  the document" is the honest test; without it the arrow keys stay bound to a
  lesson the learner walked past two cards ago.

**Three things compete for the lesson card, and all three must keep the
picture.** `SFWhiteboard.fromDay` (block 2's integration layer), `whiteboard.js`,
and the static card. Each replaced the card wholesale, so `diagramForDay` was
computed and discarded by whichever won. `fromDay` is the worst to lose it on:
`shouldTrigger` keys off `firstOpen`, so it fires on the **first** view of a
topic — exactly when the learner has never seen the thing before. There is a
test for all three paths.

**The lesson card keeps its picture even when `whiteboard.js` takes over.**
That branch wins on every subject — `Whiteboard.deriveBeats` returns beats for
all ten — so for a long time `diagramForDay` was called, returned a picture,
and had it dropped on the floor of every lesson ever rendered. The board's own
first beat draws a 558x68 strip from the kit, which is not the same thing and
is not what the hand-drawn templates are for. The diagram is now rendered
above the mount: look at the thing, then step through the explanation of it.

Before this, the lesson card tested `day.diagram.type !== 'none'` — and
`app.html` defaults that field to `'none'`. Any day where the model omitted the
field showed no diagram at all, and nothing reported it, because "no diagram"
looks exactly like "this topic did not need one".

On a hub layout (`concept`, `parts`) pass the topic as `center` and leave
`title` empty — passing both prints the topic twice, once above the drawing and
once inside it. The card captions the diagram underneath anyway.

### `SFSceneKit` — drawing anything, from a spec written with the lesson

The 23 curated templates are hand-drawn and keyword-matched, so they cover 23
topics. A lesson on a trebuchet, the layers of the atmosphere, a sarcomere or
the plot of *Macbeth* gets whichever generic box-and-arrow layout fits least
badly. `SFSceneKit` is the other half: a small drawing vocabulary the **model**
fills in at generation time.

```json
{"type":"drawing","title":"","w":440,"h":250,"shapes":[
  {"s":"rect","x":,"y":,"w":,"h":,"r":8,"fill":"blueFill","stroke":"blue"},
  {"s":"circle"|"ellipse"|"line"|"path"|"poly"|"text", ...}]}
```

**It is deliberately not raw SVG.** Raw SVG from a model is unbounded — script
elements, external references, arbitrary colour, text off the canvas — and none
of that is cheap to check. A fixed vocabulary is:

| Guard | What it stops |
|---|---|
| shape kinds are a whitelist | `<script>`, `<image href>`, `<foreignObject>` |
| colours are **names** from a palette | off-brand or invisible drawings, `url(#…)` |
| every number clamped to the canvas | shapes landing off-screen |
| path `d` grammar-checked (`M L H V Q C A Z` + numbers) | anything that is not a path |
| text escaped and length-capped | markup injected through a label |
| floor of 3 shapes and 1 label | a "drawing" nobody can read |

A spec that fails any of it returns **null** and the caller falls back exactly
as for any other missing diagram. `app.html` validates the same shape before
storing, so a rejected drawing never reaches localStorage — but **the renderer
is the security boundary**, because a plan can be loaded from storage that the
validator never saw. Both must stay.

A drawing **wins over the curated matcher**: a picture made for this lesson
beats a template matched on a keyword.

### Custom layouts

`SFDiagramKit.fromSpec` draws 11, from `{layout, title, items, ...}`:

| Layout | Needs | Falls back to |
|---|---|---|
| `flow` `cycle` `timeline` `hierarchy` | 2+ items | — |
| `parts` `concept` | items + `center` | — |
| `compare` | `left` + `right` | — |
| `graph` | `xLabel`, `yLabel`, `shape`, 1-3 items | always draws |
| `bars` | every item ending in a number | `flow` |
| `venn` | `left` + `right` (+ `shared`) | `compare` |
| `matrix` | exactly 4 items | `concept` |

The last four each **decline** when their data is missing rather than drawing an
empty frame — a bar chart with no numbers is not a bar chart. Keep that: a wrong
layout choice should cost a plainer diagram, never a broken one.

`venn` is model-driven only. `specFromDayStructure` will never pick it from a
flat list of labels, because deciding which side each item belongs on would
state something the notes never said.

Two ordering traps in `dgLayoutFor`, both already fixed, both easy to reintroduce:

- **`matrix` is tested before `graph`.** "two axes" matches both patterns, and
  while graph came first every two-by-two classification was drawn as a line
  chart.
- **`dgLabels` must not cut a trailing number.** It trims a label at its first
  clause, and cutting `"Nitrogen: 78"` at the colon threw the value away — which
  left `buildBars` with nothing to measure, so it declined and every chart came
  out as a row of plain boxes. It now only trims when the clause contains
  letters.

### `SFStepVisual` — a picture for ONE step

`diagramForDay` draws the lesson. `SFStepVisual.forStep(step, ctx)` draws a
single step of a worked example, so a four-step walkthrough gets four different
pictures rather than the same diagram four times.

Four parametric builders, chosen from what the step actually contains:

| Builder | When | Built from |
|---|---|---|
| `balance` | an equation, on a quantitative subject | the two sides, drawn as scales that stay level |
| `jumpLine` | one arithmetic move | the two numbers, as a jump along a line |
| `angleArc` | a named angle | its real measure |
| `inOut` | the step names what goes in and what comes out | the nouns either side of the verb |
| `areaModel` | a step about expanding `a(b + c)` | the bracket, as a partitioned rectangle |
| `trendGraph` | the step claims one quantity moves with another | both axis names, read out of the sentence |
| `bothSidesRule` | a rule naming an operation applied to both sides | the operation, arriving at both pans of a level beam |
| `progressStrip` | anything else | the real step labels, with this one lit |

All of them return null rather than draw an empty frame.

Two ordering rules inside the quantitative branch, both paid for:

- **`areaModel` is tried BEFORE `balance`, but only when the step's TITLE says
  it is expanding.** `2x + 10 = 18` splits into two sides perfectly well, so
  the balance answered first and the one step whose whole point is the
  distribution was drawn as a pair of pans — true, and silent about what just
  happened. Matching the *reason* text instead of the title was worse: a
  distribute problem mentions brackets on nearly every line ("until it is
  expanded", "inside the bracket is 9"), so three steps of five got the area
  model, including the two that want the balance.
- **The bracket comes from `ctx.prevLine` when the step's own line no longer
  has one.** An expand step prints the *result* of the expansion, so the
  bracket it is explaining is the row above.

`trendGraph` names both axes from the sentence — the driver after
*as/when/with*, and the quantity from the step's own title — and declines when
either is missing or the direction is ambiguous. An axis with a guessed name
states something the notes never said.

`bothSidesRule` draws its pans **empty**, and that is deliberate. "Subtract the
constant from both sides" is a rule about an equation nobody has written down
yet, so there is nothing to put in them; the picture asserts exactly what the
sentence asserts — same operation, both sides, balance kept — and nothing more.
Each operation carries its own preposition (`OP_WORD[...].say`), because
building the caption from the matched verb alone produced "Divide **from** both
sides".

### A model-authored picture per main idea

`forStep` prefers `step.visual` over everything it can infer, so the shortest
path to a real picture on every idea is to have the model write one with the
lesson. `app.html` asks for a `visual` on each concept and validates it.

Four things had to line up, and the middle two are the ones that silently
swallow it:

1. the prompt asks for it, and the **output schema string** shows it — a field
   named in the prompt but missing from the schema is never returned;
2. `pair()` in block 2 carries `v.visual` through — it used to flatten every
   item to `{a, b}`, one call before the only thing that reads it;
3. `itemsFromSteps` and `outlineFor` carry it onto the item;
4. the validator keeps only layouts the row can draw legibly — `flow`,
   `timeline`, `compare`, `parts`. `cycle`, `concept` and `hierarchy` are drawn
   tall, so the card's own guard would drop them anyway; rejecting them in
   `app.html` makes that explicit instead of silent, and the prompt says so.

**The 21 curated templates are deliberately NOT in this chain.** Their patterns
are written to match a whole day's topic string, so against one sentence they
fire on a stray word: "it excites electrons and starts the chain" matched the
atom template, and a step about chlorophyll absorbing light was illustrated with
a Bohr model of carbon. It read as a plausible science picture, which is exactly
what made it wrong. They are also drawn 420 units wide with 8px labels, and the
panel slot is half that. They still reach the learner on the lesson card, via
`diagramForDay` — which is where a topic-level drawing belongs.

Two traps already fixed in these builders:

- **`angleArc` fits its viewBox to the geometry**, rather than shrinking the ray
  to fit a fixed frame. The fixed-frame version squeezed an obtuse angle's
  second ray to a stub and pushed its label off the left edge, where it was
  simply invisible — the picture still drew, it was just missing a label.
- **`jumpLine`'s arrowhead follows the curve's tangent** (`P1 - C` on a
  quadratic), and its control point is solved from the peak height wanted
  (`cy = 2*peak - AX`), not eyeballed. Same family as the wave-crest bug below.

`ecosystem` is **an energy pyramid with the creatures in it** — hawk, fox,
rabbit, grass — not four stacked boxes. The shape is the lesson: each level is
narrower because only about a tenth of the energy is passed on, and equal-width
rectangles say the opposite. Every role label is anchored to **its own level's**
edge; one right-hand column printed "secondary consumer" across the pyramid,
because the column has to clear the widest level, not the narrowest.

`curatedDiagramSVG` holds 23 hand-drawn templates: brain, neuron, atom,
**cell**, supply-demand, dna, ecosystem, water-cycle, mitosis, memory-model,
plate-tectonics, photosynthesis, forces, wave, circuit, number-line, fractions,
place-value, area-model, triangle, states-of-matter, solar-system,
rock-cycle.

`cell` draws an animal cell, or a plant one when the text mentions plant /
wall / vacuole / chloroplast. `app.html` had offered `{"type":"cell",...}` for
a long time with nothing to draw it: a cell spec carries no `items`, so
`specFromDayVisual` returned null and the curated matcher had no branch to
catch it.

`photosynthesis` is **an actual leaf** — blade, midrib, veins, stem, roots,
with light, CO2 and water going in and oxygen and glucose coming out, and a
zoomed callout on one chloroplast. It was a green ellipse with the word
"Chloroplast" printed in it: a box-and-arrow diagram wearing a leaf's colour.
The blade is two quadratics mirrored about the midrib (control points at 2x
the wanted bulge, since a quadratic only reaches half way to its control), and
every arrow is anchored to a **computed** point on that curve rather than
eyeballed — the first draft had light rays and gas arrows terminating inside
the blade.

**Three rules:**

0. **The `type` is matched BEFORE the `label`.** `generateDiagramSVG` builds
   its `desc` label-first (that string also names the diagram in a `polish`
   warning), and it used to hand *that* to the curated matcher — so the
   CAPTION was searched and the template NAME ignored. `app.html` asks the
   model for exactly `{"type":"water-cycle","label":"short caption"}`, so
   `{type:'photosynthesis', label:'Inside a leaf'}` searched for "Inside a
   leaf", matched nothing, fell through `fromSpec` (no items) and `forTopic`
   (no keywords), and returned **null**. The same spec without a label drew
   perfectly. Every curated template was reachable only when the model's
   caption happened to repeat that template's own keywords. A `custom` spec
   still bypasses the matcher entirely, or a flow titled "cell phone adoption"
   gets answered with a biology cell.
1. **Names are matched with hyphens flattened to spaces.** The prompt asks for
   templates by hyphenated name (`water-cycle`), every pattern is written with
   spaces (`water cycle`), and without the normalisation at the top of
   `curatedDiagramSVG` the documented name matches nothing and silently falls
   through to a generic auto-diagram. `water-cycle` and `plate-tectonics` failed
   this way for a long time — invisibly, because the fallback always draws
   *something*.
2. **Every name in `app.html`'s template list must exist in
   `curatedDiagramSVG`.** Listing one that does not is not an error; it just
   quietly loses the picture.

When adding a template, check the geometry by rendering it, not by reading the
path data. On a quadratic `Q(p0, c, p1)` the curve peaks at
`0.25*p0y + 0.5*cy + 0.25*p1y`, not at the control point — the wave template's
crest and trough markers were first placed on the zero crossings because of
exactly this.

## The whiteboard (`window.SFWhiteboard`, script block 2)

Three entry points:

| Entry | Function | Status |
|---|---|---|
| Opening board (after the lesson) | **`workedInstanceFor(day, subject)`** → `sfwb-brief` card. A real example or nothing; `briefFor` is no longer what the opening calls | Active |
| Lesson-card replacement | `fromDay(day)` | **Gated off** by `LESSON_CARD_STEPPED`. It was never actually dormant — it builds from `day.steps` and fired on the first view of every topic, which is where the lesson card kept losing its diagram. |
| Wrong-answer walkthrough | `fromWrongAnswer(q, day)` | Active |

12 scenes: `hero`, `brief`, `map`, `chart`, `pyramid`, `steps`, `cycle`,
`compare`, `timeline`, `parts`, **`worked`**, **`ideas`**.

`equation` is **gone** — deleted, not parked. It drew the numbered column
running down the card, and leaving it in place "in case" was wrong twice over:
`briefFor`'s maths branch and `autoScene` could both still route into it, so
the card the sideways board replaced was still reachable. `equation`, `math`
and `formula` now alias to `worked`.

`briefFor` picks a scene by subject and topic keywords. Two things are required
for a scene to build: the right `type` **and** the data that scene reads. Setting
the type alone is not enough — `Scene.map` with no places fails, `autoScene`
substitutes, and you get the generic card back. Always populate `items` plus the
scene-specific field (`places`, `lines`, `center`).

`Scene.map` needs real geographic names — it does a gazetteer coordinate lookup
and returns null if under ~60% resolve. That's correct; the fallback handles it.

**Critical:** the card handler skips to the next card when `render()` returns
falsy. A scene that builds but returns false shows the learner *nothing*, with no
error. Always verify `render()` returns true, not just that `build()` works.

### The opening, and what it stopped saying three times

```
welcome  ->  lesson  ->  flashcards  ->  sfwb-brief  ->  practice
(topic)      (teach)     (words+traps)   (one example)
```

It used to be `welcome -> sfwb-outline -> sfwb-brief -> lesson -> terms`,
and it was **fourteen screens before the first question** with the same
material on three of them. `outlineFor` built a numbered list from
`day.steps`; `briefFor` fell through to `procedureWorked`, which builds
from `day.steps`; and the lesson card's "How it works" part prints
`day.steps`. On the photosynthesis day a learner met "Chlorophyll in the
thylakoid absorbs photons" three times before answering anything.

The second board was worse than redundant. Re-plated as a solution, its
header read **"HOW IT WORKS" over an empty problem line** — `spec.problem`
is `''` on any day with no `workedExample` — and each panel blew one
sentence up to headline size and asked "Why does this work?" about a fact.
It called itself a worked example on nine subjects where no example was
being worked.

What changed:

- **`sfwb-outline` is gone.** `Scene.ideas` and `outlineFor` are still
  there and still work; nothing queues them. The steps live once, on the
  lesson card.
- **The opening board is `workedInstanceFor`, not `briefFor`.** It returns
  a board ONLY for `day.workedExample` or the synthesised parallel maths
  problem — `opts.instanceOnly` refuses `procedureWorked` and
  `conceptWorked`. A day with no real example gets **no board**, which is
  the honest outcome: a walkthrough with nothing to walk through is not
  worth a screen. `briefFor` keeps its old fall-through behaviour for any
  other caller; it is simply not what the opening asks.
- **The board moved to AFTER the lesson.** An example comes after the
  thing it is an example of.
- **The key-terms card and the lesson's "Common traps" part became one
  deck of flashcards.** See below.

### The flashcard deck — `deckItems`, `sfDeckGo`, `sfDeckFlip`

Vocabulary and the day's misconceptions on one card, turned one at a time.
Traps come first: a misconception names something the learner probably
believes right now, and putting them after six definitions is where
attention has already gone.

- **A term and its trap belong together** — the trap is usually *about*
  the term. They were on different cards, one read as a glossary and one
  as prose.
- **Turning a card is retrieval; reading a list is not.** The old
  `terms` card printed every term next to its definition.
- **The `match` question stays** in the practice run. The deck is the
  study pass, the match card is the test.
- **Dark mode needs its own rules.** A trap card is cream, and cream with
  `--ink` text on it in dark mode is light type on a light card. Both
  faces get a dark ground — there are `body.dark .fc-*` rules for this.
- `renderCardInner` skips straight past the card when `deckItems` is empty,
  and `buildQueue` does not queue it in the first place.

### `Scene.worked` — the sideways worked example

The opening board, and the wrong-answer walkthrough. It runs **across, not
down**: the active step sits in the middle, the previous one stays half-visible
at the left edge, the next waits as an empty ghost card at the right, and
advancing slides the whole track.

Every panel carries its own picture, built by `SFStepVisual` from that step's
own words.

What it replaced, and why not to go back:

- `Scene.equation` laid a solution out as a numbered column running **down** the
  card. Every line was visible at once, so nothing arrived, and a four-step
  solution had scrolled its first line off the top by the end. It is a printed
  answer, not a walkthrough. `Scene.equation` still exists but nothing reaches
  it — `working`/`solve`/`math` all alias to `worked` now.
- The board is **`manual: true`** — no autoplay. Every other scene reveals on a
  1.5s timer, which for a worked solution walks off the answer before the
  learner has read the line. `render()` honours `scene.manual` by showing beat 1
  and waiting.

**One progress signal, not four.** A panel used to carry a numbered disc in
its top-left corner while the board's own chrome printed "2 / 5" above the
card, a row of tappable dots below it, and the scene drew a filling rail of
its own — four answers to "where am I", three of them not even clickable.
The disc is also the loudest mark available on a card whose content is a line
of type, and it was spent on the row's index. What is left: the count, the
dots (they are tap targets), and the arrows between panels. The step's own
NAME now sits where the disc was, set as a small muted kicker — that is the
half of the badge that was carrying information.

**`ctx.labels` is passed EMPTY here, exactly as on the ideas card.**
`forStep`'s last resort is `progressStrip`, a little diagram of the list of
steps — and on this board the learner is standing in that list. It was drawing
a picture of the furniture. On maths it was worse than redundant: the strip
prints every label it is handed, so panel one of `x + 7 = 15` displayed the
whole solution, `x = 8` included, in 10px boxes before the learner had read
the problem. A walkthrough that opens by showing the answer is not a
walkthrough.

**The panels size themselves.** Height was a flat 320 units whatever they
held, so a step reading "x = 8" with one line of reason got the same card as
a step with a balance drawn in it, and the difference came out as a hole. It
is now the tallest panel's real need, plus a picture slot only when some step
on this board actually has a picture. And where a panel has no picture, the
line and its reason are centred **as one block** — pinned to the top and
bottom of an empty card they were two things either side of a gap.

**The reason arrives behind a prompt.** Studying a worked example beats
solving one unaided — but only if the learner processes it, and most learners
do not self-explain unless asked. So each panel's `why` waits behind "Why does
this work?", one tap away. It is an invitation, not a gate: `onPaint` reveals
every panel the learner has moved past, so a reason can never be lost by not
tapping.

**The closing line of the parallel maths example is withheld** — "Work it out
— then tap to check". This is backward fading in its smallest honest form,
and it is set by `spec.predict`, which `workedFor` sets **only** for
`buildParallelMath`. None of the day's questions are spent on that problem
(invariant 7), which is what makes asking for its last line free. A
walkthrough opened after a wrong answer never gets it — that learner is here
for the answer, and hiding it would be a punishment.

The reveal state rides in **`data-sfb-cls`**, not on the element: `paint()`
rewrites the whole class attribute on every beat change, so anything set
directly is wiped on the first advance. Same trap as the scene classes.

Three pieces of plumbing that are easy to break:

- **`onPaint`.** The track slide and the rail fill depend on *which* beat, not
  on whether a beat has been reached, so they cannot be CSS classes. The scene
  returns an `onPaint(wrapEl, at)` hook; `build()` must pass it through and
  `paint()` must call it. Drop it anywhere along that chain and the board still
  renders — it just silently stops sliding.
- **`data-sfb-cls`.** `paint()` rewrites each beat element's whole `class`
  attribute, so a scene-specific class set in `g()` is wiped on the first
  advance. `g()` stashes it in `data-sfb-cls` and `paint()` puts it back.
- **`transform-box: fill-box`** on anything scaled. An SVG element's
  `transform-origin` is the origin of the user space, not its own box, so
  `scale(.94)` on a panel 700 units to the right throws it off the board instead
  of shrinking it in place.

Sizing is in viewBox units at `width:100%`, so **W sets the scale**. It is 480
wide on purpose: at 640 the board was 1:1 on desktop and shrank every label to
54% on a phone — the reason line came out at 6px. A narrower board scales *up*
where there is room. Nothing is rasterised, so scaling up is free.

### The walkthrough button — what it must never do

`fromWrongAnswer(q, day)` builds the board the **Walkthrough** button opens.
For a calculation it goes through `derivedWorking`, which does not compute
anything: it **scrapes** equation-shaped substrings out of `q.equation`, the
stem and the explanation. Four rules paid for in a board that taught a
falsehood:

- **`EQ_CHARS` must contain the typographic operators** (`−`, `×`, `÷`), not just
  the ASCII hyphen. A model writes "x + 7 − 7 = 15 − 7" with a real minus. The
  left-walk from the `=` stopped dead at that character, so the scraper pulled
  **"7 = 15"** out of the middle of a correct sentence — and `SFStepVisual`
  then drew that as a **level balance**, asserting in a picture that seven
  equals fifteen. It read as a plausible maths card, which is what made it
  bad.
- **`contradicts()` is the second lock on the same door.** Both sides pure
  arithmetic and not equal → drop the line. It is a tiny recursive-descent
  parser, deliberately not `eval` or `Function`: the string came out of model
  prose, and the argument for `SFSceneKit`'s fixed vocabulary applies here
  too. Anything with a letter in it passes — unknowns are what a solution is
  made of.
- **Dedupe on a normalised key, and cut at the sentence end.** "That leaves
  x = 8. Check: 8 + 7 = 15" was kept whole as "x = 8. Check", which then
  failed to match the plain "x = 8" the answer field supplies, so the same
  step arrived twice, once mangled.
- **Cap the panels.** A one-step equation was coming back as **seven**: a
  ceremonial "Goal" card, the equation, the scraped falsehood, the answer, the
  check, the answer again under "Almost there", and a second check. The goal
  now rides on the first line's reason rather than taking a panel — "Goal" set
  in 27px with "Find x." underneath is a title card, where the label is the
  biggest thing on the panel and the content the smallest.

`x + 7 = 15` now yields three panels: the equation, `x = 8`, and the
substitution that checks it. Use that as the regression.

### Numbering says there is an order — `Scene.steps`'s `ordered` flag

`Scene.steps` draws two different things: a procedure, and a set of labelled
notes. It used to number every row identically — a numeral inside a filled
disc inside a halo, three marks for one fact. On a procedure that is at least
true. On the walkthrough of a multiple-choice question — *What was asked / The
answer / Why / Why not the others* — those rows have no order, and numbering
them tells the learner to do them in turn.

So the caller declares it, and **the default is unordered**: `ordered: true`
on the sequence walkthrough, on `fromDay`'s `day.steps` procedure and on a
cause-and-effect chain; nothing else. Unordered rows get no numeral and no
disc — the row's own label is the marker, and the text reclaims the 30 units
the disc column was holding. The connector line between rows is drawn only
when there is a sequence to connect.

Where a number IS drawn it is **plain type**, on this scene and on `ideas`.
The disc and its halo were the component asserting itself over the content.

### Where the worked example comes from — `workedFor(day, subject, opts)`

Most specific first:

1. `day.workedExample` — what the model generated with the lesson. **This is
   the main path in production**; everything below is the safety net for a day
   where the model omitted it.
2. **maths: a synthesised parallel problem** — see below.
3. `day.steps` — the day's own teaching procedure.
4. `day.concepts` / `pillars` / `keyTerms`, but **only when `opts.concepts`**.

`briefFor` asks for (1–3) first, then tries its own subject scenes (map,
timeline, cycle, compare…), and only then asks for (4). That ordering matters: a
geography day is better served by the map its pillars can actually fill than by
three concept panels, and a dated history day by the timeline. Ask for concepts
too early and those subjects lose their diagrams.

### The parallel maths example — how invariant 7 survives a worked solution

A worked example that stops before the answer teaches nothing. So the maths
example is **not one of the day's questions**: `buildParallelMath` reads the
*form* of the day's `bigequation` questions (`twostep`, `onestep`, `bothsides`,
`distribute`, `combine`), picks a seed of different numbers, and works that to
the answer and checks it. `collidesWithDay` rejects any candidate that restates
something the day is going to ask, and walks to the next seed.

Seeds are chosen so every intermediate value is a whole number. An example that
lands on 3.4285 teaches arithmetic frustration, not the method.

The pick is stable per day (`hashOf` the title), so the same lesson always opens
on the same example rather than a different one on every render.

**A regression check that matters:** a maths day must yield four panels whose
equations appear nowhere in `day.questions`.

---

## Testing

There's no test runner. Node is not installed on the dev machine. **The approach
that works is a real browser**, which is also more faithful than a mock DOM —
`getBBox` and `getComputedTextLength` are real, so whiteboard scenes that look
broken under a mock render correctly.

```bash
python3 -m http.server 8765     # from the repo root
```

Then open `http://localhost:8765/lesson.html`, seed `localStorage` with a
`studyflow_user` and a `studyflow_plan` (namespaced `sfu:<email>|<key>`), and call
`buildQueue()` directly with fixture days. `plan`, `day`, `dayIndex` and
`sessionCards` are all script-block-1 globals, so a harness can set them and
re-run the queue as many times as it likes.

Serving the harness itself from a second port and injecting it with a `<script>`
tag keeps test fixtures out of the repo.

What to check after any `buildQueue` or renderer change:

1. Both script blocks parse — `new Function(blockSource)` for each
2. For all 10 subjects: 0 dropped, 0 duplicated, 0 miscast questions
3. Day 0 **and** day 1 (day 0 takes the pre-test path)
4. Degenerate days — empty, null fields, no keyTerms, one question, 8 fills,
   malformed payloads, and `questions` that is not an array
5. Whiteboard `briefFor().render()` returns true on all 10 subjects, and
   `fromWrongAnswer().render()` returns true for every question type
6. No question's answer appears on the opening board
7. Math still yields 10 bigequation / 2 wordproblem / 0 match / 0 sequence / 0 fill
8. Every card in every session renders without throwing
9. The whiteboard sits between `welcome` and `lesson` in every session — check
   this with a real page load (an iframe with a cache-busting query works), not
   by calling `buildQueue()` in an already-loaded page; script-ordering bugs are
   invisible to the latter
10. No `bigequation` or `wordproblem` card on a non-quantitative subject
11. Every curated diagram still resolves **by its exact hyphenated name**
    (`generateDiagramSVG({type:'water-cycle'})`), not just by a spaced label
12. `diagramForDay` returns a diagram for all 10 subjects on a day carrying
    **no `diagram` field at all** — that is the common case in production
13. All 11 custom layouts draw, all six `graph` shapes draw, and `bars` / `venn`
    / `matrix` each fall back rather than return null when given wrong data
14. The opening board is `worked` or a subject scene (`map`, `timeline`,
    `compare`, `cycle`, `parts`, `steps`) — **never `brief`/`hero`**, which is
    the identical generic node card every subject used to open on
14b. The opening is `welcome > lesson > flashcards > sfwb-brief`, in that
    order, and **`sfwb-outline` appears nowhere**. A day with no
    `workedExample` and no maths gets no `sfwb-brief` at all — assert its
    absence, and assert that a day WITH one gets it, or the "no fake
    example" rule silently becomes "no example ever"
14e. The ideas card builds and renders on all 10 subjects, with **no empty
    picture slot** and **no picture scaled under 0.66**; a model-supplied
    `flow`/`compare` per idea is drawn, a tall `concept` one is refused
    rather than shrunk, and six malformed `visual` shapes fall back without
    throwing
14c. **No warm hue (25–70°, sat > 0.22) in any rendered board**, on any
    subject, on the opening board or the wrong-answer walkthrough
14d. Nothing resolves to the deleted `equation` scene: `resolveType` sends
    `equation`, `math` and `formula` to `worked`, and no `briefFor` or
    `fromWrongAnswer` spec on any subject comes back typed `equation`
15b. A panel's reason is hidden until tapped **or until the learner moves
    past it**, and a `fromWrongAnswer` board never sets `predict` — assert
    both, because a walkthrough that withholds the answer after a wrong
    answer is the one version of this that must never ship.
15. No `worked` panel carries a numbered badge, and **no panel contains a
    `progressStrip`** — the picture of the list, drawn inside the list. A
    text-only step having no picture at all is the correct outcome, the same
    call the ideas card makes; what must never appear is a strip. Check by
    asserting `labels: []` reaches `forStep`, and that a concept-only day
    renders panels with zero `.sfb-wvis` rather than filled ones.
16. A maths board's equations appear nowhere in `day.questions` (invariant 7,
    and the reason `collidesWithDay` exists)
17. `Scene.worked`'s track actually slides — check `onPaint` ran, not just that
    the beat classes changed
18. The board does not overflow at 375px, and its reason line is still legible
    there (it is the smallest text on the card)
18b. The lesson card pages: on all 10 subjects it builds **2+ parts**, the
    footer button names the next part and only says "Got it" on the last, a
    prose-only day builds **exactly one** part and no rail, and no part's
    first line repeats the rail label. Assert the counts — a pager that
    silently collapses to one part looks identical to a short lesson.

**And a second suite that belongs to `app.html`**, not the session — load
`app.html`, inject `appsuite.js`, call `SFRunAppSuite()`:

19. The real prompt is captured off the wire and is **under the 60 000 char
    cap with real headroom**, and still ends with an intact JSON schema. The
    cap truncates from the end, so going over deletes the schema, not the
    guidance.
20. 200 000 chars of notes produce the same prompt length (the 3 500 cap holds)
21. The prompt still carries the drawing vocabulary, the worked example and the
    per-concept visual — adding guidance is how the budget gets spent
22. **Every extension in the file picker's `accept` list has a handler.** A
    format advertised with no branch is how `.pptx` came back "not supported"
    for months
23. `pptxTextFromXml` pulls every run and decodes entities

Verify by executing the code, not by reading it. Several bugs here looked correct
on inspection and only showed up when the queue was actually built — and two
(the missing opening board, the dead badges) only showed up when the *page* was
loaded rather than the functions called directly.

## Making diagrams

There is a project skill for this: `.claude/skills/diagram/`. It covers picking
a shape from the material rather than the subject, the kit's API, the specific
traps (Bézier peaks, text anchoring, silent fallbacks, load order), and a
preview script:

```bash
python3 .claude/skills/diagram/scripts/preview_diagrams.py --demo -o /tmp/p.html
```

That pulls the real kit out of `lesson.html` and renders any set of specs onto
one page, so a diagram can be *looked at* rather than read. Use it — every
diagram bug in this codebase read as correct code.

## The prompt budget

`api/generate.js` caps the prompt at **60 000 chars and truncates from the
end** — and the JSON schema sits at the end. Going over does not shorten the
guidance, it removes the shape the model is told to return, which fails
silently and completely.

Measured, not estimated (`appsuite.js` captures the real prompt off the wire):

| | chars |
|---|---|
| static prompt text | ~25 600 |
| notes, capped by `notesForPrompt = notes.substring(0, 3500)` | ≤ 3 500 |
| question schema, worst subject | ≤ ~2 600 |
| **longest real prompt** | **30 467** |
| headroom | ~29 500 |

200 000 chars of notes produce a byte-identical prompt length, because of that
cap — there is a test for it. The drawing vocabulary, `workedExample` and the
per-concept visual together cost about 4 000 chars, which is why there is
still half the budget spare.

## Reading what the learner uploads

`app.html` accepts photos, PDFs, Word, PowerPoint, caption files and plain
text. What each route actually does:

| Format | How | Notes |
|---|---|---|
| jpg png webp gif heic | `api/extract` → Claude Vision | handwriting, textbook photos, whiteboards |
| **pdf, with a text layer** | pdf.js `getTextContent` | fast and exact |
| **pdf, scanned** | pdf.js renders each page to canvas → `api/extract` | capped at `PDF_OCR_MAX_PAGES` (12) |
| docx | mammoth | |
| **pptx** | JSZip → `<a:t>` runs in `ppt/slides/slideN.xml` | **speaker notes too** |
| vtt srt sbv | parsed locally, timings stripped | the reliable route for a lecture |
| mp4 mov mp3 wav … | **not transcribed** — see below | |

Three things worth knowing:

- **A scanned PDF used to be a dead end.** It scraped printable bytes out of
  the raw file (which yields fragments of font tables far more often than
  prose) and then told the learner to "take a photo of the pages instead" —
  of the pages they had just uploaded. It now renders them and reads them with
  the same vision endpoint a photo goes through. The canvas is **filled white
  first**: a PDF assumes paper, and a transparent page flattened to JPEG comes
  out black on black.
- **PowerPoint was advertised and unimplemented.** `.pptx` was in the file
  picker's `accept` list and had its own "PowerPoint" chip, and the dispatcher
  had no branch for it, so every deck came back "File type not supported".
  Slides are ordered by the **number** in the filename: `slide10` sorts before
  `slide2` as a string, and a deck read out of order teaches the sequence
  wrong. Speaker notes are pulled from `ppt/notesSlides/` and appended to their
  slide — that is usually where the actual explanation is.
- **Audio and video cannot be transcribed here, and the code should not
  pretend otherwise.** A browser cannot transcribe a media file, and the only
  backend is the Anthropic API, which has no speech-to-text. An earlier version
  played the file at volume 0.01 and started `SpeechRecognition`, which
  captures the *microphone* — so it opened the mic, heard the room, and
  reported "no speech detected". The honest routes are a caption file or live
  listening, and those are what the UI offers.

## The teach-it-back card

`.write-area` starts at **five lines and grows with what is typed**, to a
fourteen-line cap and then scrolls; `autoGrowWrite` resets the height to `auto`
before measuring, because `scrollHeight` only ever reports the larger of the
content and the current height — without the reset a box that has grown can
never shrink back.

It was a fixed 110px: three visible lines, about 40 words, while the grader
asks for an explanation scored out of ten with specific knowledge gaps named. A
real one runs 80–150 words, so most of the answer was typed into a porthole.
That matters more here than on an ordinary form: **re-reading your own
explanation and noticing where it goes vague is the Feynman technique**, and a
window hiding two thirds of it removes the step that makes the card work.

Growing rather than simply being tall is deliberate — a fixed fourteen-line box
on a card where two sentences is a legitimate answer reads as a demand.

The footer slot carries a live word count. It used to read "Writing = strongest
memory", which is a slogan; every question card uses that slot for the score.

## Deploying

`main` is the live branch. Push to GitHub and Vercel rebuilds automatically —
frontend and `api/*.js` together. There is no build step, so a push is the deploy.

## Open items

- **The opening board now depends on the model returning `workedExample`,
  and that has still never been checked against a real run.** Maths is
  safe: `buildParallelMath` synthesises one. The other nine subjects get a
  walkthrough only if the model sends the field — the prompt asks for it on
  every day, and asks specifically for "a real instance: how one specific
  example of this topic actually plays out" on non-quantitative subjects,
  but nobody has yet looked at what comes back. If it turns out the model
  omits it, those subjects have no walkthrough card at all, which is the
  deliberate trade (no fake examples) but not a good place to stay.
  **Generate one plan and look.**

- **Nothing generated by a real model run has been checked yet.** Three fields
  are wired end to end, prompted, validated and tested against hand-written
  payloads, and none has been seen coming back from the actual model:
  `workedExample`, `concepts[].visual`, and `{"type":"drawing"}`. Generate one
  plan and look at what arrives. Specifically: does the model return them at
  all, does it keep `line` under 40 chars, does it keep per-idea visuals to the
  four wide-and-short layouts, and does it honour "the worked example must not
  be one of the questions below" — that last rule is prompt-enforced only, with
  no validator behind it.
- **Audio and video still cannot be transcribed**, and no amount of client work
  fixes it: a browser cannot transcribe a media file and the Anthropic API has
  no speech-to-text. The honest routes — a caption file, or live listening —
  are what the UI offers. Real support needs a transcription service (Whisper,
  Deepgram, AssemblyAI) behind a new `api/transcribe.js`; that is a paid
  dependency and a product decision.
- **Concept-only days lean on `progressStrip`.** A day of bare definitions has
  genuinely little to draw per row — a term and its meaning is not a shape.
  Roughly half those rows stay text-only. A model-supplied `visual` is the fix;
  more builders are not.
- **`whiteboard.js` is now unreached** (`LESSON_CARD_STEPPED` is `false`). It is
  ~800 lines that nothing calls. Kept rather than deleted because the flag is a
  one-word revert — but it is dead code, and dead code that can silently
  reactivate is exactly how `Scene.equation` kept drawing the card it was
  supposed to have replaced. Decide whether to keep it.
- **`index.html` has not been reviewed.** It loads clean — no console errors, no
  broken images, no horizontal overflow, and all eight internal links resolve —
  but the hero section is still the intended next task. `hero-bg.mp4` has been
  deleted: 1.6 MB committed and referenced by nothing.

  **The hero shader is the navy ripple, and that is a decision, not an
  oversight.** A monochrome mesh gradient — black through `#2e2e2e` to white,
  domain-warped noise, contour bands for a wireframe — was built and reverted
  in one sitting (`823564b`, reverted). It was a faithful version of the
  reference and it looked wrong here: the landing page is one blue, and a
  black-and-white hero above it made the rest of the page look like a
  different product. Try something else before trying that again.

## Conventions

- ES5 style in `lesson.html` — `var`, no arrow functions, no template literals.
  Match the surrounding code.
- Comments explain *why*, especially the non-obvious constraints above. Several
  comments document bugs that were fixed; don't delete them.
- Escape user/model content before putting it in HTML or SVG (`esc()`).
- Never leak a question's answer into a prompt or a whiteboard label.
