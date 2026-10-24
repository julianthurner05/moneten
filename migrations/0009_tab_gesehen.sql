-- Merkt sich pro Person, Gruppe und Tab, bis wann sie den Tab gesehen hat –
-- Grundlage für die roten Zähler an den Tabs (Neues von anderen).

CREATE TABLE tab_seen (
  user_id TEXT NOT NULL REFERENCES users(id),
  group_id TEXT NOT NULL REFERENCES groups(id),
  tab TEXT NOT NULL,
  seen_at TEXT NOT NULL,
  PRIMARY KEY (user_id, group_id, tab)
);
