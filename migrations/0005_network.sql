-- Sidedoor Portal | stage 5: the Sidedoor network

-- Each client can opt in to a profile other Sidedoor businesses can see.
CREATE TABLE network_profiles (
  client_id TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  visible INTEGER NOT NULL DEFAULT 0,
  display_name TEXT,
  category TEXT,
  town TEXT,
  about TEXT,
  offer TEXT,                -- a perk for other Sidedoor members
  looking_for TEXT,          -- what they'd like to find through the network
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  joined_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_network_visible ON network_profiles(visible, joined_at);

-- Intros always go through Jordan. Contact details are only shared once he makes the intro.
CREATE TABLE network_intros (
  id TEXT PRIMARY KEY,
  from_client TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  to_client TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','introduced','declined')),
  seen_from INTEGER NOT NULL DEFAULT 1,
  seen_to INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  decided_at TEXT
);
CREATE INDEX idx_intros_status ON network_intros(status, created_at);
CREATE INDEX idx_intros_from ON network_intros(from_client);
CREATE INDEX idx_intros_to ON network_intros(to_client);

-- Referral thank-you shown to the client once a lead becomes a client
ALTER TABLE referrals ADD COLUMN thanked_at TEXT;
