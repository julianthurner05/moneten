-- Putzplan: Aufgaben können mehrmals pro Woche fällig sein (2x, 3x).
-- Erledigt-Haken gelten dann pro Durchgang (slot) innerhalb der Woche.

ALTER TABLE cleaning_tasks ADD COLUMN times_per_week INTEGER NOT NULL DEFAULT 1;

CREATE TABLE cleaning_done_new (
  task_id TEXT NOT NULL REFERENCES cleaning_tasks(id),
  week_start TEXT NOT NULL,
  slot INTEGER NOT NULL DEFAULT 0,
  done_by TEXT NOT NULL REFERENCES users(id),
  done_at TEXT NOT NULL,
  PRIMARY KEY (task_id, week_start, slot)
);
INSERT INTO cleaning_done_new (task_id, week_start, slot, done_by, done_at)
  SELECT task_id, week_start, 0, done_by, done_at FROM cleaning_done;
DROP TABLE cleaning_done;
ALTER TABLE cleaning_done_new RENAME TO cleaning_done;
