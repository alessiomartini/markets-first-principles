-- Review log and derived state for the flashcard trainer.
--
-- `reviews` is append-only: the application never issues UPDATE or DELETE
-- against it. It is the only irreplaceable data in this project — card content
-- is in git, and card_states can be recomputed from this table at any time.

CREATE TABLE IF NOT EXISTS reviews (
  -- Generated on the client so that a retry after an ambiguous failure carries
  -- the same id and INSERT OR IGNORE makes it a no-op.
  review_id      TEXT PRIMARY KEY,
  card_id        TEXT NOT NULL,
  reviewed_at    INTEGER NOT NULL,          -- epoch ms, UTC
  rating         INTEGER NOT NULL,          -- 1 Again, 2 Hard, 3 Good, 4 Easy
  -- Everything below describes the memory state BEFORE this review, which is
  -- what the FSRS optimiser needs in order to re-fit the parameters later.
  state          INTEGER NOT NULL,
  elapsed_days   REAL NOT NULL,
  scheduled_days REAL NOT NULL,
  stability      REAL,
  difficulty     REAL,
  duration_ms    INTEGER,                   -- reveal to rating
  client_id      TEXT,
  algo_version   TEXT,
  received_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS reviews_card_time ON reviews (card_id, reviewed_at);
CREATE INDEX IF NOT EXISTS reviews_time ON reviews (reviewed_at);

-- Derived cache. Safe to drop and rebuild by replaying `reviews`.
CREATE TABLE IF NOT EXISTS card_states (
  card_id        TEXT PRIMARY KEY,
  due            INTEGER NOT NULL,
  stability      REAL NOT NULL,
  difficulty     REAL NOT NULL,
  elapsed_days   REAL NOT NULL,
  scheduled_days REAL NOT NULL,
  reps           INTEGER NOT NULL,
  lapses         INTEGER NOT NULL,
  state          INTEGER NOT NULL,
  last_review    INTEGER,
  updated_at     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS card_states_due ON card_states (due);
