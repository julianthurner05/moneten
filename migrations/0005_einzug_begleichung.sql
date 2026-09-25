-- Begleichungen können zum Einzug-Bereich gehören (zählen dort, nicht in Allgemein).
ALTER TABLE settlements ADD COLUMN is_einzug INTEGER NOT NULL DEFAULT 0;
