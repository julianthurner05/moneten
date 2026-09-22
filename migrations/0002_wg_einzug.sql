-- WG-Funktionen: Einzug, Kategorie-Zuordnung für Gruppenausgaben,
-- Bestätigung von Ausgleichszahlungen.

ALTER TABLE group_expenses ADD COLUMN is_einzug INTEGER NOT NULL DEFAULT 0;

ALTER TABLE settlements ADD COLUMN confirmed_at TEXT;
UPDATE settlements SET confirmed_at = created_at WHERE confirmed_at IS NULL;

-- Eigene Kategorie-Zuordnung pro Person und Gruppenausgabe.
CREATE TABLE personal_expense_categories (
  user_id TEXT NOT NULL REFERENCES users(id),
  expense_id TEXT NOT NULL REFERENCES group_expenses(id),
  category_id TEXT NOT NULL REFERENCES personal_categories(id),
  PRIMARY KEY (user_id, expense_id)
);

-- Private Einzugskosten: nur für die Person selbst sichtbar.
CREATE TABLE einzug_personal (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  spent_on TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_personal_expense_categories_user ON personal_expense_categories(user_id);
CREATE INDEX idx_einzug_personal_group_user ON einzug_personal(group_id, user_id);
