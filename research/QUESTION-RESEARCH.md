# StudyFlow — Question Format Research

What formats actually produce **learning of new material**, per subject and subtopic.

Every citation below was fetched and read at the URL given. Where a primary source
sat behind a paywall or failed certificate validation, it is cited through a source
that *was* fetched and labelled as such — never asserted from memory. Claims that
the fetched evidence does not directly support are labelled `EVIDENCE: weak`.

Generated 2026-09-11. Companion file: `question-matrix.json`.

---

## Executive summary

Eight mechanisms matter, and they do not all point the same way.

**Retrieval practice** is the strongest single lever, but its classroom record is
more qualified than the popular account: 19 of 23 classroom studies found a benefit,
multiple-choice and fill-in-the-gap worked across ages, and short-answer *failed* for
below-6th-grade learners without feedback. Against genuinely active comparisons —
concept mapping, copying — retrieval practice showed no reliable advantage. So it
beats rereading, not everything.

**Pretesting** is the most under-used mechanism in StudyFlow relative to its evidence.
Guessing before instruction beats reading, with effects in the d = 0.63–1.29 range,
and the benefit is largest with *immediate* feedback. Critically, the benefit attaches
to the specific information that was prequestioned, not to the surrounding lesson —
so a pre-test only pays off if the lesson then teaches exactly what was asked and the
question is asked again.

**Worked examples** help novices and stop helping — then hurt — as expertise grows.
This is the one mechanism with a built-in expiry date, and it argues for a mix that
*changes across a plan*, which StudyFlow currently does not do.

**Interleaving, elaborative interrogation and self-explanation** all sit at "moderate
utility" in Dunlosky's classification — promising, below practice testing and
distributed practice, and not to be defended as settled.

**Misconception-built distractors** raise both item quality and diagnostic value, and
are cheap: StudyFlow already collects a `misconceptions` field per day and does not
feed it into distractor generation. That is the highest-value, lowest-risk change
available.

**Depth of Knowledge** is a better difficulty ladder than "Easy/Medium/Hard" because
it describes the *context* a learner must reason in rather than how hard a question
feels. It pairs with Bloom's rather than replacing it.

**Spacing** is high-utility and already partly implemented via the app's SM-2 hooks.

The practical conclusion: formats should vary by subtopic *and* by position in the
plan, distractors should be built from named misconceptions, and short-answer formats
need guaranteed feedback or they underperform for younger learners.

---

## Mechanisms

### 1. Retrieval practice / the testing effect

**What it is.** Answering from memory, rather than re-reading, strengthens later recall.

**Evidence.** Moreira, Pinto, Starling and Jaeger (2019) reviewed 23 studies run in
real classrooms: positive testing effects in 19 of 23. Dunlosky (2013) rates
practice testing **high utility**.

**Boundary conditions — this is the part usually dropped.** In the same review,
multiple-choice and fill-in-the-gap tests showed consistent benefits across ages,
while short-answer tests failed to produce benefits for elementary students *without
feedback*; children below 6th grade showed inconsistent benefits with short-answer
specifically. And against stronger controls — concept mapping, copying — retrieval
practice showed "no reliable effects".

**When it backfires.** Used as the only activity, against an already-active
alternative, or in short-answer form for younger learners with no feedback.

**For StudyFlow.** `mcq`, `truefalse` and `fill` are the safe retrieval workhorses.
`write` is valuable but must always show its `modelAnswer` as feedback.

- Moreira et al. (2019), *Frontiers in Education* — https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2019.00005/full
- Dunlosky (2013), *American Educator* — https://www.aft.org/ae/fall2013/dunlosky

### 2. Pretesting / prequestioning

**What it is.** Attempting questions on material not yet taught, then studying the answers.

**Evidence.** Mera, Dianova and Marin-Garcia (2025) found pretesting beat reading-only
across every timing combination, with Cohen's d from 0.63 to 1.29; immediate feedback
outperformed delayed (d = 1.24 vs 0.82 in Experiment 1), and the effect survived
24–48h feedback delays. Practitioner guidance synthesising Pan & Carpenter (2023) and
the Bjork group recommends 3–5 low-stakes questions targeting central lesson ideas,
pitched to generate some errors but not total failure, with corrective feedback
treated as essential.

