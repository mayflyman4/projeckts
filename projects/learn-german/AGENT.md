# Lern Deutsch — Agent Notes

A1 German study app. Two static, self-contained HTML pages — **no build step, no bundler,
no npm, no framework**. Both must keep working when opened directly as a `file://` URL.

**Scoped exception (F8 — account/Google Sign-In):** the `functions/` directory is a
deliberate, narrow exception to the "no backend" rule above — see the
[Account backend](#account-backend-f8--google-sign-in) section near the end of this
file. Login cannot work over `file://` or without server-side token verification, so
that one feature gets a small Cloudflare Pages Functions backend + D1 database.
Everything else in both HTML files remains 100% static and still works over `file://`
exactly as before — don't let this exception creep into any other feature without
checking with the user first.

## Files

| Path | What it is |
|---|---|
| `index.html` | Vocabulary flashcard app (tag-filtered, scored) |
| `practice.html` | Timed grammar quiz — "A1 Challenge" (linked from index's header) |
| `exercises.yaml` | Manifest: list of tag filenames for `index.html` |
| `exercises/<id>.yaml` | One vocab tag's exercises (english/german pairs) |
| `practice_exercises/<section>.yaml` | One `practice.html` activity's exercises (blanks/builder/conj/errors/wfrage) |
| `a1-wortliste.txt` | Official Goethe A1 word list (~650 words) — grep before adding new vocab/verbs to confirm it's genuinely A1 |
| `mock_test/uebungstest_1.md` | Reference telc exam extract — **not wired into the UI**, just study reference |
| `functions/` | Cloudflare Pages Functions backend for Google Sign-In only — see below |
| `schema.sql` | D1 table definition for the `users` table (run by hand via the Cloudflare dashboard's D1 Console — no wrangler CLI is used in this project) |
| `privacy.html`, `impressum.html` | GDPR privacy policy + German legal notice, footer-linked from both HTML pages |

## `index.html` — flashcard app

- Single `<script>`, single `<style>`. State machine in `state`, rendered via `renderCard()`.
- **Data loading**: `loadExercises()` fetches `exercises.yaml` (manifest of tag filenames) →
  fetches each `exercises/<tag>.yaml` → merges into `state.tags`. On fetch failure (i.e. `file://`),
  falls back whole-hog to the embedded `FALLBACK_TAGS` const — **keep that const in sync by hand**
  whenever you edit a file under `exercises/`.
- **"Mock Test ↗"** in the header is just an external link
  (`https://open-exam-prep.com/practice/telc-deutsch-a1`) — there is no embedded mock-exam mode.
- **"Challenge yourself"** pill next to it links to `practice.html`.
- `localStorage` keys, all `lg_`-prefixed: `lg_history` (streak/session history), `lg_direction`
  (EN↔DE toggle), `lg_autospeak` (SpeechSynthesis auto-play).
- DOM id contract: `#germanAnswer` always holds the German string (audio binds here);
  `#promptAnswer` is the English reveal row, shown only in reverse (DE→EN) mode.
- Utilities worth knowing: `normalize()` (umlaut-tolerant: ä→ae, ö→oe, ü→ue, ß→ss, trims/lowers)
  and `shuffle()`. `practice.html` copies both — keep them identical if you change either.

## `practice.html` — "A1 Challenge" quiz

No tabs, no standalone browsing mode, **no countdown clock** (tried it — a tester found it
too stressful, dropped it; time is only ever shown after the run finishes). One flow: start
screen (pick **All sections** or a single one) → up to 15-question run (3 lives, no time
limit) drawing from the chosen section(s) → result screen (score, lives used, elapsed time,
share, retake — retake returns to the section picker, not straight into a new run). No
der/die/das article drill here — that already exists as index.html's `artikel` tag; don't
re-add a duplicate without checking with the user first.

| Activity | Mechanic |
|---|---|
| 📝 Fill in the Blanks | Paragraph cloze. Verb-type blanks pre-fill the first 3 letters as a scaffold; pronoun/article/preposition blanks start empty but get a 💡 grammar-category hint (see below). Wrong blanks reveal the correct answer only *after* Check. Enter moves focus to the next blank; on the last blank it bubbles up and submits Check. |
| 🔤 Sentence Builder | Tap shuffled word tiles into order. Shows the English prompt (`showPrompt: true`). |
| 🔁 Conjugation | verb × pronoun → type the present-tense form. Wrong answers reveal the correct form only after Check. No pre-answer hint (see below). |
| 🚫 Error Spotting | One sentence, one wrong word. Tap the wrong word, then pick the fix from revealed chips. |
| ❓ W-Frage Builder | Tap shuffled word tiles into order — **`showPrompt: false`**, deliberately shows *no* context statement, just the tiles. User must derive correct German word order with zero semantic hint (this was a deliberate ask — don't add the context sentence back, and don't switch this to multiple-choice; both were tried and explicitly reverted). |

**Hints reveal the grammar category, never the answer.** Fill in the Blanks and Conjugation
used to have a 💡 button that revealed multiple-choice options *before* checking — removed
deliberately (it's a timed challenge; revealing answers up front defeats the point). But
verb-type blanks get a 3-letter scaffold as an implicit hint while pronoun/artikel/preposition
blanks got nothing at all, which felt broken — so Fill in the Blanks now has a 💡 per blank
that toggles a `.hint-note` with a **generic German sentence naming the word category**
(`BLANK_TYPE_HINTS`, keyed by `tok.type`: verb/pronoun/artikel/preposition), e.g. "Hier fehlt
ein Pronomen." — never the specific word or its options list. Conjugation has no such bulb
(the prompt itself already names the verb + pronoun, so there's nothing left to hint at
without giving the form away). The only other hint anywhere is the post-Check reveal on a
wrong answer (`.correct-answer-note` for blanks, the "Not quite — correct: X" line in
`#resultBanner` for conjugation). Don't reintroduce an *answer-revealing* pre-answer hint
(multiple-choice options, autofill chips) without checking with the user first — the
category-only hint above is the agreed middle ground. `tok.options` still exists in the
blanks YAML data but is unused by the UI (harmless leftover from the old hint UI, not a bug).

Architecture:

- **Exercise data lives in `practice_exercises/<section>.yaml`** (`blanks`, `builder`, `conj`,
  `errors`, `wfrage` — one file per activity, same convention as `exercises/<id>.yaml`). Fetched +
  parsed with `jsyaml` at boot. **On `file://` fetch fails**, so `practice.html` falls back whole-hog
  to the embedded `FALLBACK_DATA` const — **keep that const in sync by hand** whenever you edit a
  file under `practice_exercises/` (identical tradeoff to `index.html`'s `FALLBACK_TAGS`; no regen
  script exists for either, by design — this is a static, no-build-step project).
- **Every activity's render function has signature `renderX(overrideItem, onNext)`** — always called
  with both args (no standalone/no-arg mode). It renders exactly that one item and calls
  `onNext()` when the user advances. **Any new activity must follow this same signature** to plug
  into the quiz.
- **Section picker**: `SECTIONS` (const list of `{key, label}`) drives the start-screen buttons.
  `buildDeck(section)` builds `entries` from either all 5 datasets (`section === 'all'`, each
  `conj` entry getting a random pronoun) or just `DATA[section]`, shuffles, and slices to
  `QUIZ_LEN` (15). **`quiz.len` (not the raw `QUIZ_LEN` constant) is the source of truth** for the
  denominator, progress display, and end condition — it's set to `quiz.deck.length` after
  building, so a single-section run scoped to a smaller dataset degrades gracefully instead of
  showing a wrong "X of 15".
- **One card = one question, all-or-nothing.** `recordResult(bool)` — called once per sub-answer by
  the renderers (blanks: once per blank; errors: once for word-spot + once for fix) — pushes into
  `quiz.cardResults` instead of touching the DOM directly. The quiz's `onNext` wrapper collapses via
  `cardResults.every(Boolean)`: a fully-correct card increments `quiz.correct`, anything else costs a
  life (`quiz.lives--`). Renderer internals otherwise untouched.
- **Quiz ends** when `quizEnded({answered, lives, total})` is true: `answered >= total` or
  `lives <= 0` — no time-based end condition.
- **No auto-focus on touch devices.** `IS_TOUCH = matchMedia('(pointer: coarse)').matches`, checked
  before every `.focus()` call on the Fill in the Blanks and Conjugation inputs. On phones,
  auto-focusing pops the keyboard over roughly half the screen the instant a new card renders,
  before the user has read the question — reported as "irritating" on iPhone/SwiftKey. Desktop
  (`pointer: fine`) keeps auto-focus since there's no keyboard-takeover cost. Any new input-based
  activity should follow the same `if (!IS_TOUCH) input.focus()` pattern.
- **Elapsed time is a count-up, not a countdown.** `quiz.startedAt = Date.now()` set once in
  `startQuiz()`; the result screen computes `Date.now() - quiz.startedAt` via `formatTime()`.
  There is no ticking interval and no time display during play — don't add one back without
  checking with the user first (this was explicitly removed after negative feedback).
- Sentence Builder and W-Frage Builder share one factory:
  `createWordOrderDrill({ promptField, answerField, cardTitle, cardSub, showPrompt })`.
  Extend this factory (don't copy-paste) for any other tap-to-order activity.
- **Global keydown handler**: Enter clicks `#nextBtn` if visible, else `#checkBtn`, else `#btnRetry`,
  else `#btnStart` (the "All sections" button on the start screen) — mirrors `index.html`'s
  convention. Any new screen's markup must use those exact ids for Enter-to-submit/advance/start to
  keep working.
- **Share** (`shareScore()`): draws a 1080×1080 canvas score card, uses `navigator.share({files})`
  where available (mobile/https → OS share sheet, e.g. Instagram) and falls back to a PNG download +
  clipboard-copied caption otherwise (always the fallback on `file://`, since share/clipboard need a
  secure context). No web API posts directly to a specific app — the OS share sheet is the closest.
- Scoring is session-only (no `localStorage` persistence) — deliberate, not a gap.

## Verifying changes (no test framework)

1. Syntax-check the inline script without a browser:
   ```
   node -e "
   const fs = require('fs');
   const html = fs.readFileSync('practice.html', 'utf8'); // or index.html
   const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
   new Function(script);
   console.log('syntax OK');
   "
   ```
2. Then actually open it — `open index.html` / `open practice.html` — both work directly via
   `file://`, no server needed. Click through the change before calling it done.

   If `node` isn't installed in your environment, `osascript -l JavaScript` (JXA, built
   into macOS) can run the same `new Function(script)` syntax check — extract the
   `<script>...</script>` contents to a temp `.js` file first (matching the exact source
   bytes matters — building the string through a shell command that reinterprets escapes,
   e.g. `python -c "...\n..."`, can silently corrupt it) and read it back with
   `$.NSString.stringWithContentsOfFileEncodingError(...)`.

## Account backend (F8 — Google Sign-In)

A small, deliberate exception to this file's "no backend" rule at the top — see that
note before touching anything below.

- **What it's for**: "just identity" — showing who's signed in, nothing else depends on
  it yet. Don't build features that assume a signed-in user without checking with the
  user first; that would be a bigger step than what was originally agreed.
- **Flow**: Google Identity Services (GIS) client-side SDK — not a redirect/OAuth-code
  flow, no client secret anywhere. The `Sign in with Google` pill in the header is the
  gate: nothing loads from Google until it's clicked (deliberate data-minimization —
  no third-party request happens before an explicit user action). Click →
  lazy-inject `accounts.google.com/gsi/client` → `google.accounts.id.renderButton(...)`
  into a popover so the user clicks Google's own official button → the returned ID
  token (JWT) is POSTed to `/api/auth/google`.
- **Backend**: `functions/` is a Cloudflare Pages Functions app (plain JS, file-based
  routing, auto-bundled by Cloudflare with esbuild — no bundler config needed on our
  end). Four endpoints: `POST /api/auth/google` (verify token, upsert D1 row, set
  session cookie), `GET /api/me` (verify session cookie, return `{email,name}`),
  `POST /api/logout`, `POST /api/account/delete` (GDPR erasure). Shared logic lives in
  `functions/_lib/session.js` (HMAC-signed, **stateless** session token — no D1 read on
  `/api/me`) and `functions/_lib/google.js` (verifies the Google ID token against
  Google's JWKS via Web Crypto, no external JWT library).
- **Session lifetime is 7 days, not something longer** — this is a deliberate tradeoff:
  since sessions are stateless, deleting a user's D1 row doesn't revoke tokens already
  issued to other devices. Keeping the lifetime short bounds that exposure window
  instead of adding a D1 read to the `/api/me` hot path. Don't extend this without
  reconsidering that tradeoff.
- **No CSRF token, and this is intentional**: `SameSite=Lax` on the `__Host-session`
  cookie plus a `Content-Type: application/json` check on every mutating endpoint is
  the whole defense (cross-site form submits can't set that header without a CORS
  preflight, which these endpoints never allow). **Never add CORS headers** to any
  `/api/*` endpoint — that would undo this.
- **Widget is duplicated, not shared**: `index.html` and `practice.html` each have their
  own independent copy of the entire account widget (CSS, DOM refs, all the JS
  functions) — same convention this file already documents for `normalize()`/`shuffle()`.
  There's no shared-include mechanism in this codebase and none should be introduced
  just for this. If you change the widget's behavior, change it in both files.
- **`GOOGLE_CLIENT_ID` is a plaintext constant** near the top of each file's account
  section — Google Client IDs are public by design (unlike the client secret, which
  this design never uses anywhere).
- **Infra note for anyone touching Cloudflare Pages settings**: Pages Functions are
  discovered relative to the project's *Root Directory* setting, not its Build output
  directory — this project's Root Directory is set to `projects/learn-german` (with
  Build output directory `.`) specifically so `functions/` here gets picked up.
