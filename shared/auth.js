// Passwort-Hashing und Session-Tokens über Web Crypto.
// 100.000 Iterationen sind das von Cloudflare Workers erlaubte Maximum für PBKDF2.

export const PBKDF2_ITERATIONS = 100000;

const encoder = new TextEncoder();

export function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateSaltHex() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
}

export function generateSessionToken() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export async function hashPassword(password, saltHex, iterations = PBKDF2_ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex), iterations },
    key,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

export async function hashSessionToken(token) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return bytesToHex(new Uint8Array(digest));
}

/** Vergleich in konstanter Zeit, um Timing-Rückschlüsse zu vermeiden. */
export function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
