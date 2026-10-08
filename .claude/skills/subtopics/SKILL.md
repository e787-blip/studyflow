---
name: subtopics
description: How StudyFlow splits any subject - including one it has never seen - into subtopics, groups them under a bigger topic when the plan is short, and turns each into a day's question mix. Use this whenever touching sf-topics.js, SUBTOPICS, resolveSubtopics, subjectPalette, classifySubject or the per-subject question mixes in app.html; whenever a subject lands in "general" or gets the wrong questions; whenever someone asks how a new or unusual subject (music, law, cooking, nursing, a driving test) is handled; and before adding a question type, a material flag or a kind to the mixes.
---

# Subtopics for any subject

There are two things called "the subtopic skill" and they go together:

- **`sf-topics.js`** at the repo root is the runtime skill. The plan builder
  (`app.html`) calls it once per plan, before the first day is generated.
- **This file** is how to work on it without breaking what it guarantees.

## 0. Why it exists - measured, not assumed

The subtopics used to be premade: 25 entries in `SUBTOPICS` (`app.html`),
matched by counting keywords. On ten test subjects, **eight fell straight
through to `general`** - music theory, contract law, nursing pharmacology,
cooking, ethics, accounting, a driving test and *astronomy* - and all eight got
the same `3 MCQ, 2 True/False, 2 Fill, 1 Write` day, prompted as "a study day
for a General student" with a content lock that read "a person who knows no
GENERAL at all". The two that did match were not safe either: photosynthesis
was split between *life* and *physical* science because the notes said
"light".

A keyword list can only recognise what someone thought to type into it. So the
model reads the notes, and the code decides what to do with what it read.

## 1. The division of labour - the one rule not to break

| The model says (one call) | The code decides (`judge` / `compose`) |
|---|---|
| what the subject is, and its broad **field** | which of the ten **families** it is held to |
| its **parts**, in teaching order, each with a **parent** | how parts are grouped when there are fewer days than parts |
| each part's **kind** of knowledge | the question **mix**, from rule tables |
| the **material** each part contains | which formats that material can honestly carry |
| what a good question on it asks / avoids | (passed through: capped, one line, no `<>`) |
| optionally, the premade subtopic it is **like** | whether that shape still fits the material |

**The model never picks a question type.** It describes what is in the notes -
"these are dated events", "this is a thing with parts you could point at" - and
`NEEDS` only lets a format in when the material can carry it. If a change lets
the model name types directly, every invariant that lives in the mix (no word
problems outside economics, no ordering card without a real order, the
producing share) becomes a request instead of a guarantee. That is the exact
failure `holdToPalette` was added to catch after the fact.

A model that under-reports material costs a **plainer** day, never a broken
one - the same rule the diagram kit follows.

## 2. The tree, and what "generalise" means

```
family    general                     (one of the app's ten - what lesson.html keys on)
  field     Music                     broad discipline; printed as the subject in prompts
    parent    Harmony                 the bigger topic a part sits under
      part      Intervals             what a day teaches
        covers    half steps; major and minor thirds; perfect fifth
```

- **Up to a parent** - when there are more parts than days (`fit`), siblings
  merge into their shared parent first ("Intervals" + "Triads" + "Chord
  progressions" -> "Harmony"), a part joins a parent node that already holds
  its siblings, and two halves of the same parent rejoin under its name.
- **Up to the field** - only when unrelated parts must share a day: "A and B"
  once, and the field's name after that. A merged part's `covers` start with
  the names of every part it absorbed, so the day still knows all of it.
  `check_topics.js` proves nothing is dropped for every parts x days pair.
- **Up to a premade shape** - a part may say it is `like` one of the 25 premade
  subtopics (`science/life`, `history/era`...). It then inherits that entry's
  research-tuned mix and guide, minus any format its material cannot carry.
  With full material all 25 come back **byte-identical** - that is a test.
- **Up to a family** - see the policy below.

## 3. The rule tables in `sf-topics.js`

| Table | What it says |
|---|---|
| `NEEDS` | a format and the material it needs (any one flag): `labeldiagram`<-parts, `sequence`<-order/dates, `sequence:parsons`<-code, `tracetable`<-calculation/code, `errorspot`<-procedure/code/calculation, `estimate`/`wordproblem`<-numbers/calculation, `corroborate`/`passage`/`readingset`<-sources/text, `sentence`/`dictation`<-sentences, `classify`<-categories (`classify:change`<-dates or categories), `readchart`<-numbers, `selfcheck:code`<-code |
| `earnedFor` | what each material adds, in priority order, at most 5 per day |
| `CORE` | the retrieval base for each of the six kinds, best first. Every one alone has 3 producing formats in 9. Since Oct 2026 the cores carry the five newer formats where their kind is their job: mechanism - whosright, conceptmap, selfcheck; procedure - selfcheck; facts and language - recall; interpretation and application - whosright (question-design §11) |
| `CAP` | one per day of the big or distinctive cards (labelling, ordering, trace table, corroborate, classify, errorspot, estimate, word problem, and the five of Oct 2026: recall, selfcheck, conceptmap, whosright, readchart); two of anything else. **Caps bound what `compose` adds** - an inherited premade list keeps its own counts (history/era asks for three passage cards: sourcing, context, perspective) |
| floor | producing formats (`fill write sentence estimate tracetable wordproblem dictation recall selfcheck`) >= 3 for a new mix, >= the premade list's own count for an inherited one - so cs/algorithms keeps its deliberate no-prose mix |
| family guard | never `bigequation`; `wordproblem` only on economics (invariant 8); `dictation` only on language (`ONLY_FAMILY` - `lesson.html` knows the language being learned only on a language day); never `truefalse` on history (`NEVER_FAMILY`, question-design §9) |
| `FAMILY_FIRST` | what a family asks for on every day, before the material's earned formats and spending their slots: history - `write:claim`, `passage:perspective` (needs sources/text), `classify:change` (needs dates or categories); language - `sentence`, `dictation`. Without it a part with no `like` was composed from the kind's core, which knows neither family, and none of those cards was ever asked for. `build()` also gives every language-family part `sentences` |

`compose(kind, material, family, inherited)` is pure and deterministic. The
kind also sets the day's **mandate** (`KIND_RULE`), which replaces the
subject-wide one - science's still asks for word problems its own palette
forbids, and a mandate that contradicts its quota reads to the model as
permission to improvise.

## 4. The family policy - asymmetric on purpose

- **Maths never reaches the skill.** Its mix is `MATH_MIX` and the synthesis
  floor (invariant 1); `mapTopicsThen` skips the call.
- **A family the local classifier chose stands.** It was tuned against real
  misfires ("French Revolution" -> language), and every table in `lesson.html`
  routes on it.
- **Only `general` is upgraded**, and **never to maths**: a false maths upgrade
  turns a driving test into ten equations a day; a missed one costs a composed
  mix that still produces answers.

## 5. What happens at plan time

`startGeneration` -> `mapTopicsThen(generateAllParallel)`:

1. One call, `SFTopics.prompt` (~7k chars + the same 8 000 chars of notes the
   days read), capped at `TOPICS_TIMEOUT_MS` (20 s). "Reading what your notes
   cover..." on the build screen.
2. `SFTopics.judge` -> `applyTopics`: family upgrade, `strategy.subtopics`
   replaced, `strategy.field` / `label` set, "Your notes cover: A · B · C" shown.
3. Days are dealt round-robin over the parts, as before. Each day's prompt now
   carries **TODAY'S PART OF THE NOTES** (every day of the first pass; after
   that the final day is left whole), the part's quota, guide, mandate and
   picture hint, and names the field where it used to say `GENERAL`.
