-- Kaution: fest vermerkte Einzugs-Ausgabe, zählt in die Salden,
-- aber nicht zu den Einzugskosten und ist nicht bearbeitbar.

ALTER TABLE group_expenses ADD COLUMN is_deposit INTEGER NOT NULL DEFAULT 0;
