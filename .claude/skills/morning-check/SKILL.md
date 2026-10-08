---
name: morning-check
description: The daily StudyFlow morning run - check everything for bugs, fix what is broken, then make ONE improvement to the visuals, on a usage budget. Use when a scheduled morning routine fires, or when asked to "run the morning check", "check the site for bugs", or "do today's visual refinement".
---

# The morning check

Runs every morning at 7am (Hawaii time) from a scheduled routine. It has three jobs,
in this order, and a budget that matters as much as the jobs: **the owner uses
Claude for the rest of the week on the same weekly limit.** A run that finds
nothing and stops early is a good run.

## The budget - read this first

- **Never read `lesson.html` or `app.html` whole.** They are 700 KB and 250 KB.
  Use `grep -n` to find a function, then read 40-150 lines around it. Reading
  either file end to end would spend more than the rest of the run put together.
- **Run the suite at most three times**: once at the start, once after the
  fixes, once after the visual change. Not after every edit.
- **At most 3 bug fixes a day**, most serious first. Anything else goes in
  the log under "Found, not fixed" for tomorrow.
- **Exactly one visual improvement a day**, small enough to finish, test and
  look at in one sitting. Never start a second one.
- **No subagents**, no re-deriving what `CLAUDE.md` or `LOG.md` already says.
- **Stop early** when the suite is green and today's visual item is done - or
  when the item turns out bigger than one sitting (write down what you
  learned and stop).

## 0. Get the code

```bash
cd /home/user/studyflow 2>/dev/null || git clone https://github.com/e787-blip/studyflow /home/user/studyflow && cd /home/user/studyflow
git fetch origin main claude/morning 2>/dev/null
```

All work goes on the branch **`claude/morning`**, never `main` - the owner
reviews and merges it.

- If `origin/claude/morning` exists and has commits not in `origin/main`:
  `git checkout -B claude/morning origin/claude/morning`, then
  `git merge --no-edit origin/main` (merge, never rebase or force-push).
- Otherwise (no branch yet, or everything on it is already merged):
  `git checkout -B claude/morning origin/main`.

Read `.claude/skills/morning-check/LOG.md` (the last few entries and the
backlog). Read `CLAUDE.md` only in the sections the day's work touches.

## 1. Check everything

```bash
bash .claude/skills/morning-check/scripts/run_all.sh /tmp/sf-morning
```

Parses every page, `sf-draw.js`, `sf-topics.js` and `api/*.js`, then drives real page loads in
Chromium with `api/generate` mocked: every card type answered wrong, the
subtopic skill (see the `subtopics` skill), the walkthroughs, the picture budget (at most 30% of question cards, never the
same picture twice), the labelling card, pre-drawing in the plan builder,
board text sizes at phone width, and every diagram against the audited
baseline. About 5 minutes. Logs and screenshots land in `/tmp/sf-morning`.

Also try the live site - `curl -s -o /dev/null -w '%{http_code}' https://studyflow-ten-vert.vercel.app/`
and the same for `/lesson.html`, `/app.html`, `/login.html`, `/dashboard.html`,
`/sf-draw.js`. A `000` means this environment's network policy blocks the
host: say so once in the report and move on - it is not a bug in the site.

**Look at two screenshots**, not zero: `/tmp/sf-morning/wl_step3.png` (the
labelling walkthrough) and `/tmp/sf-morning/wv_step3.png` (a picture walkthrough).
A test can pass on a page that looks wrong.

### No Node on this machine? Run the same suite in the browser pane

The dev Mac has no Node, so `run_all.sh` cannot run there. `browser/` runs the
SAME test files, unmodified, in the Claude desktop app's browser pane: pages
are same-origin iframes, `api/generate` is routed through a hook the server
injects at the top of every page, and `require`, `fs` and a slice of
Playwright (`evaluate`, `route`, `click`, `fill`, `locator`, `waitFor*`,
`emulateMedia` for JS reads of reduced motion) are shimmed (`pwshim.js`).

```bash
python3 -I .claude/skills/morning-check/browser/server.py 8765 &
```

Open `http://localhost:8765/__h/pw.html` in the pane, call `runSuite()` with
the page's JS tool (or `runSuite(['newtypes', 'mix'])` for some), and poll
`suiteSummary()` - a call that waits more than ~40s times out. Parse checks
and the subtopic rules run under macOS's own JavaScriptCore:

```bash
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
$JSC .claude/skills/morning-check/browser/noderun.js -- "$PWD/.claude/skills/morning-check/browser/parseall.js" "$PWD" $(ls *.html sf-*.js whiteboard.js api/*.js)
$JSC .claude/skills/morning-check/browser/noderun.js -- "$PWD/.claude/skills/subtopics/scripts/check_topics.js"
```

`dg_regress` writes `diagrams.json` to the server's out folder (`GET /__repo`
says where); `cmp` it with `diagram_baseline.json`. Known differences from
Playwright: **a hidden pane stops rendering after a while** - animation
frames, Web Animations and IntersectionObserver freeze, so `draw_on`'s motion
checks fail until the pane is shown; and this Mac HAS speech voices, so
`test_language`'s "no voice on this device" check cannot pass here. Neither
is a bug in the site. For stills, headless Chrome works
(`--headless=new --screenshot`), but it does not exit on its own - kill it
once the file exists - and its virtual clock catches entrance animations
part-way, so add `*{animation:none!important}` to the page first.

## 2. Fix what is broken (max 3)

For each failure: reproduce it from the log, find the cause with `grep`, fix
it in the style of the surrounding code (ES5 in `lesson.html`: `var`, no arrow
functions, no template literals), and keep the fix minimal. `CLAUDE.md`'s
invariants are not negotiable - read the one the failure touches.

- A test that is wrong about the app (the app changed on purpose) is fixed
  in the test, and the log says why. Never delete or loosen a check to get
  green.
- `diagram_baseline.json` is regenerated ONLY for a diagram change that was
  intended and looked at: `node scripts/dg_regress.js scripts/diagram_baseline.json`.

## 3. One visual refinement

Take the top unticked item in `LOG.md`'s backlog (or a better one you
found this morning - say why). Use the `diagram` skill for anything that draws.
The standard is `CLAUDE.md`'s design system: one blue (`#4a7cf6`), no amber on
the whiteboards, no hover lift, text at least 9px on a 375px phone, nothing
repeated, nothing that leaks an answer before it is answered (invariant 7).

**Render it and look at it** before calling it done - a screenshot at 390px
wide in light AND dark mode. Then re-run the suite.

## 4. Record, commit, push, report

1. Append today's entry to the top of `LOG.md`'s "Runs" (date, suite result,
   what was fixed, the visual change, anything found and not fixed). Tick or
   update the backlog. Keep the entry under 15 lines.
2. Update `CLAUDE.md` only if the day changed how something works.
3. Commit with a plain-English message and push:
   `git push -u origin claude/morning`. Never push to `main`.
4. Finish with a short report the owner can read on a phone, in plain words
   (they are in 7th grade): what was checked, what broke and was fixed, what
   looks better today, and "merge `claude/morning` when you're happy with
   it". If nothing needed doing, say that in one line.
