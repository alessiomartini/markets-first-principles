# Flashcards API worker

Stores the review log for the spaced-repetition trainer in Cloudflare D1.

```
POST /api/reviews   append reviews (idempotent) and upsert derived card states
GET  /api/states    current card_states, for a device with an empty cache
GET  /api/reviews   recent log entries
GET  /api/export    the whole log, ?format=csv or ?format=json
```

There is **no route that updates or deletes a review**, and no unauthenticated
route of any kind. `DELETE`, `PUT` and `PATCH` fall through to 404 — a test
asserts it, so adding such a route later means deliberately deleting that test.

## Why the log is the source of truth

`reviews` is append-only. `card_states` is a cache: drop it and it can be
rebuilt by replaying the log through `src/lib/scheduler.mjs`. Every review row
records the memory state *before* the rating, which is what the FSRS optimiser
needs to re-fit the parameters on your own data later. Discarding those columns
would make the history un-optimisable — you would still have the ratings, but
not the conditions they were given under.

See `docs/data-model.md` and `docs/scheduling.md`.

## Auth

Two modes, decided by the `ACCESS_ENABLED` var:

- **`"false"` (default).** Every route requires `Authorization: Bearer <token>`,
  compared in constant time against the `API_TOKEN` secret. If the secret is
  unset the Worker refuses everything — it fails closed, so a half-finished
  deploy is not an open database.
- **`"true"`.** Cloudflare Access terminates identity at the edge and the Worker
  trusts the `CF-Access-Jwt-Assertion` header it forwards.

**Only set `ACCESS_ENABLED=true` when the Worker really is behind an Access
application.** Without Access in front, that header is just a string any client
can send, and the flag would turn the API into a public one. That is why the
header is ignored entirely in token mode rather than accepted "if present".

Setting the token (cannot be done from CI — that would mean storing it where CI
can read it back):

```bash
cd worker-flashcards
npx wrangler secret put API_TOKEN
```

## Deploying

Run the **Deploy flashcards worker** workflow from the Actions tab. It is
`workflow_dispatch` only. It finds or creates the database, substitutes the id
into `wrangler.jsonc`, applies migrations, and deploys. It needs the same
`CLOUDFLARE_API_TOKEN` repository secret as the notes worker (Workers Scripts →
Edit, D1 → Edit).

From a laptop instead:

```bash
cd worker-flashcards
npm install
npx wrangler login
npx wrangler d1 create markets-first-principles-flashcards   # paste the id into wrangler.jsonc
npx wrangler d1 migrations apply markets-first-principles-flashcards --remote
npx wrangler secret put API_TOKEN
npx wrangler deploy
```

Local development uses `.dev.vars` (gitignored — see `.dev.vars.example`) and a
local SQLite database:

```bash
npx wrangler d1 migrations apply markets-first-principles-flashcards --local
npx wrangler dev
```

## Tests

```bash
npx vitest run worker-flashcards/src/api.test.mjs
```

They run against a hand-written D1 stub rather than
`@cloudflare/vitest-pool-workers`, which would be another dependency and a much
slower run. The stub enforces the one constraint the behaviour depends on — the
primary key on `review_id` — which is what makes the idempotency test mean
something.

## Reading the data without the API

```bash
npx wrangler d1 execute markets-first-principles-flashcards --remote \
  --command "SELECT card_id, COUNT(*) n, SUM(rating = 1) again
             FROM reviews GROUP BY card_id ORDER BY again DESC LIMIT 20"
```
