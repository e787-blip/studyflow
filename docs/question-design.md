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
- [Multiple representations (mathematics education)](https://en.wikipedia.org/wiki/Multiple_representations_(mathematics_education))
- [Multiple Representations — SERP Institute](https://www.serpinstitute.org/sensemaking/multiple-representations)
- [Evidence-Based Selected Response questions](https://support.focalpointk12.com/hc/en-us/articles/115002565992-How-do-I-create-an-Evidence-Based-Selected-Response-Question-EBSR)
- [Text Dependent Questions (Wisconsin DPI)](https://dpi.wi.gov/sites/default/files/imce/ela/bank/RI.RRTC_Text_Dependent_Questions.pdf)
