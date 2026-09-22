// Vorgegebene Kategorien: werden für jeden User automatisch angelegt.

// Fixe Kategorien – in der Oberfläche nicht änderbar.
export const DEFAULT_CATEGORIES = [
  { name: 'Einkaufen', counts: 1 },
  { name: 'Freizeit', counts: 1 },
];

/** Legt die Standard-Kategorien an, falls der User noch keine hat. */
export async function ensureDefaultCategories(env, userId) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM personal_categories WHERE user_id = ?')
    .bind(userId)
    .first();
  if (row.n > 0) return;
  await env.DB.batch(
    DEFAULT_CATEGORIES.map((category, index) =>
      env.DB.prepare(
        `INSERT INTO personal_categories (id, user_id, name, counts_toward_month, sort_order, archived)
         VALUES (?, ?, ?, ?, ?, 0)`
      ).bind(crypto.randomUUID(), userId, category.name, category.counts, index)
    )
  );
}
