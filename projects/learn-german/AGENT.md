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

## `practice.html` — "A1 Challenge" timed quiz

No tabs, no standalone browsing mode. One flow: start screen → 25-question timed run
(5:00 countdown, 3 lives) drawing randomly from all 5 activities below → result screen
(score, lives used, time, share, retake). No der/die/das article drill here — that
already exists as index.html's `artikel` tag; don't re-add a duplicate without checking
with the user first.

| Activity | Mechanic |
|---|---|
| 📝 Fill in the Blanks | Paragraph cloze. Hidden multiple-choice hint chips per blank (💡 toggles them). Verb-type blanks pre-fill the first 3 letters as a scaffold; pronoun/article/preposition blanks start empty. Enter moves focus to the next blank; on the last blank it bubbles up and submits Check. |
| 🔤 Sentence Builder | Tap shuffled word tiles into order. Shows the English prompt (`showPrompt: true`). |
| 🔁 Conjugation | verb × pronoun → type the present-tense form. 💡 reveals all 6 forms. |
| 🚫 Error Spotting | One sentence, one wrong word. Tap the wrong word, then pick the fix from revealed chips. |
| ❓ W-Frage Builder | Tap shuffled word tiles into order — **`showPrompt: false`**, deliberately shows *no* context statement, just the tiles. User must derive correct German word order with zero semantic hint (this was a deliberate ask — don't add the context sentence back, and don't switch this to multiple-choice; both were tried and explicitly reverted). |

Architecture:

- **Exercise data lives in `practice_exercises/<section>.yaml`** (`blanks`, `builder`, `conj`,
  `errors`, `wfrage` — one file per activity, same convention as `exercises/<id>.yaml`). Fetched +
  parsed with `jsyaml` at boot. **On `file://` fetch fails**, so `practice.html` falls back whole-hog
  to the embedded `FALLBACK_DATA` const — **keep that const in sync by hand** whenever you edit a
  file under `practice_exercises/` (identical tradeoff to `index.html`'s `FALLBACK_TAGS`; no regen
  script exists for either, by design — this is a static, no-build-step project).
- **Every activity's render function has signature `renderX(overrideItem, onNext)`** — always called
  with both args now (no more standalone/no-arg mode). It renders exactly that one item and calls
  `onNext()` when the user advances. The quiz controller (`buildDeck()` + `renderQuizCard()`) shuffles
  all 5 datasets into one combined deck (each `conj` entry gets a random pronoun, matching the old
  balanced-mix behavior) and slices the first 25. **Any new activity must follow this same
  `(overrideItem, onNext)` signature** to plug into the quiz.
- **One card = one question, all-or-nothing.** `recordResult(bool)` — called once per sub-answer by
  the renderers (blanks: once per blank; errors: once for word-spot + once for fix) — pushes into
  `quiz.cardResults` instead of touching the DOM directly. The quiz's `onNext` wrapper collapses via
  `cardResults.every(Boolean)`: a fully-correct card increments `quiz.correct`, anything else costs a
  life (`quiz.lives--`). Renderer internals otherwise untouched.
- **Quiz ends** when `quizEnded({answered, lives, timeLeft})` is true: 25 answered, 0 lives, or the
  5:00 timer hits 0 — whichever comes first. Timer runs via `setInterval(tick, 250)` against a fixed
  `quiz.endsAt` timestamp (not a naive per-tick decrement, to avoid drift).
- Sentence Builder and W-Frage Builder share one factory:
  `createWordOrderDrill({ promptField, answerField, cardTitle, cardSub, showPrompt })`.
  Extend this factory (don't copy-paste) for any other tap-to-order activity.
- **Global keydown handler**: Enter clicks `#nextBtn` if visible, else `#checkBtn`, else `#btnRetry`,
  else `#btnStart` — mirrors `index.html`'s convention. Any new screen's markup must use those exact
  ids for Enter-to-submit/advance/start to keep working.
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
