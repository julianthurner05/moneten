-- Grundstein für Web-Push-Mitteilungen: ein Abo pro Gerät und User.
CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Gemeinsame Einkaufsliste pro Gruppe.
CREATE TABLE shopping_items (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  name TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
