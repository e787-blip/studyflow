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

## 8. Language cards: listening, self-repair, and the keyboard (Oct 2026)

Language was the one subject whose cards ignored how language is learned.
Three findings, and what each changed.

**Prompting a learner to fix an error beats telling them the right form.**
Lyster and Ranta's classroom study (four immersion classes, 18 hours) found
recasts - repeating the learner's sentence corrected - were 55% of all
feedback and the *least* likely to be taken up, while prompts that withhold
the correct form (elicitation, metalinguistic clues) were the most likely to
end in the learner repairing it themselves. So:

- **A fill-in answer that is right except for its accents gets one prompt,
  not the answer**: "Almost - look at the accents". The accent still counts:
  *hablo* (I speak) and *habló* (he spoke) are different words, which is the
  whole point of a preterite lesson. A second accent-only miss is graded wrong
  and shows the answer.
- **The sentence builder's first wrong check marks which words are already in
  place** and hands the line back; only the second shows the sentence.

**A learner without the keys cannot produce the form.** A school Chromebook
has no ñ. So every language answer box carries the letters for that language
(Spanish á é í ó ú ñ ü ¿ ¡, French, German, Italian, Portuguese and Hawaiian
sets), typed at the caret. Leading ¿/¡ and closing punctuation never count.

**Listening had no card at all, and partial dictation is the cheap, measured
way in.** Dictation studies with school learners found listening gains over
controls; partial dictation (a transcript with gaps, heard while read)
slightly outperformed dictogloss, and reading-while-listening dictation beat
listening alone. That is the new `dictation` card: the sentence on screen with
one word missing, read aloud by the browser's own voice at normal or slower
speed, the learner types the word. Only a voice FOR that language is used -
an English voice reading Spanish teaches the wrong sounds - and with none the
card says so and stays answerable as a reading gap-fill.

**The mixes.** Every language subtopic traded its true/false (a coin flip on a
sentence, and recognition) for a dictation; conversation, the subtopic most
about hearing, asks for two. The sentence builder became a real word bank:
the old card was the ordering list - "put these events in order" - and HTML
drag-and-drop barely works on a phone.

**Not established:** that the gains above transfer to a 9-question app
session; the dictation studies ran for weeks. Translation direction (L1->L2
vs L2->L1) has no consensus in the literature, so the mixes keep both.

## 9. History cards: the skills nothing asked for (Oct 2026)

The history mixes already covered Reading Like a Historian's four reading
skills - sourcing, contextualization, corroboration, close reading - and that
programme is the strongest evidence in the subject: six months of
document-based lessons in five urban high schools beat control classrooms on
historical thinking, transfer, factual knowledge AND general reading
comprehension (Reisman 2012). Mapped against Seixas's six historical thinking
concepts, three were missing entirely.

**Continuity and change.** Nothing asked what changed and what did not. The
sorting card now has a variant, `classify:change`: three things that really
changed across the period and three that really continued ("Then and now").

**Historical perspectives.** The passage card had a "Historical Perspective"
label that no mix ever asked for. `passage:perspective` is a source written at
the time and the question is why its author saw or acted as they did, given
what they knew. Students judge the past by present standards - "presentism" -
and Lee and Ashby frame perspective-taking as understanding a belief without
sharing it. So one wrong option is always the presentist reading, and the
explanation names the trap.

**Argument from evidence, and significance.** History writing was "explain a
cause in a sentence". A historian argues: claim, evidence, and why the evidence
supports the claim. De La Paz's cognitive-apprenticeship work moved
middle-school students' argument writing with exactly that structure. The new
**Make your case** card (`write` with `"mode":"claim"`) asks a question that can
be answered either way - was it a turning point, which cause mattered most - and
gives three boxes. The tutor grades the ARGUMENT (claim 3, evidence 4, reasoning
3), never agreement with the model answer, and flags presentism kindly. Like
teach-it-back it is not in the percentage.

**True/false is out of every history mix.** Think-aloud studies of short
history assessments found multiple-choice items drew more "construct-
irrelevant" thinking - recall, recognition and test-taking - than short
written ones (Smith, Breakstone & Wineburg). A true/false is the thinnest
multiple-choice item there is. Its slot went to the perspective card.

**Not established:** the Reisman and De La Paz gains came from months of
teacher-led lessons, not a 10-card session; the cards borrow the TASKS those
studies used, not their dose. The ethical dimension, Seixas's sixth concept,
is deliberately not a card - it has no answer key, and a tutor grading a
child's ethics is not a line this app should cross.