4. Each day saves `day.subtopic` and an `allowedTypes` that admits its own mix;
   the plan saves `plan.topics`.

**Any failure is the old behaviour, byte for byte:** no reply, a 502, prose,
a refused map, a reply after the cap (ignored - day 2 must not be planned from
a different map than day 1), or `sf-topics.js` not loading.

`lesson.html` reads two things back: the top-up (`generateMoreQuestions`) adds
"Part of the course: ..., within ..." and the part's guide; `getFeynmanTip`
uses the model's `tip` on a `general` plan, **escaped** (`escHtml`), because it
goes into `innerHTML`.

## 6. Changing it safely

**Add a material flag** - `MATERIALS` (the model's definition), `earnedFor`
(what it unlocks), `NEEDS` if it gates a format. Then run `check_topics.js`:
the exhaustive pass is 2^flags material sets, so it doubles, and it will tell
you if any mix loses its floor.

**Add a kind** - `KINDS`, `CORE` (9 entries, 3 producing in the first 9),
`KIND_RULE`, `DEFAULT_ASK`, `DEFAULT_AVOID`, `kindFrom` if a material implies it.

**Add a question type to the mixes** - it must already be a full question type
(the eight-place list in `CLAUDE.md`). Then `KNOWN`, `NEEDS` if it needs
material, `CAP` if one a day is enough, and `PRODUCE` if the learner produces
the answer. Add it to `earnedFor` or a `CORE` list - otherwise nothing asks
for it. `check_topics.js`'s `KNOWN` list must match.

**Add or change a premade subtopic** - it is automatically offered to the
model as a `like` target (the prompt lists `SUBTOPICS`), and still used on its
own when the call fails. Its list must survive `check_topics.js` check 1.

**Change the prompt** - it is the only place the model learns the vocabulary.
Keep the example a subject with no family of its own (the model copies the
example - see `CLAUDE.md`, "The model copies the EXAMPLE"), and keep the
closing shape line last.

## 7. Test

```bash
node .claude/skills/subtopics/scripts/check_topics.js            # rules, ~8 s: TOPICS OK
node .claude/skills/morning-check/scripts/test_topics.js         # real pages, ~60 s: TOPICS PAGE OK
node .claude/skills/subtopics/scripts/preview.js                 # the demo map at 7/3/2/1 days
node .claude/skills/subtopics/scripts/preview.js --mix procedure calculation,categories
node .claude/skills/subtopics/scripts/preview.js answer.json 3   # judge a real model answer
```

Both checks are in the morning suite (`run_all.sh`). `check_topics.js` loads
the real `sf-topics.js` and pulls the real `SUBTOPICS` out of `app.html`, so it
cannot pass against a stale copy. `test_topics.js` needs the local server the
suite starts (`python3 -m http.server 8765` from the repo root).

## 8. Not yet known

- **No real model's map has been seen.** The cloud environment has no API key.
  First thing with one: map three unfamiliar subjects and a familiar one, save
  each raw answer, and run `preview.js answer.json <days>`. Check that parts
  are real parts of the notes, that `material` is honest (over-claiming `parts`
  asks for a labelling card of something with no parts), and how often `like`
  is used.
- **Time.** One more call before day 1 - small output, so probably 5-10 s
  against ~40 s a day, but unmeasured.
- **Subjects that span families** (biochemistry, economic history) get the
  family the local classifier chose. The parts still get their own mixes.
