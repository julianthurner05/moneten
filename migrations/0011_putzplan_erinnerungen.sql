-- Putzplan-Erinnerungen in Stufen: am Stichtag einmal, danach pro Folgetag
-- zweimal (vormittags/nachmittags). Jede Stufe wird nur einmal verschickt.

CREATE TABLE cleaning_notified_new (
  task_id TEXT NOT NULL REFERENCES cleaning_tasks(id),
  week_start TEXT NOT NULL,
  stage INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (task_id, week_start, stage)
);
INSERT INTO cleaning_notified_new (task_id, week_start, stage)
  SELECT task_id, week_start, 0 FROM cleaning_notified;
DROP TABLE cleaning_notified;
ALTER TABLE cleaning_notified_new RENAME TO cleaning_notified;
