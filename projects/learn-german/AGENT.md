# Lern Deutsch — Agent Notes

A1 German study app. Two static, self-contained HTML pages — **no build step, no bundler,
no npm, no framework**. Both must keep working when opened directly as a `file://` URL.

## Files

| Path | What it is |
|---|---|
| `index.html` | Vocabulary flashcard app (tag-filtered, scored) |
| `practice.html` | Grammar/sentence-building drills (linked from index's header) |
| `exercises.yaml` | Manifest: list of tag filenames for `index.html` |
| `exercises/<id>.yaml` | One vocab tag's exercises (english/german pairs) |
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
- **"Practice"** pill next to it links to `practice.html`.
- `localStorage` keys, all `lg_`-prefixed: `lg_history` (streak/session history), `lg_direction`
  (EN↔DE toggle), `lg_autospeak` (SpeechSynthesis auto-play).
- DOM id contract: `#germanAnswer` always holds the German string (audio binds here);
  `#promptAnswer` is the English reveal row, shown only in reverse (DE→EN) mode.
- Utilities worth knowing: `normalize()` (umlaut-tolerant: ä→ae, ö→oe, ü→ue, ß→ss, trims/lowers)
  and `shuffle()`. `practice.html` copies both — keep them identical if you change either.

## `practice.html` — grammar drills

Tab bar: **🎲 All** (default on load) + 5 activities. No der/die/das article drill here —
that already exists as index.html's `artikel` tag; don't re-add a duplicate without checking
with the user first.

| Tab | Mechanic |
|---|---|
| 📝 Fill in the Blanks | Paragraph cloze. Hidden multiple-choice hint chips per blank (💡 toggles them). Verb-type blanks pre-fill the first 3 letters as a scaffold; pronoun/article/preposition blanks start empty. Enter moves focus to the next blank; on the last blank it bubbles up and submits Check. |
| 🔤 Sentence Builder | Tap shuffled word tiles into order. Shows the English prompt (`showPrompt: true`). |
| 🔁 Conjugation | verb × pronoun → type the present-tense form. 💡 reveals all 6 forms. |
| 🚫 Error Spotting | One sentence, one wrong word. Tap the wrong word, then pick the fix from revealed chips. |
| ❓ W-Frage Builder | Tap shuffled word tiles into order — **`showPrompt: false`**, deliberately shows *no* context statement, just the tiles. User must derive correct German word order with zero semantic hint (this was a deliberate ask — don't add the context sentence back, and don't switch this to multiple-choice; both were tried and explicitly reverted). |

Architecture:

- **Exercise data is embedded JS objects** in a `DATA` const — no YAML, no fetch. Fine as long as
  a dataset stays roughly under a few dozen items; only graduate to YAML+fetch if one grows large.
- **Every activity's render function has signature `renderX(overrideItem, onNext)`.** Called with
  no args, it self-manages its own shuffled order/index (normal standalone tab behavior). Called
  with an explicit item + a next-callback, it renders just that one item and defers "what happens
  next" to the caller. This is what powers **🎲 All**: `buildAllQueue()` shuffles every dataset
  into one combined deck (100 items as of now — 20 per activity, kept evenly balanced on purpose;
  if you add more to one dataset, add the same count to the others to keep the balance) and
  `renderAll()` drives each activity's render
  function one item at a time, with its own progress bar + completion screen (copied from
  `index.html`'s flashcard deck pattern: score %, "Shuffle & try again"). **Any new activity must
  follow this same `(overrideItem, onNext)` signature** to plug into All mode.
- Sentence Builder and W-Frage Builder share one factory:
  `createWordOrderDrill({ tab, dataset, promptField, answerField, cardTitle, cardSub, nextLabel, showPrompt })`.
  Extend this factory (don't copy-paste) for any other tap-to-order activity.
- **Global keydown handler**: Enter clicks `#nextBtn` if visible, else `#checkBtn` if visible, else
  `#btnRetry` — mirrors `index.html`'s convention. Any new activity's card markup must use those
  exact ids for Enter-to-submit/advance to keep working.
- Tab bar's horizontal scrollbar is styled to match `index.html`'s `.tag-strip-wrapper` (thin,
  semi-transparent white thumb) — keep that pairing if either changes.
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
