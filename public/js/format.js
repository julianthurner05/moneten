// Beträge und Daten formatieren (de-AT, EUR, Cent als ganze Zahlen).

const euroFormat = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' });
const dateFormat = new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
const monthFormat = new Intl.DateTimeFormat('de-AT', { month: 'long', year: 'numeric' });

/** Betrag und €-Zeichen getrennt – fürs große Saldo mit kleinem Symbol. */
export function formatEuroParts(cents) {
  // de-AT stellt das €-Zeichen voran; laut Vorgabe steht es nach dem Betrag (1.234,56 €).
  const parts = euroFormat.formatToParts(cents / 100);
  const symbol = parts.find((p) => p.type === 'currency')?.value ?? '€';
  const number = parts
    .filter((p) => p.type !== 'currency' && p.type !== 'literal')
    .map((p) => p.value)
    .join('');
  return { number, symbol };
}

export function formatEuro(cents) {
  const { number, symbol } = formatEuroParts(cents);
  return `${number}\u00A0${symbol}`;
}

/** Eingabe wie "12,5", "1.234,56" oder "12.50" nach Cent. Gibt null bei Unlesbarem. */
export function parseEuroInput(value) {
  if (typeof value !== 'string') return null;
  let s = value.trim().replace(/[€\s]/g, '');
  if (!s) return null;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}

/** Cent als reine Zahl mit Komma für Eingabefelder, z. B. 1234 → "12,34". */
export function centsToInput(cents) {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function formatDate(isoDate) {
  return dateFormat.format(new Date(isoDate + 'T12:00:00'));
}

/** "2026-09" → "September 2026" */
export function formatMonth(month) {
  return monthFormat.format(new Date(month + '-15T12:00:00'));
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function monthOf(isoDate) {
  return isoDate.slice(0, 7);
}

/** Vor diesem Monat gibt es in der App nichts – gleicher Wert wie im Server (shared/month.js). */
export const MIN_MONTH = '2026-09';

export function currentMonth() {
  return todayIso().slice(0, 7);
}

/** "2026-01" + 1 → "2026-02"; negative Deltas erlaubt. */
export function monthAdd(month, delta) {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const total = year * 12 + (m - 1) + delta;
  return `${String(Math.floor(total / 12)).padStart(4, '0')}-${String(((total % 12) + 12) % 12 + 1).padStart(2, '0')}`;
}

export function isMonthString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return false;
  const m = Number(value.slice(5, 7));
  return m >= 1 && m <= 12;
}