**The limit that matters.** Meta-analytic work reports the benefit attaching to the
*prequestioned* information (g ≈ .66) rather than to other content in the same lesson.
`EVIDENCE: moderate` — this figure comes from a meta-analysis whose full text sits
behind a Springer authentication gate; it is reported here via the search abstract and
the practitioner review, not from the paper itself.

**For StudyFlow.** The pre-test must ask about what the lesson will actually teach, and
the same items must reappear afterwards. StudyFlow already re-asks them with a
"You saw this in the pre-test" badge — that design is well supported.

- Mera, Dianova & Marin-Garcia (2025), *Journal of Cognition* — https://pmc.ncbi.nlm.nih.gov/articles/PMC12292081/
- Main (2025, upd. 2026), Structural Learning — https://www.structural-learning.com/post/pretesting-effect-testing-before-teaching

### 3. Worked examples and expertise reversal

**What it is.** Studying a fully worked solution beats solving the equivalent problem —
for novices. As domain knowledge grows the advantage shrinks, then inverts.

**Evidence.** The expertise reversal effect is presented as well established, with
guidance that is "essential for novices" becoming redundant or harmful for more
advanced learners; for advanced learners, removing worked-out steps outperformed
providing them. Noted caveat: many studies rely on subjective cognitive-load measures
and motivational explanations remain viable.

`EVIDENCE: moderate` for the primary literature — Kalyuga (2007, *Educational Psychology
Review* 19, 509–539), Kalyuga et al. (2003, *Educational Psychologist* 38, 23–31) and
Sweller et al. (1998, *Educational Psychology Review* 10, 251–296) are cited *through*
the fetched encyclopedia entry; the primary PDFs were not retrievable (paywalls and
expired certificates), so they are not quoted directly here.

**For StudyFlow.** `errorspot`, `tracetable` and worked `wordproblem` scaffolds are
worked-example formats. They belong at the *start* of a plan and should thin out by
the last day. StudyFlow ramps difficulty by day but holds the format mix constant —
see "What StudyFlow is doing wrong".

- Expertise reversal effect (encyclopedia entry, fetched) — https://en.wikipedia.org/wiki/Expertise_reversal_effect

### 4. Interleaving vs blocking

**What it is.** Mixing problem types within a session rather than blocking one type.

**Evidence.** Dunlosky (2013) rates interleaved practice **moderate utility** — promising,
but short of high because the evidence base is narrower. Interleaving helps most where
categories are *confusable* and discrimination is the difficulty; where categories are
internally varied and not confusable, blocking can be better because it surfaces what
members of a category share. The strongest classroom evidence is in mathematics
strategy selection; outside mathematics the applied evidence is thin.
`EVIDENCE: weak` outside mathematics.

**For StudyFlow.** `classify` is the interleaving format — use it where two things are
genuinely confused (mitosis/meiosis, weather/climate, stack/queue), not as a generic
sorting card.

- Dunlosky (2013) — https://www.aft.org/ae/fall2013/dunlosky

### 5. Elaborative interrogation and self-explanation

**What it is.** Asking *why* a fact is true; explaining your own reasoning.

**Evidence.** Both rated **moderate utility** by Dunlosky (2013), below practice testing
and distributed practice, above highlighting and rereading. They work best for
upper-elementary through high-school learners who already have some background
knowledge — which is precisely StudyFlow's audience and precisely the moment after a
lesson card.

**For StudyFlow.** `write`, the Feynman teach-back cards, and Part B of `twopart` are
the elaborative formats. Their prompts must ask for a mechanism or a cause, never a
definition.

- Dunlosky (2013) — https://www.aft.org/ae/fall2013/dunlosky

### 6. Misconception-driven distractors

**What it is.** Wrong options built from errors students actually make.

**Evidence.** Shin, Guo and Gierl (2019): "Creating distractors using common errors and
misconceptions result in multiple-choice items with increased diagnostic value as well
as higher item quality." They stress deriving them from real student responses rather
than expert guesses.

**For StudyFlow.** Every distractor should be a named misconception where one exists.
The day schema already carries `misconceptions: [{believe, actually, why}]`; it is used
for the whiteboard and not for distractors. Wiring it in is close to free.

- Shin, Guo & Gierl (2019), *Frontiers in Psychology* — https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2019.00825/full

### 7. Depth of Knowledge as a difficulty ladder

**What it is.** Webb's four levels — recall; skill/concept; strategic thinking; extended
thinking — describing the *context* in which a learner must reason.

