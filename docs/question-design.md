# Why each subject gets the questions it gets

The per-subtopic mixes in `app.html` are design decisions, and this is what they
rest on. Written down because "reading comprehension should get passage
questions" is obvious enough to go unexamined, and some of what follows
contradicts the obvious version.

Read alongside `SUBTOPICS` in `app.html`. If you change a mix, change this too.

## 1. Producing an answer beats choosing one — but not by as much as you think

Retrieval practice beats rereading, and formats that make the learner *generate*
an answer (short answer, fill, free recall) generally produce larger testing
effects than formats where they *select* one.

The qualifier matters, though: a meta-analysis finds multiple-choice testing is
**at least as effective** as recall formats for producing testing effects, and
that the best format depends on the goal — recognition practice helps
recognition-oriented goals, recall practice helps recall-oriented ones. Short
answer sharpens the specific fact retrieved; free recall carries more of the
surrounding material with it.

**What this justifies:** fill and write appear in every subtopic mix, and no
subtopic is built only from MCQ. **What it does not justify:** removing MCQ.
An earlier instinct to strip it out was wrong; a well-built MCQ with plausible
distractors is real retrieval, which is why the prompt spends as much space on
distractor quality as it does.

## 2. Novices need worked examples; experts do not

The worked-example effect is one of the most replicated results in instructional
design: learners with low prior knowledge do better studying a worked solution
than solving the equivalent problem, because problem-solving by trial and error
consumes the working memory that schema-building needs.

It reverses with expertise. The same worked examples that help a novice stop
helping — and can hurt — once the learner has the schema.

**What this justifies:** the errorspot format (read a worked solution, find the
one wrong step) as a genuine learning format rather than a novelty, and the
difficulty ramp. StudyFlow already sends `Easy` on day 1, `Medium` in the
middle, `Hard` on the last day, which is where scaffolding should decay.
**Not yet done:** the mix does not itself shift with difficulty. That is the
obvious next move and it is not implemented.

## 3. Interleaving helps confusable things, not everything

Interleaving improves learning of **similar, easily confused** categories,
because it forces between-category comparison. For categories that are
internally varied and not confusable, blocked practice can be better — it
directs attention to what members of one category share.

The strongest classroom evidence is in mathematics strategy selection.
Outside maths, applied evidence is thin, and classroom recommendations are
design suggestions rather than proven outcomes.

**What this justifies:** classify cards, which exist to make two confusable
categories sit side by side, concentrated in subtopics where confusion is the
actual difficulty (psychology/methods, cs/systems, geography/human). **The
caveat is load-bearing:** this is the weakest evidence of the four, and the
mixes should not be defended as if it were settled.

## 4. "Why" and "how" questions, for this age group especially

Elaborative interrogation (explain *why* a fact is true) and self-explanation
(explain your own reasoning) both earn moderate-utility ratings in Dunlosky et
al.'s review — below practice testing and distributed practice, above
highlighting and rereading. They work best for upper-elementary through
high-school learners who already have some background knowledge.

That is exactly StudyFlow's audience and exactly its position in a session:
the learner has just read the lesson card.

**What this justifies:** the write/Feynman cards, and the wording of every
subtopic guide — they ask for a mechanism, a cause, or an application, and
`AVOID` lines rule out naming and definition-recall.

## 5. Six formats the original twelve could not express

The research above kept pointing at interactions, not topics — and the same
interaction kept coming up in different subjects under different names.

**Two-tier diagnostics** (science) ask for an answer and then the reasoning
behind it, so a right answer reached by guessing can be told apart from one
that is understood; the reason tier is what makes that visible, and adding it
measurably cuts guessing. **Evidence-based selected response** (English, and
the STAAR/PARCC family) asks Part A for the answer and Part B for the line of
text supporting it. Those are the same card. That is `twopart`, and it is why
credit requires both parts — and why Part B stays hidden until Part A is
committed, since the reason list otherwise gives Part A away.

**Corroboration** is one of the four historical reading skills in Stanford's
Reading Like a Historian framework, alongside sourcing, contextualisation and
close reading. StudyFlow could already ask the other three; corroboration needs
two documents on screen at once, which no existing format allowed. That is
`corroborate`. **Close reading** of a specific line is `highlight`.

**Multiple representations** — translating between an equation, a table, a
graph and a description — is a core NCTM process standard and associated with
higher conceptual understanding than working in one representation alone. That
is what `matchpairs` is for outside vocabulary.

`tracetable` is the worked-example effect made active: the procedure is given
and the learner carries the values through it. `estimate` exists because
reasoning to the right order of magnitude is a different skill from computing
an exact value, and marking 47 wrong against a key of 50 tests neither.

