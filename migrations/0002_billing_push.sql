-- Sidedoor Portal | stage 2: billing and phone notifications

ALTER TABLE clients ADD COLUMN monthly_fee_pence INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clients ADD COLUMN pay_link TEXT;              -- overrides the default Revolut link for this client
ALTER TABLE clients ADD COLUMN monthly_from TEXT;          -- YYYY-MM the monthly plan starts (blank = straight away)

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
INSERT INTO settings (key, value) VALUES ('default_pay_link', ''), ('auto_send', '0');

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('monthly','build','other')),
  period TEXT,                                -- YYYY-MM, monthly invoices only
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','void')),
  pay_link TEXT,
  note TEXT,
  due_date TEXT,                              -- YYYY-MM-DD
  sent_at TEXT,
  claimed_paid_at TEXT,                       -- client tapped "I've paid"
  paid_at TEXT,
  reminded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX idx_invoices_monthly ON invoices(client_id, period) WHERE kind = 'monthly';
CREATE INDEX idx_invoices_client ON invoices(client_id, status);
CREATE INDEX idx_invoices_status ON invoices(status);

CREATE TABLE invoice_lines (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount_pence INTEGER NOT NULL,
  request_id TEXT REFERENCES requests(id) ON DELETE SET NULL,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_lines_invoice ON invoice_lines(invoice_id);

ALTER TABLE requests ADD COLUMN invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL;

CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_push_user ON push_subscriptions(user_id);
