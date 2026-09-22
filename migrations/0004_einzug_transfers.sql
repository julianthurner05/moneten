-- Überweisungs-Vermerke für gemeinsame Einzugs-Ausgaben:
-- hält pro Person fest, dass ihr Anteil überwiesen wurde (rein informativ).

CREATE TABLE einzug_transfers (
  expense_id TEXT NOT NULL REFERENCES group_expenses(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  transferred_at TEXT NOT NULL,
  PRIMARY KEY (expense_id, user_id)
);
