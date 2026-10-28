// Run once: node scripts/vapid-keys.mjs
// Prints the two secrets the app needs for phone notifications.
const { webcrypto: c } = await import('node:crypto');
const k = await c.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
const raw = new Uint8Array(await c.subtle.exportKey('raw', k.publicKey));
const jwk = await c.subtle.exportKey('jwk', k.privateKey);
const b64url = (b) => Buffer.from(b).toString('base64url');
console.log('VAPID_PUBLIC_KEY=' + b64url(raw));
console.log('VAPID_PRIVATE_KEY=' + jwk.d);
