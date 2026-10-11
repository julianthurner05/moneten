-- Wiederkehrende Gruppenausgaben (z. B. Miete): werden monatlich als echte
-- Gruppenausgabe materialisiert und so auch im Privat-Bereich gespiegelt.
CREATE TABLE group_recurring (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  paid_by TEXT NOT NULL REFERENCES users(id),
  start_month TEXT NOT NULL,
  end_month TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
ALTER TABLE group_expenses ADD COLUMN recurring_id TEXT;

-- Putzplan: Aufgaben rotieren wochenweise durch die Mitglieder.
CREATE TABLE cleaning_tasks (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE TABLE cleaning_done (
  task_id TEXT NOT NULL REFERENCES cleaning_tasks(id),
  week_start TEXT NOT NULL,
  done_by TEXT NOT NULL REFERENCES users(id),
  done_at TEXT NOT NULL,
  PRIMARY KEY (task_id, week_start)
);
