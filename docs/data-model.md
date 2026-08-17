# Data model

Two halves that never mix: **content** is versioned in git, **progress** lives
only in D1. They are joined by `card_id`, and that join is the reason card ids
are permanent.

## The log is the asset

`reviews` is **append-only**. Never `UPDATE`, never `DELETE`.

That is not fastidiousness. Review history is the only record of how a
particular memory actually behaved over time, it cannot be reconstructed or
re-collected, and it is what makes it possible to fit FSRS's parameters to
*this* memory rather than to the average of everyone else's. A corrupted state
table is an inconvenience; a lost log is permanent.

`card_states` is therefore a **materialised view**, not a source of truth. It
exists because reading a card's current state should be one indexed lookup
rather than a replay of its whole history. It can be dropped and rebuilt at any
time.

## Tables

### `reviews` — append-only

| Column | Type | Meaning |
|---|---|---|
| `review_id` | TEXT PK | UUID generated **client-side**, which is what makes retries idempotent |
| `card_id` | TEXT | joins to content |
| `reviewed_at` | INTEGER | epoch ms, UTC |
| `rating` | INTEGER | 1 Again · 2 Hard · 3 Good · 4 Easy |
| `state` | INTEGER | FSRS state **before** this review |
| `elapsed_days` | REAL | since the previous review |
| `scheduled_days` | REAL | the interval this review was scheduled for |
| `stability`, `difficulty` | REAL | FSRS values **before** this review |
| `duration_ms` | INTEGER | reveal → rating |
| `client_id` | TEXT | which device |
| `algo_version` | TEXT | e.g. `fsrs-6.0/w:1a2b3c4d` |

Everything marked *before* is deliberate. The FSRS optimiser needs to know the
memory state a rating was given **from**, so each row describes the situation
the rating responded to, not the situation it produced. A log recording the
after-state would be useless for re-fitting.

`algo_version` carries a fingerprint of the 21 weights, not just the algorithm
name. Once the parameters are re-fitted, reviews scheduled under the old and
new weights must be distinguishable — otherwise the log cannot be used to
evaluate the change the log itself made possible.

### `card_states` — derived cache

`card_id`, `due`, `stability`, `difficulty`, `elapsed_days`, `scheduled_days`,
`reps`, `lapses`, `state`, `last_review`, `updated_at`.

Written on every sync as a convenience, and fully reconstructible.

## Rebuilding

`rebuild-states` recomputes every card's state by replaying its reviews from
scratch through `src/lib/scheduler.mjs`. A test asserts that replay reproduces
the live table exactly.

Two situations make this more than a safety net:

- **A bug corrupts the cache.** Drop it and replay; nothing is lost.
- **The parameters are re-fitted.** Replaying under new weights recomputes
  every card as if those weights had always been in force, so a re-tune applies
  to all of history rather than only to reviews after the switch.

## Idempotency

Reviews are written to IndexedDB first and POSTed afterwards. A failed or
offline POST leaves the review queued and retried later, so a session works
fully offline and the UI never blocks on the network.

The server inserts with `INSERT OR IGNORE` keyed on the client-generated
`review_id`. Posting the same review twice therefore results in exactly one
row, which is what makes a retry after an ambiguous failure safe — the client
never has to decide whether its previous attempt landed.

## Export

`GET /api/export?format=csv|json` returns the entire log. The CSV column order
matches what the FSRS optimiser expects, so fitting custom parameters is a
download away rather than a data-engineering exercise.

A weekly cron Worker also dumps the log to R2 under a dated key, and the UI has
a "download my data" button. Three copies, one of them off the platform's
primary path.
