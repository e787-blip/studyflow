---
name: subject-reader
description: Prototype that builds a day's questions from the IDEAS the notes state, with no table of counts or percentages anywhere, as an alternative to the CORE[kind] lists in sf-topics.js. Use this when asked to try, test, compare or promote the idea-based reader (sf-subject-read.js); when running the Haiku/Sonnet comparison on real notes; when a subject gets a mix that does not fit what its notes say; and before changing NATURES, AS or the reader's prompt.
---

# Subject reader (prototype)

`sf-subject-read.js` (in this folder) is **loaded by no page**. Nothing live
changes until it is promoted (see the end). It answers one question: can a day
come from what the notes actually say instead of from a per-kind list?

## How it differs from `sf-topics.js`

| | `sf-topics.js` (live) | `sf-subject-read.js` (this) |
|---|---|---|
| The model describes | parts, each with a **kind** and **material** flags | parts, each with **ideas**: one checkable sentence + what **nature** it is |
| The day's mix comes from | `CORE[kind]` + what the material earns + an inherited premade list | each idea picks its own format from `AS[nature]` |
| Day length | 7-10, fixed by the target | one card per idea (3-10); a second look only if the notes give fewer than 7 |
| "Who's right?" | a slot in some mixes | only for an idea with a real `confusedWith` |
| The day prompt | a quota line and a kind rule | the **ideas themselves**, one line per card, in the mandate |

Shared on purpose: the family policy (maths never reaches it; a local family
stands; only `general` is upgraded, never to maths), `allowed()` (so a family or
a missing material forbids the same formats in both), `clean()` (copied), the
part tree (parents, merging when days are short, nothing lost in a merge).

**The model never names a format**; `check_read.js` asserts the prompt
contains none. A format exists only when an idea can carry it: no step or
event idea means no ordering card (invariant 6), no `confusedWith` means no
who's-right card, only a language family dictates, history never gets
true/false, only economics gets a word problem.

## The one table: `AS`

`AS[nature]` is an ordered list of options, not a quota. An option is skipped
when the family forbids it, the idea cannot carry it, the day already has two of
that format (one of the large ones), or this idea was already asked that way.
11 natures: cause, step, distinction, term, quantity, source, rule,
composition, usage, code, event. They describe an *idea*, not a subject, so a
new subject needs no new entry.

The only guardrail is a floor: at least a third of the cards must produce an
answer. It is not a target; a day of ideas that all produce stays that way.

Two judgement calls worth knowing:

- `quantity` only gets `estimate` / `readchart` when the claim has a digit.
  "A perfect fifth is seven half steps" is a fact to recall, not a size to judge.
- A `step` with a digit in it counts as a calculation, which is what lets a
  trace table be written from it.

## Running it

Everything runs under Node, or without Node under macOS's JavaScriptCore:

```bash
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
$JSC .claude/skills/morning-check/browser/noderun.js -- "$PWD/.claude/skills/subject-reader/scripts/check_read.js"
$JSC .claude/skills/morning-check/browser/noderun.js -- "$PWD/.claude/skills/subject-reader/scripts/preview.js" music
```

- `check_read.js` - 60+ checks on nine hand-written subjects plus hostile input.
  Prints `READER OK`. It pins the code's behaviour, **not the model's**.
- `preview.js` - what a day looks like, card by card, with the idea each card
  is built from. `preview.js answer.json 5` reads a saved model answer.
- `run_models.py` - the real comparison. **Dry run by default** (builds both
  prompts for 8 sample subjects, sends nothing). `--go` makes the calls and
  needs `ANTHROPIC_API_KEY`; the cloud environment has none, so this is run on
  the user's Mac. Default models: today's (`claude-haiku-4-5-20251001`),
  `claude-haiku-5-5`, `claude-sonnet-5-5`. It sends the same system prompt
  `api/generate.js` does (read from that file), times every call, saves every
  raw answer, and prints `report.js`'s comparison of the new reader against
  today's `judge()` on the same notes. Use `--notes DIR` for real notes.

## What to read in the report

Flags it raises on its own: a call over 20 s (`TOPICS_TIMEOUT_MS` would make
the app give up and fall back), an unusable answer, more than half the ideas
sharing one nature, a nature outside the list. What it cannot flag, and a
person has to read: whether each `claim` is really **in the notes**, whether
`confusedWith` is a real misconception or a strawman, and whether the parts
are real parts. That is the open item the fixtures cannot close.

## Known gaps (not bugs: decisions to revisit)

- No `conceptmap` is ever produced; it needs a day-level view across ideas.
- `passage:context` and `classify:change` are never chosen (the first needs a
  source *and* a date; the second a changed-or-stayed pair).
- No inherited premade mixes at all, so `history/era`'s deliberate three
  passage cards are not reproduced. If the reader should match the 25 premade
  mixes, that is a separate decision: the reader would need a seed.
- A subject with very few ideas (8 total) can collapse to one day's worth of
  parts even on a 3-day plan; the notes did not support more.
- Prompt is ~6 500 characters plus up to 8 000 of notes. Output is larger than
  today's map (every idea is a sentence): ~3 000 tokens for 6 parts of 8 ideas.
  Time it before trusting it inside the 20 s cap.

## Promoting it (not done; each step is a separate, reviewed change)

1. Run `run_models.py --go` on real notes and read the ideas. Stop here if the
   claims are not in the notes.
2. `api/generate.js` hardcodes `claude-haiku-4-5-20251001`; accept a `model`
   field, allow-listed, for this one call.
3. Move the file to the repo root as `sf-*.js`, load it after `sf-topics.js` in
   `app.html`, and in `mapTopicsThen` try `SFSubjectRead.read` first and
   `SFTopics.judge` second, behind a flag. A `null` from either must still build
   the plan exactly as before.
4. `generateDay` already reads `label`, `types`, `guide`, `mandate`, `visual`,
   `focus`, `key` from a made subtopic; it needs nothing new. It may also use
   `slots` to put each idea's claim next to its card in the prompt.
5. Add the new file to the morning check's parse list and this check to
   `run_all.sh`; re-run `test_mix.js` and `test_topics.js`, which capture real
   prompts and fail on an off-palette type or a shared mix.
6. Only then consider shrinking `CORE` and the inherited seeds in `sf-topics.js`.
