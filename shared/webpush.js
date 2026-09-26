// Web-Push-Versand: VAPID-Signatur plus Payload-Verschlüsselung nach RFC 8291 (aes128gcm).
// Läuft in Workers und Node (ab 18) – braucht nur globalThis.crypto und fetch.

const te = new TextEncoder();

function b64urlDecode(value) {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function b64urlEncode(bytes) {
  let raw = '';
  for (const b of new Uint8Array(bytes)) raw += String.fromCharCode(b);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...parts) {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

/** VAPID-JWT (ES256) für den Push-Dienst des Endpunkts. */
async function vapidHeaders(endpoint, publicKey, privateKeyPkcs8, subject) {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    b64urlDecode(privateKeyPkcs8),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const header = b64urlEncode(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64urlEncode(
    te.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: subject,
      })
    )
  );
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    te.encode(`${header}.${claims}`)
  );
  return { Authorization: `vapid t=${header}.${claims}.${b64urlEncode(signature)}, k=${publicKey}` };
}

/** Payload nach RFC 8291 für das Abo verschlüsseln. */
async function encryptPayload(subscription, payload) {
  const uaPublic = b64urlDecode(subscription.p256dh);
  const authSecret = b64urlDecode(subscription.auth);

  const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, ephemeral.privateKey, 256)
  );

  const keyInfo = concat(te.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);

  const record = concat(te.encode(JSON.stringify(payload)), new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, record));

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);
  return concat(salt, recordSize, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

/**
 * Eine Push-Mitteilung an ein Abo schicken.
 * @param {{endpoint: string, p256dh: string, auth: string}} subscription
 * @param {{title?: string, body?: string, url?: string}} payload
 * @param {{publicKey: string, privateKey: string, subject: string}} vapid
 * @returns {Promise<Response>} – 404/410 heißt: Abo ist tot und kann gelöscht werden.
 */
export async function sendPush(subscription, payload, vapid) {
  const [auth, body] = await Promise.all([
    vapidHeaders(subscription.endpoint, vapid.publicKey, vapid.privateKey, vapid.subject),
    encryptPayload(subscription, payload),
  ]);
  return fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      ...auth,
      TTL: '3600',
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
    },
    body,
  });
}
