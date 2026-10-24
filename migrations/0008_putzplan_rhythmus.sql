-- Putzplan: Rhythmus pro Aufgabe (alle n Wochen) und Merkliste,
-- welche „Du bist dran"-Mitteilungen schon verschickt wurden.

ALTER TABLE cleaning_tasks ADD COLUMN interval_weeks INTEGER NOT NULL DEFAULT 1;

CREATE TABLE cleaning_notified (
  task_id TEXT NOT NULL REFERENCES cleaning_tasks(id),
  week_start TEXT NOT NULL,
  PRIMARY KEY (task_id, week_start)
);
