# Scheduling

The flashcard trainer schedules reviews with **FSRS-6**, through the wrapper in
`src/lib/scheduler.mjs`. Nothing else imports `ts-fsrs`.

## A note on version numbers

The npm package version and the algorithm version are different numbers, and
the difference is confusing enough to state plainly: `ts-fsrs@5.4.1` implements
**FSRS-6.0**. The library reports `v5.4.1 using FSRS-6.0` and ships 21 default
weights, which is the FSRS-6 parameter count — FSRS-5 has 19. Checking the
package version alone would suggest the wrong algorithm.

## What FSRS models

FSRS is a three-variable model of a single memory, usually called **DSR**:

| Variable | Meaning |
|---|---|
| **Stability** $S$ | days until recall probability falls to 90%. The memory's strength. |
| **Difficulty** $D$ | how hard *this card* is for *you*, on a 1–10 scale. Rises after `Again`, falls after `Easy`. |
| **Retrievability** $R$ | probability you would recall it right now. Falls as time passes since the last review. |

The forgetting curve is a power law, not an exponential:

$$
R(t, S) = \left(1 + \text{FACTOR} \cdot \frac{t}{S}\right)^{\text{DECAY}}
$$

with $t$ the days since the last review. The power-law shape is one of the two
substantive differences from SM-2 — it decays more slowly in the tail than an
exponential, which matches how long-term memory actually behaves.

A review does three things:

1. Compute $R$ from the elapsed time and the current $S$.
2. Update $D$ and $S$ using the rating **and** $R$ — a correct recall of
   something you had nearly forgotten (low $R$) increases stability far more
   than a correct recall of something still fresh. This is the spacing effect,
   built into the update rule rather than approximated by a multiplier.
3. Solve for the next interval: the $t$ at which $R$ will have decayed to
   `request_retention`.

## Why this beats SM-2

SM-2 — Anki's original algorithm, and the ancestor of most "ease factor"
schedulers — carries one number per card and multiplies the interval by it,
adjusting the multiplier up or down after each review. Three consequences
follow, all of which FSRS avoids:

- **No memory model.** SM-2 cannot say what your probability of recall is,
  so it cannot target a retention level. FSRS can, and `request_retention` is
  exactly that target.
- **Ease hell.** Repeated `Hard` ratings drive the ease factor down
  multiplicatively, and it recovers only slowly, so a card that gave trouble
  early stays over-scheduled long after it is known. FSRS separates difficulty
  from stability, so a hard card that becomes stable gets long intervals anyway.
- **Elapsed time is ignored.** SM-2 treats a review as the same event whether
  it happened on the due date or three weeks late. FSRS uses the actual elapsed
  time to infer $R$, so a late review that still succeeded is correctly read as
  evidence of a stronger memory than scheduled.

FSRS's parameters were fitted on hundreds of millions of real reviews, and it
is the default scheduler in Anki. There is no case for hand-rolling an interval
formula here.

## `request_retention`, and what it costs

This is the only setting with a genuine trade-off, so it deserves a sentence
each way. It is the recall probability targeted at the moment a card comes due.

- **Higher** (0.95): shorter intervals, more reviews per day, fewer
  forgotten cards. Workload rises steeply — the relationship is convex, and
  going from 0.90 to 0.95 costs far more than the five points suggest.
- **Lower** (0.85): longer intervals, less daily work, more lapses. A lapse is
  expensive, because relearning a forgotten card costs several reviews.

The default is **0.90**, which is roughly where total work per unit of retained
knowledge is minimised for most collections. It is set in one place —
`SCHEDULER_CONFIG` in `src/lib/scheduler.mjs` — along with:

| Setting | Value | Why |
|---|---|---|
| `maximum_interval` | 36500 | 100 years, i.e. effectively uncapped |
| `enable_fuzz` | `true` | scatters due dates slightly so cards learned together do not come due together forever |
| `enable_short_term` | `true` | keeps the minutes-long learning steps for new cards |

## Fitting the parameters to my own memory

The 21 weights currently in use are FSRS-6's defaults, fitted on other people's
memories. Once there are a few hundred reviews in the log, they can be re-fitted
to mine with the FSRS optimiser, and the `reviews` table is shaped to be fed to
it directly — every row records the memory state *before* the review, which is
what the optimiser needs.

This is why `ALGO_VERSION` includes a fingerprint of the weights
(`fsrs-6.0/w:1a2b3c4d`) rather than just the algorithm name. Reviews scheduled
under the old weights and the new ones have to be distinguishable, or the log
cannot be used to evaluate the change that the log itself made possible.

Re-fitting does not invalidate history: `rebuild-states` replays the whole log
under the new parameters, so every card's state is recomputed as if the new
weights had always been in force. See `docs/data-model.md`.