**Evidence.** Francis (2017) sets out the four levels from Webb (2002) and makes the two
distinctions that matter: DOK is not difficulty, and it complements rather than
duplicates Bloom's — "Bloom's determines the cognition… Webb's designates the context".

**For StudyFlow.** Map the existing Easy/Medium/Hard onto DOK 1 / 2 / 3 and let the
*question type* carry the level: `fill` and `truefalse` sit at DOK 1, `classify`,
`sequence` and `tracetable` at DOK 2, `twopart`, `corroborate` and `write` at DOK 3.

- Francis (2017), ISTE+ASCD — https://www.ascd.org/blogs/what-exactly-is-depth-of-knowledge-hint-its-not-a-wheel

### 8. Spacing / distributed practice

**What it is.** Spreading study across sessions rather than massing it.

**Evidence.** Dunlosky (2013) rates distributed practice **high utility**. Carpenter (2012)
reviews spacing benefits across vocabulary, motor skills, problem solving and
conceptual understanding, and notes that the useful gap scales with how long retention
must last. The often-quoted precise ratios (gap ≈ 10–20% of the retention interval)
originate in Cepeda et al.; both source URLs failed certificate validation on fetch, so
those exact percentages are **not** asserted here. `EVIDENCE: weak` for the specific ratio.

**For StudyFlow.** The multi-day plan and the SM-2 hooks already implement this. The
review-card path that re-asks previously missed questions is the highest-value part.

- Carpenter (2012), ERIC ED536925 — https://files.eric.ed.gov/fulltext/ED536925.pdf
- Dunlosky (2013) — https://www.aft.org/ae/fall2013/dunlosky

### Subject-specific frameworks used below

- **History.** The Digital Inquiry Group's *Reading Like a Historian* names four
  historical reading skills: **sourcing, contextualizing, corroborating, close reading**.
  https://www.inquirygroup.org/history-lessons

---

## What StudyFlow is currently doing wrong

Diffed against `SUBTOPICS` in `app.html` as it stands today (25 subtopics, 10 subjects),
not against the older hardcoded per-subject mixes.

**1. The format mix never changes across a plan.** Difficulty ramps Easy → Medium → Hard
by day, but day 1 and day 7 of a subtopic get the identical format list. Expertise
reversal says the opposite: worked-example formats should dominate early and thin out.

> **Before** — `cs/programming` day 1 and day 5 both: `tracetable, twopart, errorspot, sequence:trace, mcq, fill, truefalse, truefalse, matchpairs`
> **After** — day 1 weighted to `tracetable, errorspot` (worked examples); final day weighted to `twopart, write` (generation), same total length.

**2. Distractors are not built from the misconceptions already collected.** The prompt asks
for "plausible but definitely false" options, and separately asks for a `misconceptions`
array used only by the whiteboard. Shin et al. (2019) is explicit that misconception-derived
distractors raise item quality and diagnostic value.

> **Before** — distractor guidance: "a common slip, an off-by-one, a sign error".
> **After** — "Where the day's `misconceptions` array names a belief, at least one distractor in each MCQ must BE that belief, stated as a student would state it."

**3. The pre-test is 2 questions drawn only from `mcq`/`truefalse`.** Practitioner guidance
converging on Pan & Carpenter recommends 3–5 targeted at central lesson ideas. StudyFlow
lowered its floor to 2 because the newer formats are excluded from the pre-test pool.
That is a reasonable trade, but the *targeting* is unaddressed: pre-test items are drawn
at random from the day's simple questions rather than chosen for centrality.

> **After** — prefer questions whose stem overlaps the day's `keyTerms` or `microTopic`.

**4. `write` cards may show no feedback for a learner who submits nothing useful.** Moreira
et al. (2019) found short-answer formats failing without feedback. Confirm the
`modelAnswer` always renders.

**5. `classify` is used as a generic sorter.** Interleaving evidence supports it for
*confusable* categories specifically. Several subtopics use it to sort things nobody
confuses. `EVIDENCE: moderate`.

**6. No DOK mapping.** Difficulty is a label on the question, not a property of the task.

---

## Subjects

Format mixes and subtopic detail are in `question-matrix.json`. Per-subject notes:

**math** — Solving dominates, by design and by invariant: ~80% `bigequation`, plus
`wordproblem` and one `errorspot`. Research support is indirect — worked examples
(errorspot) plus retrieval through production. Blocking beats interleaving for
low-similarity procedures, so do not scatter types. *Pitfall:* vocabulary-style `fill`
and `match` cards violate the solving mandate and are gated off.

