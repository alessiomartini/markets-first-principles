# Running the trainer

Everything here is a laptop job. None of it is exposed as an API route: the
Worker has exactly one write route and it appends reviews. Handing a
public-facing service the ability to overwrite state wholesale would be a much
larger surface than an administrative task needs.

Two environment variables drive the command-line tools:

```bash
export FLASHCARDS_API=https://markets-first-principles-flashcards.<subdomain>.workers.dev
export FLASHCARDS_TOKEN=...    # the value given to `wrangler secret put API_TOKEN`
```

## Before renaming or deleting a card

This is the one operation that can lose data irreversibly. Review history is
keyed on the card id and nothing else, so a rename orphans every review ever
recorded about that card — silently, and with no way to reattach them.

```bash
npm run flashcards:pull-ids     # writes .card-ids-in-log.json from the live log
npm run validate:cards          # now fails if an id with history has vanished
```

The validator runs in CI too, but CI has no database credentials, so there it
skips this check with a warning and only enforces the checks it can (unique
ids, required fields, valid source URLs, balanced LaTeX, the
`formula ⟺ answer` invariant).

To retire a card properly, add an entry to
`src/content/flashcards/tombstones.json`:

```json
{ "id": "old-card-id", "retired_on": "2026-08-17", "reason": "merged into mgf-definition" }
```

The history stays in D1. The tombstone is what says the orphaning was
deliberate.

## Rebuilding card_states

`card_states` is a cache. The log is the asset. If the cache is corrupted, lost,
or made obsolete by re-fitted FSRS parameters, recompute it:

```bash
npm run flashcards:rebuild-states -- --out rebuilt-states.sql
npx wrangler d1 execute markets-first-principles-flashcards --remote --file=rebuilt-states.sql
```

The script replays every review through the same scheduler the trainer uses — a
test asserts that replay and incremental application agree exactly, because a
rebuild that disagreed would silently reschedule the whole deck. It reports any
card with history but no card definition, and rebuilds nothing for those.

It writes SQL and applies nothing. Read it before running it.

## Backups

Three independent copies, which is the point:

1. **D1's own point-in-time recovery.** Protects against Cloudflare losing the
   data. Does not protect against me dropping the table.
2. **Weekly R2 copy**, Sundays 03:00 UTC, written by the Worker's `scheduled`
   handler as CSV under `reviews/YYYY-MM-DD.csv` plus `reviews/latest.csv`.
   Dated keys are never overwritten, so a corrupted run cannot destroy the
   previous backup. CSV rather than a database dump because a backup needs to be
   readable on the day nothing else works.
3. **Manual export**, from the trainer's settings panel or:
   ```bash
   curl -H "Authorization: Bearer $FLASHCARDS_TOKEN" \
     "$FLASHCARDS_API/api/export?format=csv" -o reviews.csv
   ```

R2 is not enabled on the account yet. The `r2_buckets` binding in
`worker-flashcards/wrangler.jsonc` is commented out for that reason — an
unresolvable binding fails the deploy outright — and the scheduled handler
checks for the binding and skips cleanly while it is absent. To turn it on:
create the bucket, uncomment the binding, redeploy.

## Re-fitting FSRS parameters

Not automated, and deliberately so: it needs a few thousand reviews before it
means anything, and applying new weights changes every future interval. When
there is enough history, export the CSV — the column order matches what the
FSRS optimiser expects — run the optimiser, and put the resulting weights into
`SCHEDULER_CONFIG` in `src/lib/scheduler.mjs`. `ALGO_VERSION` will change, which
is how the log records that reviews before and after were scheduled by different
models.

Then rebuild `card_states`, since every stored interval was computed under the
old weights.

## Checking the pages actually work

```bash
npm run build
npm run check:trainer      # drives a session in Chromium
npm run check:dashboard    # seeds a known history and checks the numbers back
```

Both need playwright, which is deliberately not a project dependency
(`npm i -g playwright`, or set `PLAYWRIGHT_MODULE`). They exist because a green
build has twice said nothing useful here — see the comments at the top of each
script.
