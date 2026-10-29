-- Sidedoor Portal | stage 4: deeper Google insight, speed, referrals

-- analytics_top gains device split and last period's searches (to spot new ones)
CREATE TABLE analytics_top_new (
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('query','page','device','query_prev')),
  rank INTEGER NOT NULL,
  key TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  position REAL,
  PRIMARY KEY (site_id, kind, rank)
);
INSERT INTO analytics_top_new SELECT site_id, kind, rank, key, clicks, impressions, position FROM analytics_top;
DROP TABLE analytics_top;
ALTER TABLE analytics_top_new RENAME TO analytics_top;

-- PageSpeed, refreshed weekly
ALTER TABLE sites ADD COLUMN speed TEXT;
ALTER TABLE sites ADD COLUMN speed_checked_at TEXT;

-- Clients passing on other businesses
CREATE TABLE referrals (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  business TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','won','not_now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_referrals_status ON referrals(status, created_at);

INSERT INTO settings (key, value) VALUES ('referral_reward', 'a month on me') ON CONFLICT(key) DO NOTHING;