**science** — Split life / physical / earth. Process subtopics take `sequence`; confusable
pairs take `classify`; `twopart` carries the two-tier diagnostic pattern (answer + reason)
that the misconception literature supports. *Pitfall:* numeric questions drifting into
word problems — a science fill about ATP counts is not arithmetic.

**history** — Built on the four *Reading Like a Historian* skills. `passage` variants carry
sourcing and contextualization; `corroborate` is the only format that can express
corroboration because it is the only one showing two documents. *Pitfall:* date recall
sits at DOK 1 and crowds out causation.

**english** — `readingset` (one passage, several questions) is the correct shape for
comprehension; separate one-question passages fragment the text. Grammar takes `sentence`
production over terminology recall. *Pitfall:* naming a device with no text attached.

**language** — Production beats recognition: `sentence` builders and `fill` in context over
word-pair matching. *Pitfall:* isolated vocabulary with no sentence around it.

**psychology** — `scenario` application over "who discovered it"; research methods take
`twopart` and `corroborate` to judge study designs. *Pitfall:* stage names without
predictions.

**geography** — Physical takes process `sequence`; human takes `scenario`; `estimate` suits
magnitudes. *Pitfall:* capital-city trivia.

**economics** — One of two quantitative subjects: `wordproblem` and `estimate` are licensed
here. Direction of change matters more than the number. *Pitfall:* definitions with no
change to reason about.

**cs** — `tracetable` is the signature format (run the procedure by hand) and `errorspot`
the worked-example counterpart. *Pitfall:* syntax trivia a reference would answer.

**general** — Fallback. `scenario` + `twopart` + retrieval basics.

---

## Bibliography

All URLs below were fetched and read on 2026-09-11.

1. Moreira, B. F. T., Pinto, T. S. S., Starling, D. S. V., & Jaeger, A. (2019). Retrieval Practice in Classroom Settings: A Review of Applied Research. *Frontiers in Education*. https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2019.00005/full
2. Dunlosky, J. (2013). Strengthening the Student Toolbox: Study Strategies to Boost Learning. *American Educator*, Fall 2013. https://www.aft.org/ae/fall2013/dunlosky
3. Mera, Y., Dianova, N., & Marin-Garcia, E. (2025). The Pretesting Effect: Exploring the Impact of Feedback and Final Test Timing. *Journal of Cognition*. https://pmc.ncbi.nlm.nih.gov/articles/PMC12292081/
4. Main, P. (2025, updated 2026). The Pretesting Effect: Why Testing Before Teaching Works. Structural Learning. https://www.structural-learning.com/post/pretesting-effect-testing-before-teaching
5. Shin, J., Guo, Q., & Gierl, M. J. (2019). Multiple-Choice Item Distractor Development Using Topic Modeling Approaches. *Frontiers in Psychology*. https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2019.00825/full
6. Francis, E. M. (2017). What Is Depth of Knowledge? ISTE+ASCD Blog. https://www.ascd.org/blogs/what-exactly-is-depth-of-knowledge-hint-its-not-a-wheel
7. Carpenter, S. (2012). Using Spacing to Enhance Diverse Forms of Learning. ERIC ED536925. https://files.eric.ed.gov/fulltext/ED536925.pdf
8. Expertise reversal effect. Wikipedia (fetched as the accessible route to Kalyuga 2007; Kalyuga et al. 2003; Sweller et al. 1998). https://en.wikipedia.org/wiki/Expertise_reversal_effect
9. Digital Inquiry Group. Reading Like a Historian — History Lessons. https://www.inquirygroup.org/history-lessons

**Attempted and not citable.** These were sought and could not be verified, so nothing in
this document rests on them: Cepeda et al. (2006) distributed-practice meta-analysis
(York University and UCSD copies — expired/unverifiable certificates; augmentingcognition
PDF returned image-only binary); Cepeda et al. (2008) temporal ridgeline (expired
certificate); the 2025 multilevel prequestion meta-analysis in *Educational Psychology
Review* (Springer authentication gate); Dunlosky et al. (2013) full *PSPI* article
(image-only PDF) — the American Educator article by the same lead author is cited instead;
NSW CESE cognitive load theory (image-only PDF).