**What this does not establish:** that these six are the best six, or that the
per-subject assignment is optimal. They are formats with research behind the
*interaction*; which subtopic gets which is judgment.

## 6. What the walkthrough board is shaped like, and why

The board behind the **Walkthrough** button, and the one the session opens on,
are the same scene. Four findings decide its shape, and a fifth is not
implemented yet.

**Worked examples beat unguided problem solving for novices** — section 2
above. That is why the button exists at all, rather than showing the right
answer and moving on.

**Segmenting: one step at a time, learner-paced.** Presenting a complex
sequence in learner-controlled parts beats presenting it whole. The board is
`manual: true` for this reason — every other scene reveals on a 1.5s timer,
which for a solution walks off the answer before the line has been read.

**Coherence, and the seductive-detail effect: cut what is interesting but
not needed.** The strongest version of this in the codebase was the
`progressStrip` that used to fill each panel — a diagram of the list of steps,
drawn inside the list of steps. It was not decoration anybody chose; it was
the fallback firing because nothing better was available, which is the same
thing from the learner's side.

**Signaling: cue the organisation once.** Four simultaneous encodings of
"which step" (count, rail, dots, numbered disc) is not four times the
signalling. The two that survived are the two the learner can act on.

**Spatial contiguity: words next to what they explain.** A reason pinned to
the bottom edge of a card with the line it explains at the top is the split
the principle is about, and it is why a panel with no picture now centres
line and reason together.

**Not implemented: self-explanation prompts, and fading.** Asking the learner
to explain why a step works before revealing the reason reliably beats showing
the reason alone, and *backward fading* — blanking the last step, then the
last two — is the evidence-backed way to hand the work back as skill grows.
Both would change this board from something you read into something you do.
Neither is built.

## 7. What each subject should ask — measured, then checked against the evidence

### First, what the palettes actually do now

Every subtopic's `types` list was classified as **producing** an answer
(`fill`, `write`, `sentence`, `estimate`, `tracetable`, `bigequation`,
`wordproblem`) or **choosing / arranging** one (`mcq`, `truefalse`,
`matchpairs`, `highlight`, `classify`, `sequence`, `errorspot`, `passage`,
`readingset`, `corroborate`, `scenario`, `twopart`):

| Subject | Produce share | | Subject | Produce share |
|---|---|---|---|---|
| history | **14%** | | geography | 33% |
| general | 22% | | science | 33% |
| english | 25% | | language | 38% |
| psychology | 26% | | economics | **48%** |
| cs | 30% | | | |

**A 3.4× spread, and nothing decided it.** These lists were written subject
by subject; no one ever put them side by side. Two caveats on the number
before drawing conclusions from it: `twopart` is counted as *choosing*
although its Part B is usually a written justification, so every
twopart-heavy subject is understated; and section 1 of this document already
warns that producing beats choosing **less than people assume**. The spread
is the finding, not the direction.

The sharper version of the same measurement: **six subtopics contain no
written production at all** — `history/civics`, `history/era`,
`english/reading`, `english/literature`, `language/grammar`,
`language/vocab`.

### Language, since it was asked about specifically

Language already has three subtopics — `grammar`, `reading`, `vocab` — like
every other non-maths subject. Maths is the only one without, deliberately.

