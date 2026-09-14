# StudyFlow — How to Teach a Topic

Research behind the **whiteboard teaching mode**. The companion file
`QUESTION-RESEARCH.md` covers how to *assess* a topic; this one covers how to
*explain* it.

Same rule as that file: every citation below was fetched and read at the URL
given. Where a primary source was not retrievable, it is cited through a source
that was, and labelled. Nothing here rests on a source I could not open.

Generated 2026-09-12.

---

## Executive summary

Four findings shape how a beat should be built.

**Teach in small steps and check after each one.** Rosenshine's synthesis of
effective-teaching research puts "present new material in small steps" and
"check for understanding" among ten principles, with roughly an 80% success
rate during guided practice as the target — challenged but not lost. This is
the whole argument for a beat-at-a-time board over a paragraph of text, and it
says the checkpoint is not decoration.

**Model the thinking, do not just state the result.** "Provide models" means a
worked example with the expert reasoning narrated, not a finished answer. A
beat that asserts a conclusion teaches less than one that shows the move.

**Segment at the learner's pace, signal what matters, cut everything else.**
Mayer's multimedia principles: segmenting (self-paced chunks), signalling
(cues that point at the essential part), coherence (remove the extraneous),
redundancy (do not present identical information twice in two channels).

**Words plus a picture beat words alone** — the multimedia principle itself.
A beat with a `show` teaches more than a beat of prose.

What follows from this for StudyFlow is mostly discipline rather than
machinery: the board already segments and self-paces. What it was not doing
was insisting on a worked example, requiring checkpoints, or preventing the
headline from restating the sentence underneath it.

---

## 1. Small steps, and checking after each

Rosenshine's ten principles are: daily review; present new material in small
steps; ask questions; provide models; guide learner practice; check for
understanding; obtain a high success rate; provide scaffolds for difficult
tasks; independent practice; weekly and monthly review.

On small steps: *"Break complex content into teachable chunks and check each
step before adding the next"* — sequencing to avoid overwhelming working
memory. On checking: *"Look for evidence from the whole class before moving
on"* rather than assuming comprehension. On success rate: roughly **80%**
during guided practice, the balance where learners are challenged but not
overwhelmed.

**What StudyFlow does with it.** The beat *is* the small step, and the board
advances only when the learner says so. The `checkpoint` field is the check —
so it should be present on most beats, not treated as optional garnish.

- Rosenshine, B. (2012). *Principles of Instruction: Research-Based Strategies
  That All Teachers Should Know*. American Educator, Spring 2012 —
  https://www.aft.org/ae/spring2012/rosenshine
  (page fetched and confirms title/author/year; the body is served as a PDF,
  so the principle list and the 80% figure are quoted from the practitioner
  guide below rather than from the article text)
- Rosenshine's Principles: A Teacher's Guide, Structural Learning —
  https://www.structural-learning.com/post/rosenshines-principles-a-teachers-guide

## 2. Model the thinking

"Provide models" in Rosenshine's framing means *"show what success looks like
and narrate the expert thinking behind the example"* — worked examples, live
modelling, and comparing strong with weak responses. This lines up with the
worked-example effect and its expiry: guidance essential for novices becomes
redundant, then harmful, as expertise grows (see `QUESTION-RESEARCH.md` §3).

**What StudyFlow does with it.** At least one beat per lesson must carry the
actual worked move — the real equation, the real trace — not a description of
one. The `show` field is where that lives.

- As above (Rosenshine 2012; Structural Learning guide)
- Expertise reversal effect — https://en.wikipedia.org/wiki/Expertise_reversal_effect

## 3. Segmenting, signalling, coherence, redundancy

Mayer's twelve multimedia principles are: multimedia, coherence, signalling,
redundancy, spatial contiguity, temporal contiguity, segmenting, pre-training,
modality, voice, personalisation, image. The four that bear on a whiteboard:

- **Segmenting** — *"better learning outcomes are achieved when information is
  segmented, and students have control over the pace."*
- **Signalling** — *"learning is enhanced when cues are added to draw attention
  to vital information."*
- **Coherence** — *"learning is more effective if unnecessary information is
  excluded rather than included."*
- **Redundancy** — presenting identical information in two formats at once
  creates overload.

`EVIDENCE: moderate.` Effect sizes are widely reported for these principles in
the literature, but the pages carrying them were not retrievable here (a
Springer systematic review sits behind an authentication gate), so no numbers
are asserted in this document.

**What StudyFlow does with it.** Segmenting is the board's core design. For
signalling there is the `highlight` show kind. Coherence is why the board has
no decoration and why prior beats dim rather than compete. Redundancy is why a
beat's headline must not restate its own sentence, and why the whiteboard must
not repeat `day.content`.

- Mayer's 12 Principles of Multimedia Learning, Digital Learning Institute —
  https://www.digitallearninginstitute.com/blog/mayers-principles-multimedia-learning

## 4. Words with a picture

The multimedia principle — people learn better from words *and* graphics than
from words alone — is the reason a beat should carry a `show` wherever the
material has a shape: an equation, a trace table, a diagram, a short list.
StudyFlow already has one diagram system (`generateDiagramSVG`, 22 curated
templates plus an 11-layout kit), and the whiteboard calls into it rather than
drawing its own.

- As above (Digital Learning Institute)

---

## What changed in the app because of this

| Finding | Change |
|---|---|
| Small steps | Beat cap tightened from 9 to **7**, matching the 4–7 budget the prompt asks for |
| Check for understanding | Checkpoints now requested on **most** beats and rendered with an explicit "Check yourself" label, not an unlabelled italic line |
| Provide models | The prompt now requires **at least one beat to carry the actual worked move** in `show` |
| Signalling | The prompt asks for `highlight` on the one part that matters most |
| Multimedia | The prompt asks for a `show` on most beats, not as an afterthought |
| Redundancy | `whiteboard.js` drops a headline that merely restates its own `say` |
| Coherence | Already enforced by design: no decoration, prior beats subordinate |

## Attempted and not citable

Nothing in this document rests on these. **Concreteness fading** (concrete →
pictorial → abstract) is well attested in the mathematics literature and would
have shaped beat ordering, but no copy was retrievable: ERIC reset the
connection, MDPI returned 403, there is no encyclopedia entry, and the
ScienceDirect and Springer copies are paywalled — so it is not cited and not
acted on. Mayer **effect sizes** were likewise not retrievable from a source I
could open.
