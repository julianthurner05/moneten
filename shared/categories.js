// Vorgegebene Kategorien: werden für jeden User automatisch angelegt.

// Fixe Kategorien – in der Oberfläche nicht änderbar.
export const DEFAULT_CATEGORIES = [
  { name: 'Einkaufen', counts: 1 },
  { name: 'Essen gehen', counts: 1 },
  { name: 'Freizeit', counts: 1 },
];

/** Legt fehlende Standard-Kategorien an – auch nachträglich, wenn neue dazukommen. */
export async function ensureDefaultCategories(env, userId) {
  const { results } = await env.DB.prepare('SELECT name FROM personal_categories WHERE user_id = ?')
    .bind(userId)
    .all();
  const have = new Set(results.map((r) => r.name));
  const missing = DEFAULT_CATEGORIES.map((category, index) => ({ ...category, index })).filter(
    (category) => !have.has(category.name)
  );
  if (missing.length === 0) return;
  await env.DB.batch(
    missing.map((category) =>
      env.DB.prepare(
        `INSERT INTO personal_categories (id, user_id, name, counts_toward_month, sort_order, archived)
         VALUES (?, ?, ?, ?, ?, 0)`
      ).bind(crypto.randomUUID(), userId, category.name, category.counts, category.index)
    )
  );
}
