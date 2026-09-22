// Prüfung und Aufbereitung einer Ausgabe aus der API-Anfrage.

import { isDateString, isNonEmptyString } from './http.js';
import { splitByShares, splitEqual } from './split.js';

/**
 * @param {object} body – {amountCents, description, spentOn, paidBy, splitMode, participants}
 *   participants: [{userId, shareCents?, units?}]
 * @param {string[]} memberIds
 * @returns {{error: string} | {expense: object}}
 */
export function validateExpenseInput(body, memberIds) {
  const memberSet = new Set(memberIds);
  const amountCents = body.amountCents;
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { error: 'Der Betrag muss größer als 0 sein.' };
  }
  if (!isNonEmptyString(body.description)) return { error: 'Beschreibung fehlt.' };
  if (!isDateString(body.spentOn)) return { error: 'Ungültiges Datum.' };
  if (!memberSet.has(body.paidBy)) return { error: 'Wer bezahlt hat, muss Mitglied der Gruppe sein.' };
  if (!['equal', 'exact', 'shares'].includes(body.splitMode)) {
    return { error: 'Ungültige Aufteilung.' };
  }

  const participants = Array.isArray(body.participants) ? body.participants : [];
  if (participants.length === 0) return { error: 'Mindestens eine Person muss beteiligt sein.' };
  const seen = new Set();
  for (const p of participants) {
    if (!p || !memberSet.has(p.userId)) return { error: 'Beteiligte müssen Mitglieder der Gruppe sein.' };
    if (seen.has(p.userId)) return { error: 'Beteiligte dürfen nicht doppelt vorkommen.' };
    seen.add(p.userId);
  }

  let shares;
  if (body.splitMode === 'equal') {
    shares = splitEqual(amountCents, participants.map((p) => p.userId));
  } else if (body.splitMode === 'exact') {
    for (const p of participants) {
      if (!Number.isInteger(p.shareCents) || p.shareCents < 0) {
        return { error: 'Exakte Beträge müssen 0 oder größer sein.' };
      }
    }
    const sum = participants.reduce((s, p) => s + p.shareCents, 0);
    if (sum !== amountCents) {
      return { error: 'Die exakten Beträge müssen zusammen den Gesamtbetrag ergeben.' };
    }
    shares = participants.map((p) => ({ userId: p.userId, shareCents: p.shareCents }));
  } else {
    for (const p of participants) {
      if (!Number.isInteger(p.units) || p.units < 1) {
        return { error: 'Anteile müssen ganze Zahlen ab 1 sein.' };
      }
    }
    shares = splitByShares(amountCents, participants.map((p) => ({ userId: p.userId, units: p.units })));
  }

  return {
    expense: {
      amountCents,
      description: body.description.trim(),
      spentOn: body.spentOn,
      paidBy: body.paidBy,
      splitMode: body.splitMode,
      shares,
    },
  };
}
