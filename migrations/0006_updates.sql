-- Sidedoor Portal | stage 6: updates from Jordan

CREATE TABLE updates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link_label TEXT,
  link_url TEXT,                 -- an in-app link like #/ideas, or a full https address
  client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,   -- NULL = every client
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_updates_created ON updates(created_at);

CREATE TABLE update_reads (
  update_id TEXT NOT NULL REFERENCES updates(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (update_id, user_id)
);
