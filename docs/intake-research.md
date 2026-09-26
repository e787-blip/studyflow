# Sign-in, intake questions and upload: what the redesign rests on

September 2026. Written with the change that rebuilt `login.html` and the
plan builder in `app.html`; the implementation notes are in `CLAUDE.md`
("The plan builder", "Sign in").

## What this is NOT based on

The brief was to use Mobbin's app library. **That did not happen.** The Mobbin
connector is attached to the session but refused every call with "requires a
paid plan", and mobbin.com, Page Flows (pageflows.com) and ScreensDesign
(screensdesign.com) are all blocked by the cloud environment's network policy.
What follows comes from public teardowns and published usability research,
found by web search. Nothing here was checked against Mobbin's screens. With
a paid Mobbin plan, that check is still worth doing.

## Sign-in

| Finding | Source | What it changed |
|---|---|---|
| Validate a field after the learner leaves it, never while they are still typing, and clear the error the moment it is fixed | Baymard, *Usability Testing of Inline Form Validation* | errors sit under their field, checked on blur |
| Show password requirements live, as a guide rather than a punishment; strict rules drive abandonment | Baymard; Zuko, *password advice for online forms* | one rule ("At least 8 characters") that ticks as you type |
| Splitting email and password onto two pages helps SSO users and frustrates everyone else | Smart Interface Design Patterns / Smashing, *2-Page Login Pattern* | email and password stay on one page; Google first, because students mostly have school Google accounts |
| Personalise the path in, not just the page | Notion's use-case question, Duolingo | `?mode=signup` from the landing, `?class=` from a teacher's invite, returning devices start on sign-in with the email filled |

## The questions

| Finding | Source | What it changed |
|---|---|---|
| One question at a time completes far better than one long form: Typeform reports a 47% average completion against a 21.5% industry average; Formstack measured multi-step forms 25% higher than single-page | Fillout, *one-question-at-a-time vs single-page*; RowForm | one screen per question, with a progress bar |
| A determinate progress bar, and a Continue button that only lights up once there is an answer | Duolingo teardowns (Appcues GoodUX, UserGuiding) | `2 of 8` bar; Continue is `aria-disabled` until chosen |
| People will answer 5–6 questions if the result is visibly shaped by them, and flows that ask and then ignore the answers fail | UXCam and Plotline onboarding round-ups | every answer is written into the prompt, and the review screen shows them all before building |
| Completion starts to fall past 10–14 questions | Fillout; FormReview | six questions, one optional, and the grade is asked only once |
| Duolingo asks goal, motivation and level before anything else, and gets to the first real action fast | Duolingo teardowns | purpose, level and goal are single taps that advance by themselves |

The questions themselves (what the test is, the grade, what they know now,
the goal, their own words) are the ones that change what the model should
write. The date was already asked. A daily-minutes question in the Duolingo
style was left out on purpose: the day's length is fixed by the question
schema, so it would have been asked and then ignored.

## Upload

| Finding | Source | What it changed |
|---|---|---|
| Give a clear drop zone and a browse button, show per-file progress, say what types are accepted | Uploadcare, *file uploader UX best practices*; Eleken | each file is a card with its own bar, word count and remove button |
| NotebookLM's add-sources dialog lets a big drop zone overshadow paste and link | nembal, *NotebookLM: UX improvements* | the drop zone is one row among photo, record and paste, not the whole screen |
| (Measured here, not researched) Vercel rejects request bodies over 4.5 MB | the platform limit | photos are shrunk to 1600px in the browser before upload |

## Sources

- https://baymard.com/blog/inline-form-validation
- https://www.zuko.io/blog/password-advice-for-online-forms
- https://www.smashingmagazine.com/2024/06/2-page-login-pattern-how-fix-it/
- https://www.fillout.com/blog/one-question-at-a-time-form
- https://rowform.io/blog/single-question-vs-long-forms-the-data-on-why-single-question-forms-win/
- https://goodux.appcues.com/blog/duolingo-user-onboarding
- https://userguiding.com/blog/duolingo-onboarding-ux
- https://uxcam.com/blog/10-apps-with-great-user-onboarding/
- https://www.plotline.so/blog/mobile-app-onboarding-examples
- https://uploadcare.com/blog/file-uploader-ux-best-practices/
- https://www.eleken.co/blog-posts/file-upload-ui
- https://www.nembal.com/blog/notebooklm_fixes
