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

1. Opening cards — welcome, whiteboard **outline**, whiteboard **worked**,
   lesson, key terms
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
| `day.diagram` | the **lesson card** | `generateDiagramSVG` → `curatedDiagramSVG`, else `SFDiagramKit` |
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

Before this, the lesson card tested `day.diagram.type !== 'none'` — and
`app.html` defaults that field to `'none'`. Any day where the model omitted the
field showed no diagram at all, and nothing reported it, because "no diagram"
looks exactly like "this topic did not need one".

On a hub layout (`concept`, `parts`) pass the topic as `center` and leave
`title` empty — passing both prints the topic twice, once above the drawing and
once inside it. The card captions the diagram underneath anyway.

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

`curatedDiagramSVG` holds 22 hand-drawn templates: brain, neuron, atom,
supply-demand, dna, ecosystem, water-cycle, mitosis, memory-model,
plate-tectonics, photosynthesis, forces, wave, circuit, number-line, fractions,
place-value, area-model, triangle, states-of-matter, solar-system,
rock-cycle.

**Two rules:**

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
| Opening board (card 2) | `briefFor(day, subject)` → `sfwb-brief` card | Active |
| Lesson-card replacement | `fromDay(day)` | **Returns null on every subject — dormant.** Pre-existing, falls back safely to the normal lesson card. |
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

### The opening sequence: outline, then worked

`buildOpeningBoard()` returns an **array**, and the queue is:

```
welcome  ->  sfwb-outline  ->  sfwb-brief  ->  lesson
             (the map)        (the method)
```

`outlineFor(day, subject)` builds the outline from the day's `steps`, else its
`concepts`, else its `pillars` — a numbered row per idea, label and detail. It
is the **`ideas`** scene, and it is the card that answers "what is today
about". The worked board then teaches one piece of it.

**Every row can carry its own picture**, drawn by the same `SFStepVisual`
chain the worked board uses. Three rules, all paid for:

- **The picture goes BELOW the text, across the row** — 470x136. Beside the
  text was the first attempt and could not work: the kit draws 298–430 units
  wide, a side slot leaves ~250 once the text has its column, and every
  diagram landed at 0.27–0.58 scale. 9px labels rendered at 2.4–5.3px. The
  diagrams were all there and not one word was readable.
- **A picture that would shrink below 0.68 is dropped** and the row stays
  text-only. `concept` comes back 340x346 and `cycle` 304x253; in a wide short
  row those are a third size. The same rule `Scene.worked` applies to its own
  slot.
- **`ctx.labels` is passed EMPTY on purpose.** `forStep`'s last resort is
  `progressStrip`, which on this card would stamp the same picture of the list
  onto every row of the list.

A row whose idea has nothing drawable gets no picture. That is the honest
outcome for a bare definition, and roughly half the rows on a definition-only
day take it.

Opening straight onto step 1 of a worked solution gave the learner no map of
where that step sat, which is what the outline fixes.

Either card can be absent — a day with no procedure and no concepts gets no
outline, a day the board cannot build for gets no worked card — and
`buildOpeningBoard` returns `[]` when neither builds, so the session simply
starts on the lesson. Three places must agree that `sfwb-outline` is a
teaching card: the `TEACHING` map in `applyFeynmanOrder`, the `renderCard`
dispatch in the integration layer, and the queue loop.

The outline is revealed at **420ms** a row rather than the standard 1500ms
(`spec.outline` sets the pace). A six-row outline at the normal pace spends
nine seconds mostly blank, which is the opposite of orienting.

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
14b. `sfwb-outline` comes **before** `sfwb-brief` and the two are adjacent,
    directly after `welcome`
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
15. Every panel of a `worked` board carries a picture, and no `.sfb-wvis` slot
    is empty
16. A maths board's equations appear nowhere in `day.questions` (invariant 7,
    and the reason `collidesWithDay` exists)
17. `Scene.worked`'s track actually slides — check `onPaint` ran, not just that
    the beat classes changed
18. The board does not overflow at 375px, and its reason line is still legible
    there (it is the smallest text on the card)

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

## Deploying

`main` is the live branch. Push to GitHub and Vercel rebuilds automatically —
frontend and `api/*.js` together. There is no build step, so a push is the deploy.

## Open items

- **`fromDay` is dormant** — the whiteboard never replaces the lesson card.
- `index.html` has not been reviewed yet. That was the next task (hero section).
- **`workedExample` has not been seen from a real model run.** The prompt, the
  schema and the validator are in place; the fallback chain is tested against
  fixtures, and the primary path is tested against a hand-written payload of
  the shape the prompt asks for (`workedFor` prefers it, `briefFor` prefers it
  over its own subject scene, per-step `visual` specs draw, and six malformed
  shapes fall back without throwing). What is still unverified is the *model*:
  no generated plan has come back carrying the field yet. Check the first one
  for step `line` lengths, and for whether it honours "not one of the questions
  below" — that rule is prompt-enforced only, with no validator behind it.
- **`concepts[].visual` has not been seen from a real model run** — same
  status as `workedExample`. The prompt, schema and validator are in place and
  the path is tested against hand-written payloads (a `flow` and a `compare`
  draw; a tall `concept` is refused; six malformed shapes fall back without
  throwing). What is unverified is whether the model returns the field, keeps
  to the four allowed layouts, and keeps items under 26 characters.
- **Concept-only days still lean on `progressStrip`.** `areaModel` and
  `trendGraph` converted the expansion and trend steps, but a day of bare
  definitions has genuinely little to draw per step — a term and its meaning is
  not a shape. Measured across the ten fixtures, the non-maths worked boards are
  roughly half strip. A model-supplied `workedExample`, which walks a real
  instance rather than a list of terms, is the fix; more builders are not.
- `Scene.equation` has been **deleted**, and every route into it now goes to
  `worked`. Parking it unused was not enough: two live paths still reached it.

## Conventions

- ES5 style in `lesson.html` — `var`, no arrow functions, no template literals.
  Match the surrounding code.
- Comments explain *why*, especially the non-obvious constraints above. Several
  comments document bugs that were fixed; don't delete them.
- Escape user/model content before putting it in HTML or SVG (`esc()`).
- Never leak a question's answer into a prompt or a whiteboard label.
