// Rechenlogik für Aufteilung, Salden und Ausgleichsvorschläge.
// Wird von den Pages Functions und den Tests gemeinsam genutzt.

/**
 * Gleiche Aufteilung: Rest-Cent deterministisch verteilen –
 * nach user_id sortiert bekommen die ersten Personen je 1 Cent mehr.
 * @returns {Array<{userId: string, shareCents: number}>}
 */
export function splitEqual(amountCents, userIds) {
  const sorted = [...userIds].sort();
  const base = Math.trunc(amountCents / sorted.length);
  const rest = amountCents - base * sorted.length;
  return sorted.map((userId, i) => ({
    userId,
    shareCents: base + (i < rest ? 1 : 0),
  }));
}

/**
 * Aufteilung nach Anteilen (z. B. 2:1:1). Grundbetrag abrunden,
 * Rest-Cent deterministisch nach user_id sortiert verteilen.
 * @param {Array<{userId: string, units: number}>} shares
 * @returns {Array<{userId: string, shareCents: number}>}
 */
export function splitByShares(amountCents, shares) {
  const sorted = [...shares].sort((a, b) => (a.userId < b.userId ? -1 : 1));
  const totalUnits = sorted.reduce((sum, s) => sum + s.units, 0);
  const result = sorted.map((s) => ({
    userId: s.userId,
    shareCents: Math.trunc((amountCents * s.units) / totalUnits),
  }));
  let rest = amountCents - result.reduce((sum, s) => sum + s.shareCents, 0);
  for (let i = 0; rest > 0; i = (i + 1) % result.length) {
    result[i].shareCents += 1;
    rest -= 1;
  }
  return result;
}

/**
 * Salden einer Gruppe.
 * Saldo = bezahlte Ausgaben − eigene Anteile + geleistete Ausgleichszahlungen − erhaltene.
 * Positiv heißt: die anderen schulden dir etwas.
 * @param {string[]} memberIds
 * @param {Array<{paidBy: string, amountCents: number, shares: Array<{userId: string, shareCents: number}>}>} expenses – ohne gelöschte
 * @param {Array<{fromUser: string, toUser: string, amountCents: number}>} settlements
 * @returns {Map<string, number>} userId → Cent
 */
export function computeBalances(memberIds, expenses, settlements) {
  const balances = new Map(memberIds.map((id) => [id, 0]));
  const add = (id, cents) => balances.set(id, (balances.get(id) ?? 0) + cents);
  for (const expense of expenses) {
    add(expense.paidBy, expense.amountCents);
    for (const share of expense.shares) {
      add(share.userId, -share.shareCents);
    }
  }
  for (const s of settlements) {
    add(s.fromUser, s.amountCents);
    add(s.toUser, -s.amountCents);
  }
  return balances;
}

/**
 * Ausgleichsvorschläge: wiederholt größten Gläubiger mit größtem
 * Schuldner verrechnen, bis alle Salden 0 sind.
 * @param {Map<string, number>} balances
 * @returns {Array<{fromUser: string, toUser: string, amountCents: number}>}
 */
export function suggestSettlements(balances) {
  const creditors = [];
  const debtors = [];
  for (const [userId, cents] of [...balances.entries()].sort()) {
    if (cents > 0) creditors.push({ userId, cents });
    else if (cents < 0) debtors.push({ userId, cents: -cents });
  }
  creditors.sort((a, b) => b.cents - a.cents);
  debtors.sort((a, b) => b.cents - a.cents);
  const suggestions = [];
  while (creditors.length > 0 && debtors.length > 0) {
    const creditor = creditors[0];
    const debtor = debtors[0];
    const amount = Math.min(creditor.cents, debtor.cents);
    suggestions.push({ fromUser: debtor.userId, toUser: creditor.userId, amountCents: amount });
    creditor.cents -= amount;
    debtor.cents -= amount;
    if (creditor.cents === 0) creditors.shift();
    if (debtor.cents === 0) debtors.shift();
    creditors.sort((a, b) => b.cents - a.cents);
    debtors.sort((a, b) => b.cents - a.cents);
  }
  return suggestions;
}
