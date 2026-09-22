// Vorgegebene Kategorien: werden für jeden User automatisch angelegt.

export const DEFAULT_CATEGORIES = [
  { name: 'Lebensmittel', counts: 1 },
  { name: 'Essen gehen', counts: 1 },
  { name: 'Freizeit', counts: 1 },
  { name: 'Mobilität', counts: 1 },
  { name: 'Haushalt', counts: 1 },
  { name: 'Kleidung & Pflege', counts: 1 },
  { name: 'Gesundheit', counts: 1 },
  { name: 'Abos & Handy', counts: 1 },
  { name: 'Sonstiges', counts: 1 },
  { name: 'Rücklagen', counts: 0 },
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
