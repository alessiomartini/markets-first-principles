# How syncing works

The trainer is local-first. IndexedDB is the primary store in the browser; the
D1 log is the durable copy across devices. Nothing in the review loop waits for
the network.

## The three guarantees

**A review is durable when it is rated.** `Sync.enqueue` writes to IndexedDB and
returns. If the connection is gone, or the token is missing, or the Worker is
down, the review still exists and the card is still scheduled correctly. Reviews
drain later, in whatever order the network allows.

**Retries are free.** Every review carries a `review_id` generated in the
browser. That id is the primary key in D1 and the insert is `INSERT OR IGNORE`,
so sending the same review twice produces one row. This is the whole reason the
queue can retry without asking the server "did that land?" — the ambiguous
timeout, the classic hard case in at-least-once delivery, becomes uninteresting.

**A bad row cannot block the good ones.** Records that fail validation, or that
the server refuses with a 4xx, move to a quarantine store and are never retried.
A queue that retries an unacceptable row forever never drains, and everything
behind it is stuck too.

## Failure taxonomy

The distinction that matters is *not now* versus *not ever*.

| What happened | Reading | What the queue does |
|---|---|---|
| `fetch` throws | offline | keep, exponential backoff from 2 s, capped at 5 min |
| 401 / 403 | misconfigured | keep, back off the full 5 min, show an error |
| 4xx naming rows | the server understood and refused | quarantine those rows |
| 5xx | server broken | keep, normal backoff |
| 2xx, unreadable body | probably landed | assume accepted — a wrong guess costs one duplicate *request*, not a duplicate row |

Local validation runs twice: once at enqueue, so a bug never writes an
unacceptable row, and once at flush, so a record corrupted by a half-finished
write or an older schema version leaves the queue instead of poisoning it.

## Card state is a cache, twice over

`cards` in IndexedDB and `card_states` in D1 both hold derived FSRS state. Both
can be rebuilt by replaying the review log. When hydrating a fresh device, a
newer local state wins over the server's: the server may not yet have seen the
reviews still sitting in this device's queue, so its state is *older*, not
authoritative.

## Wire shape drift

`REVIEW_FIELDS` in `src/lib/sync.mjs` and `REVIEW_COLUMNS` in
`worker-flashcards/src/api.js` are deliberately separate — the Worker is its own
deployable and should not import from the site. `src/lib/sync.test.mjs` imports
both and asserts they are identical, so drift fails the test run. Losing a
column silently would mean losing data the FSRS optimiser needs and that cannot
be reconstructed later.

## The token in the browser

In bearer-token mode the token lives in `localStorage`. That is readable by any
script running on the origin, so it is a real trade-off, not a non-issue: it is
acceptable here because the site is static, single-author, and has no
third-party scripts. Putting the Worker behind Cloudflare Access removes the
token entirely — set `accessMode` on the `Sync` and `ACCESS_ENABLED=true` on the
Worker, and identity moves to a cookie the page never handles.
