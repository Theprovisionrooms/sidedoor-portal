-- Sidedoor Portal | stage 3 and 4: analytics, site health, work log, security notes, ideas

-- Search Console, cached daily
ALTER TABLE sites ADD COLUMN analytics_synced_at TEXT;
ALTER TABLE sites ADD COLUMN analytics_error TEXT;

CREATE TABLE analytics_daily (
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  date TEXT NOT NULL,                         -- YYYY-MM-DD
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  position REAL,
  PRIMARY KEY (site_id, date)
);

CREATE TABLE analytics_top (
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('query','page')),
  rank INTEGER NOT NULL,
  key TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  position REAL,
  PRIMARY KEY (site_id, kind, rank)
);

-- Site health: quick up/down checks every 30 mins, deeper checks daily
ALTER TABLE sites ADD COLUMN health TEXT;               -- JSON from the daily deep check
ALTER TABLE sites ADD COLUMN health_checked_at TEXT;
ALTER TABLE sites ADD COLUMN fail_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sites ADD COLUMN down_since TEXT;

CREATE TABLE site_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  checked_at TEXT NOT NULL,
  ok INTEGER NOT NULL,
  status INTEGER,
  ms INTEGER,
  error TEXT
);
CREATE INDEX idx_checks_site ON site_checks(site_id, checked_at);