The finding that matters for it is **symmetry of practice and outcome**:
productive retrieval practice produces productive knowledge, receptive
practice produces receptive knowledge, and on a productive test the
productive condition wins outright while on a receptive test the two tie
([receptive vs productive retrieval](https://www.researchgate.net/publication/303939278_The_Effects_of_Receptive_and_Productive_Word_Retrieval_Practice_on_Second_Language_Vocabulary_Learning);
[retrieval formats](https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/abs/effects-of-learning-direction-in-retrieval-practice-on-efl-vocabulary-learning/159EE50F4B8835207764FB1B11077F29)).
Recall formats beat recognition for productive orthographic knowledge;
recognition is the reasonable choice only when spelling is not the point.

`language/vocab` currently reads `matchpairs, matchpairs, fill, fill, mcq,
mcq, sentence, twopart, truefalse` — **five of nine are recognition**
(2 matchpairs, 2 mcq, truefalse). If the goal of studying vocabulary is to
be able to *use* the word, that mix trains the half the learner is not being
tested on. The cheap correction is to drop one `matchpairs` and one `mcq`
for a `write` and a second `sentence`.

For grammar the meta-analytic picture is that **explicit instruction beats
implicit**, and explicit explanation combined with *guided production*
beats exposure alone
([Norris & Ortega revisited](https://benjamins.com/catalog/sibil.48.18goo);
[forms of explicit instruction](https://onlinelibrary.wiley.com/doi/10.1111/flan.12726);
[35 years of form-focused instruction](https://journals.sagepub.com/doi/10.1177/1362168818776671)).
`language/grammar` has `sentence` twice, which is exactly right, and no
`write` at all.

### Computer science — the clearest single win available

**Parsons problems** — reorder given code lines into a working program —
produce the same pre-to-post learning gains as writing the equivalent code,
significantly faster, at lower cognitive load
([Parsons vs writing/fixing code](https://dx.doi.org/10.1145/3141880.3141895);
[efficiency and cognitive load](https://dl.acm.org/doi/10.1145/3411764.3445292)).

StudyFlow already has the format. `sequence` is a Parsons problem the moment
its items are lines of code, and `cs/programming` and `cs/algorithms`
already carry `sequence:trace`. What is missing is telling the model that is
what it is. One caveat from the same literature and it matters for this
audience: **distractor lines reduce learning efficiency for young novices**,
so a school-age Parsons problem should contain only lines that belong.

### Science — the format is already right, one addition

Two-tier diagnostics are validated for exposing misconceptions: tier one
asks the fact, tier two asks the reason, and the pair distinguishes
understanding from a lucky guess. `twopart` is that format and it already
leads all three science subtopics.

The addition worth making is **Predict–Observe–Explain**: commit to a
prediction *before* being shown the outcome. One study reports
misconceptions falling from 57% to 5%
([POE and misconceptions](https://www.atlantis-press.com/article/125928573.pdf);
[POE as diagnosis](https://www.academia.edu/26222673/The_Effectiveness_of_Predict_Observe_Explain_Tasks_in_Diagnosing_Students_Understanding_of_Science_and_in_Identifying_Their_Levels_of_Achievement)).
That is the same mechanism as the prediction step now on the maths worked
board — withhold the answer until the learner has committed — and it needs
no new question type, only a `twopart` whose Part A is a prediction.

### History — the outlier, and the missing skill

Reading Like a Historian names **four** skills: sourcing, contextualization,
corroboration, close reading. A document-based intervention built on them
showed significant effects on historical thinking, transfer to contemporary
issues, factual knowledge **and** general reading comprehension
([RLH intervention](https://www.tandfonline.com/doi/abs/10.1080/07370008.2011.634081);
[AIR project summary](https://www.air.org/project/reading-historian-preparing-students-understand-past-and-present)).

StudyFlow covers three of the four: `passage:sourcing`, `corroborate`, and
`highlight`/`passage` for close reading. **Contextualization is absent** —
nothing asks the learner to place a document in its moment. And history is
the least productive subject in the app at 14%, with two of its three
subtopics containing no writing at all, in a discipline whose assessed
output is an argument from evidence.

### What this does not establish

- **The 3.4× spread is not itself evidence of a problem.** Disciplines
  differ in what competent performance looks like, and the produce/choose
  classification above is crude — `twopart` is scored as choosing even
  though its second tier is usually written.
- **No effect size here is specific to a 30-minute phone session with a
  generative model writing the questions.** Parsons problems were studied in
  CS1 courses, POE in classrooms with an actual demonstration to observe,
  RLH over six months of document work. Nothing says the gains survive the
  translation.
- **Nothing was measured on StudyFlow's own learners.** Every number above
  comes from the literature; the only thing measured here is what the
  palettes currently contain.

## What none of this establishes

- **The specific counts.** That reading comprehension gets four passage
  questions and not three is judgment, not a measured optimum.
- **Any StudyFlow-specific result.** Nothing here was measured on this app with
  these learners. There is no A/B data.
- **That interleaving transfers** to history or English at this age. See §3.

## Sources

- [Retrieval Practice in Classroom Settings: A Review of Applied Research](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2019.00005/full)
- [It matters how to recall – task differences in retrieval practice](https://link.springer.com/article/10.1007/s11251-020-09526-1)
- [Why is free recall practice more effective than recognition practice?](https://www.sciencedirect.com/science/article/abs/pii/S0749596X19300026)
- [Cognitive load theory: Research that teachers really need to understand (NSW CESE)](https://education.nsw.gov.au/content/dam/main-education/about-us/educational-data/cese/2017-cognitive-load-theory.pdf)
- [Effects of worked examples, example-problem, and problem-example pairs on novices' learning](https://www.sciencedirect.com/science/article/abs/pii/S0361476X1000055X)
- [Spacing and Interleaving Effects Require Distinct Theoretical Bases](https://link.springer.com/article/10.1007/s10648-021-09613-w)
- [Interleaved Training and Category Learning (Kang)](https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-interleaved-training-and-category-learning-kang.pdf)
- [Improving Students' Learning With Effective Learning Techniques (Dunlosky et al., 2013)](https://iverson.cm.utexas.edu/courses/310M/Handouts/Dunlosky%20et%20al.%20-%202013%20-%20Improving%20Students%E2%80%99%20Learning%20With%20Effective%20Learni.pdf)
- [Strengthening the Student Toolbox (Dunlosky, American Educator)](https://www.aft.org/ae/fall2013/dunlosky)
- [Informing the uninformed: a multitier approach to uncover students' misconceptions](https://journals.physiology.org/doi/pdf/10.1152/advan.00130.2018)
- [Development of two-tier diagnostic instrument in chemistry](https://www.researchgate.net/publication/254383547_Development_of_two-tier_diagnostic_instrument_and_assess_students'_understanding_in_chemistry)
- [Stanford History Education Group — Reading Like a Historian](https://csaa.wested.org/resource/stanford-history-education-group-reading-like-a-historian/)
- [Historical Thinking Chart (SHEG)](https://www.trumanlibrary.gov/sites/default/files/2019-10/Copy%20of%20Historical%20Thinking%20Chart.pdf)
- [Principles for reducing extraneous processing: coherence, signaling, redundancy, spatial and temporal contiguity (Mayer & Fiorella)](https://edtechuvic.ca/wp-content/uploads/sites/11/2022/09/principles-for-reducing-extraneous-processing-in-multimedia-learning-coherence-signaling-redundancy-spatial-contiguity-and-temporal-contiguity-principles.pdf)
- [Cognitive architecture and instructional design: 20 years later (Sweller et al.)](https://link.springer.com/article/10.1007/s10648-019-09465-5)
- [How fading worked solution steps works — a cognitive load perspective (Renkl & Atkinson)](https://link.springer.com/article/10.1023/B:TRUC.0000021815.74806.f6)
- [Transitioning from studying examples to solving problems: self-explanation prompts and fading](https://mrbartonmaths.com/resourcesnew/8.%20Research/Making%20the%20most%20of%20examples/Fading%20out%20and%20Prompts.pdf)
- [The effect of worked examples on learning solution steps and knowledge transfer](https://www.tandfonline.com/doi/full/10.1080/01443410.2023.2273762)
- [Receptive and productive word retrieval practice in L2 vocabulary](https://www.researchgate.net/publication/303939278_The_Effects_of_Receptive_and_Productive_Word_Retrieval_Practice_on_Second_Language_Vocabulary_Learning)
- [Effects of learning direction in retrieval practice on EFL vocabulary (SSLA)](https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/abs/effects-of-learning-direction-in-retrieval-practice-on-efl-vocabulary-learning/159EE50F4B8835207764FB1B11077F29)
- [Norris & Ortega revisited: implicit and explicit L2 instruction](https://benjamins.com/catalog/sibil.48.18goo)
- [Effects of different forms of explicit instruction on L2 development (meta-analysis)](https://onlinelibrary.wiley.com/doi/10.1111/flan.12726)
- [Thirty-five years of ISLA on form-focused instruction (meta-analysis)](https://journals.sagepub.com/doi/10.1177/1362168818776671)
- [Solving Parsons problems versus fixing and writing code](https://dx.doi.org/10.1145/3141880.3141895)
- [Problem-solving efficiency and cognitive load for adaptive Parsons problems](https://dl.acm.org/doi/10.1145/3411764.3445292)
- [Predict-Observe-Explain and misconceptions](https://www.atlantis-press.com/article/125928573.pdf)
- [POE tasks for diagnosing understanding](https://www.academia.edu/26222673/The_Effectiveness_of_Predict_Observe_Explain_Tasks_in_Diagnosing_Students_Understanding_of_Science_and_in_Identifying_Their_Levels_of_Achievement)
- [Reading Like a Historian: a document-based curriculum intervention](https://www.tandfonline.com/doi/abs/10.1080/07370008.2011.634081)
- [Reading Like a Historian project summary (AIR)](https://www.air.org/project/reading-historian-preparing-students-understand-past-and-present)
- [Multiple representations (mathematics education)](https://en.wikipedia.org/wiki/Multiple_representations_(mathematics_education))
- [Multiple Representations — SERP Institute](https://www.serpinstitute.org/sensemaking/multiple-representations)
- [Evidence-Based Selected Response questions](https://support.focalpointk12.com/hc/en-us/articles/115002565992-How-do-I-create-an-Evidence-Based-Selected-Response-Question-EBSR)
- [Text Dependent Questions (Wisconsin DPI)](https://dpi.wi.gov/sites/default/files/imce/ela/bank/RI.RRTC_Text_Dependent_Questions.pdf)