## 10. Mixes for subjects nobody wrote a list for

Since Sept 2026 the day mixes are composed by `sf-topics.js` from what the
notes contain, so a subject with no premade entry — music, law, cooking — is no
longer handed one generic mix. The composition rules are this document's
findings written as code, not new claims:

| Rule | Rests on |
|---|---|
| every kind's core has fill and write, and a new mix keeps **3 of 9** producing | §1 — production generally beats selection, and no mix is MCQ only |
| `facts` puts fill and matchpairs first, recall before recognition | §7 — productive retrieval builds the knowledge the learner uses |
| `mechanism` leads with `twopart`, its rule asks for a prediction first | §5 two-tier diagnostics; §7 Predict–Observe–Explain |
| `procedure` leads with `errorspot`; calculation earns `tracetable` | §2 worked-example effect; §5 tracetable as the active form |
| code earns `sequence:parsons` (never distractor lines) and `tracetable` | §7 Parsons problems |
| sources earn corroborate and sourcing, and **with dates** contextualisation | §7 all four Reading Like a Historian skills |
| categories earn one `classify`, never more | §3 — interleaving helps confusable categories, and it is the weakest evidence here |
| an ordering card only with a real order, a labelling card only with real parts | invariant 6; the labelling card's own section in `CLAUDE.md` |
| an inherited premade mix keeps its own producing count | §7 — the spread between subjects is not itself a defect |

**What this does not establish:** that the model describes material honestly
(nothing has been measured against a real model yet), or that six kinds are
the right six. They are the distinctions §1–§7 already draw — mechanism,
procedure, fact, reading, application, language production — and nothing more
was invented to fill the table.

## What none of this establishes

- **The specific counts.** That reading comprehension gets four passage
  questions and not three is judgment, not a measured optimum.
- **Any StudyFlow-specific result.** Nothing here was measured on this app with
  these learners. There is no A/B data.
- **That interleaving transfers** to history or English at this age. See §3.

## Sources
- [Reisman (2012), Reading Like a Historian, Stanford dissertation](https://purl.stanford.edu/by786ht6640) and [summary](https://historynewsnetwork.org/article/147039)
- [Seixas & Morton, The Big Six historical thinking concepts](https://www.thenhier.ca/en/content/seixas-peter-and-tom-morton-big-six-historical-thinking-concepts-2012.html)
- [Historical thinking concepts (Canadian Encyclopedia)](https://www.thecanadianencyclopedia.ca/en/article/historical-thinking-concepts)
- [Lee & Ashby, empathy, perspective taking and rational understanding](https://www.thenhier.ca/en/content/lee-p-and-r-ashby-“empathy-perspective-taking-and-rational-understanding”-2001.html)
- [Smith, Breakstone & Wineburg, History Assessments of Thinking: a validity study](https://purl.stanford.edu/tj409fm6721)
- [Can multiple-choice items tap historical thinking? (Inquiry Group)](https://inquirygroup.org/node/341)
- [De La Paz et al., disciplinary writing instruction in social studies (IES)](https://ies.ed.gov/use-work/awards/disciplinary-writing-instruction-social-studies-classroom-path-adolescent-literacy)
- [Lyster & Ranta (1997), corrective feedback and learner uptake](https://escholarship.mcgill.ca/downloads/3r074z95m)
- [Prompts and recasts in immersion classrooms (McGill eScholarship)](https://escholarship.mcgill.ca/downloads/3f462923r?locale=en)
- [Dictation and listening comprehension (Kindai University repository)](https://kindai.repo.nii.ac.jp/records/14254)
- [Frequent dictation and EFL listening (TESL Canada Journal)](https://teslcanadajournal.ca/index.php/tesl/article/download/938/757/965)
- [Reading-listening integrated dictation (Chinese Journal of Applied Linguistics)](https://www.degruyterbrill.com/document/doi/10.1515/CJAL-2021-0026/html)
- [Partial dictation vs dictogloss](https://research.vit.ac.in/publication/partial-dictation-vs-dictogloss-effect-on-listening-comprehension)
- [L1->L2 vs L2->L1 retrieval direction, review (HSJ Filología)](https://revista-hsj-filologia.unavarra.es/hsj-Filologia/en/article/view/2663)

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