-- Behind the scenes: what Jordan did, so clients can see it
CREATE TABLE work_log (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,   -- NULL = shown to everyone
  site_id TEXT REFERENCES sites(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'update' CHECK (kind IN ('security','update','backup','speed','other')),
  title TEXT NOT NULL,
  body TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_worklog_client ON work_log(client_id, created_at);

-- Known threats and scams, in plain English, with what it means for them
CREATE TABLE security_notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  verdict TEXT NOT NULL DEFAULT 'not_affected' CHECK (verdict IN ('not_affected','handled','action')),
  client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,   -- NULL = everyone
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_notes_created ON security_notes(created_at);

-- Ideas: seasonal and growth suggestions that turn into a request in one tap
CREATE TABLE ideas (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  pitch TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'seasonal' CHECK (kind IN ('seasonal','growth','security')),
  starts TEXT,                                -- MM-DD the idea starts showing (NULL = always)
  ends TEXT,                                  -- MM-DD it stops (can wrap over new year)
  match_host TEXT,                            -- shows for clients with a site on this domain
  client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,   -- or for one client
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE idea_actions (
  idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,                      -- seasonal ideas come back next year
  action TEXT NOT NULL CHECK (action IN ('requested','dismissed')),
  request_id TEXT REFERENCES requests(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (idea_id, client_id, year)
);

-- Starter ideas, written from each build. Edit or switch off any of them in Ideas.
INSERT INTO ideas (id, title, pitch, minutes, kind, starts, ends, match_host, sort) VALUES
-- Candymonium
('idea-candy-xmas', 'Christmas tubs and stocking fillers', 'A festive section on the home page with Christmas tubs and stocking filler bags, so people can sort gifts in one go. Great for the run up to the big day.', 60, 'seasonal', '10-20', '12-20', 'candymonium.co.uk', 10),
('idea-candy-cutoff', 'Christmas order cut-off banner', 'A banner across the site with your last order and collection dates, so nobody is disappointed and you are not chasing late orders.', 30, 'seasonal', '11-15', '12-24', 'candymonium.co.uk', 20),
('idea-candy-valentines', 'Valentine''s sweet tubs', 'A Valentine''s pick and mix tub with a short gift message box at checkout. Easy add-on sale in a quiet month.', 60, 'seasonal', '01-10', '02-12', 'candymonium.co.uk', 30),
('idea-candy-easter', 'Easter treat bags', 'An Easter section with ready-made treat bags for kids and egg hunts, live in time for the school holidays.', 45, 'seasonal', '02-25', '04-02', 'candymonium.co.uk', 40),
('idea-candy-halloween', 'Halloween trick or treat tubs', 'A spooky tub for trick or treaters, front and centre on the home page through October.', 45, 'seasonal', '09-15', '10-30', 'candymonium.co.uk', 50),
-- Digz N' Lidz
('idea-digz-xmas-gift', 'Christmas gift card push', 'A festive home page banner and a Christmas design for your gift cards. You already sell them online, this puts them in front of everyone hunting for a present.', 45, 'seasonal', '11-01', '12-23', 'digznlidz.co.uk', 10),
('idea-digz-xmas-party', 'Christmas parties and work dos', 'A Christmas party page for groups and companies, pointing at your party and corporate bookings. December is when teams look for something different.', 60, 'seasonal', '10-15', '12-15', 'digznlidz.co.uk', 20),
('idea-digz-halfterm', 'Half term sessions', 'A half term banner and kids session promo that goes up a couple of weeks before each school break.', 45, 'seasonal', '01-20', '02-14', 'digznlidz.co.uk', 30),
('idea-digz-valentines', 'Valentine''s date night race', 'A date night offer for two, racing then drinks. Something different from another dinner out.', 45, 'seasonal', '01-15', '02-12', 'digznlidz.co.uk', 40),
('idea-digz-summer', 'Summer holiday sessions', 'A summer holidays page with daytime sessions for kids and families, live before schools break up.', 60, 'seasonal', '06-01', '07-20', 'digznlidz.co.uk', 50),
-- WATAG
('idea-watag-fri13', 'Friday the 13th flash day', 'A flash day page for Friday 13th with the sheet and prices, plus a ping to everyone on the loyalty app. One of the busiest days in the tattoo calendar.', 60, 'seasonal', '10-20', '11-12', 'watagapp.co.uk', 10),
('idea-watag-vouchers', 'Christmas gift vouchers', 'Gift vouchers people can buy for a mate, so tattoo money lands before Christmas instead of after.', 120, 'seasonal', '10-25', '12-20', 'watagapp.co.uk', 20),
('idea-watag-valentines', 'Valentine''s matching tattoos', 'A matching tattoos flash sheet for couples, with a booking button and a loyalty app ping.', 45, 'seasonal', '01-10', '02-12', 'watagapp.co.uk', 30),
-- Rubies & Pearls
('idea-rp-gift-guide', 'Christmas gift guide', 'A gift guide on the shop, picked by Ruby and grouped by budget, so people can find the right piece without scrolling the lot.', 60, 'seasonal', '10-20', '12-18', 'rubiesandpearls.co.uk', 10),
('idea-rp-giftwrap', 'Gift wrap and a gift note', 'Let customers add gift wrap and a handwritten note at checkout. Small extra on every gift order.', 90, 'seasonal', '10-15', '12-15', 'rubiesandpearls.co.uk', 20),
('idea-rp-posting', 'Last posting dates banner', 'A banner with the last order dates for Christmas delivery, so nobody misses out.', 30, 'seasonal', '11-20', '12-22', 'rubiesandpearls.co.uk', 30),
('idea-rp-valentines', 'Valentine''s edit', 'A Valentine''s edit of romantic pieces, featured on the home page.', 45, 'seasonal', '01-10', '02-12', 'rubiesandpearls.co.uk', 40),
('idea-rp-mothers-day', 'Mother''s Day edit', 'A Mother''s Day edit with gift wrap front and centre.', 45, 'seasonal', '02-10', '03-05', 'rubiesandpearls.co.uk', 50),
('idea-rp-admin-lock', 'Lock down the stock manager', 'The stock manager login gets a limit on wrong guesses and its own address, so nobody can sit there trying passwords.', 45, 'security', NULL, NULL, 'rubiesandpearls.co.uk', 5),
-- Joyce's Irish Whiskey
('idea-jiw-xmas', 'Christmas gift message', 'A gift message at checkout and a Christmas banner, so bottles go straight out as presents.', 60, 'seasonal', '10-20', '12-18', 'jiwhiskey.co.uk', 10),
('idea-jiw-cutoff', 'Christmas delivery cut-off', 'A banner with the last order date for Christmas delivery.', 30, 'seasonal', '11-15', '12-22', 'jiwhiskey.co.uk', 20),
('idea-jiw-paddys', 'St Patrick''s Day feature', 'A St Patrick''s Day takeover on the home page. The biggest day of the year for an Irish whiskey.', 60, 'seasonal', '02-10', '03-16', 'jiwhiskey.co.uk', 30),
('idea-jiw-fathers', 'Father''s Day gifts', 'A Father''s Day banner and gift message, live a few weeks before.', 45, 'seasonal', '05-15', '06-18', 'jiwhiskey.co.uk', 40),
-- 3DFC
('idea-3dfc-xmas-merch', 'Christmas merch bundles', 'Merch bundles for Christmas, a tee and a cap together at a set price, with a last order date banner.', 60, 'seasonal', '10-25', '12-15', '3dfc.tv', 10),
('idea-3dfc-blackfriday', 'Black Friday merch sale', 'A one weekend merch sale with a countdown on the home page.', 45, 'seasonal', '11-01', '11-29', '3dfc.tv', 20),
('idea-3dfc-countdown', 'Fight night countdown', 'A countdown on the home page for the next event, with tickets one tap away. Goes up the day the card is announced.', 45, 'growth', NULL, NULL, '3dfc.tv', 30),
-- Elite Force
('idea-ef-events', 'Festive event security', 'A short section on Christmas and New Year event cover. December is the busiest month for door and event security.', 45, 'seasonal', '10-15', '12-15', 'eliteforce.site', 10);
