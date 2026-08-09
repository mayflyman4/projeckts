# Lern Deutsch — Agent Notes

A1 German study app. Two static, self-contained HTML pages — **no build step, no bundler,
no npm, no framework**. Both must keep working when opened directly as a `file://` URL.

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
