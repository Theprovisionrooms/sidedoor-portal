// Password hashing and sessions. Intellectual property of Sidedoor Digital.
// PBKDF2-SHA256 at 100k iterations (the Workers runtime ceiling), random salt per user.
// Session cookies hold a random token; D1 only ever stores its SHA-256.

const ITERATIONS = 100000;
const COOKIE = 'sd_session';
const SESSION_DAYS = 30;
const enc = new TextEncoder();

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const toB64url = (buf) => toB64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sha256(value) {
  return toB64url(await crypto.subtle.digest('SHA-256', enc.encode(value)));
}

export async function hashPassword(password, salt = crypto.getRandomValues(new Uint8Array(16)), iterations = ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return `pbkdf2$${iterations}$${toB64(salt)}$${toB64(bits)}`;
}

export async function verifyPassword(password, stored) {
  const [alg, iterations, salt] = String(stored).split('$');
  if (alg !== 'pbkdf2' || !salt) return false;
  const test = await hashPassword(password, fromB64(salt), Number(iterations));
  return safeEqual(test, stored);
}

export function checkNewPassword(pw) {
  if (typeof pw !== 'string' || pw.length < 10) return 'Make it at least 10 characters';
  if (pw.length > 200) return 'That one is a bit long';
  return null;
}

// Friendly temporary passwords, e.g. "harbour-lantern-418-pier".
const WORDS = ['harbour', 'lantern', 'pier', 'tide', 'neon', 'ember', 'copper', 'willow', 'anchor', 'marble',
  'cedar', 'falcon', 'meadow', 'orbit', 'pepper', 'quartz', 'river', 'saffron', 'thistle', 'velvet',
  'walnut', 'amber', 'beacon', 'canvas', 'dune', 'ferry', 'garnet', 'hazel', 'island', 'juniper',
  'kettle', 'lagoon', 'maple', 'nectar', 'olive', 'pebble', 'raven', 'sorrel', 'timber', 'umber',
  'violet', 'wren', 'yarrow', 'zephyr', 'birch', 'clover', 'drift', 'echo', 'flint', 'glacier',
  'heron', 'indigo', 'jasper', 'kestrel', 'linen', 'moss', 'nimbus', 'onyx', 'plume', 'quill',
  'rowan', 'sable', 'tansy', 'urchin'];
export function tempPassword() {
  const r = crypto.getRandomValues(new Uint32Array(4));
  const w = (i) => WORDS[r[i] % WORDS.length];
  return `${w(0)}-${w(1)}-${100 + (r[2] % 900)}-${w(3)}`;
}

export async function createSession(env, userId) {
  const token = toB64url(crypto.getRandomValues(new Uint8Array(32)));
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  await env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256(token), userId, expires).run();
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}

export const clearCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

function readToken(request) {
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(/(?:^|;\s*)sd_session=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

export async function getSessionUser(request, env) {
  const token = readToken(request);
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.role, u.client_id, u.must_change_password, s.id AS session_id
       FROM sessions s JOIN users u ON u.id = s.user_id
       LEFT JOIN clients c ON c.id = u.client_id
      WHERE s.id = ? AND s.expires_at > ? AND (c.archived IS NULL OR c.archived = 0)`
  ).bind(await sha256(token), new Date().toISOString()).first();
  return row || null;
}

export async function endSession(request, env) {
  const token = readToken(request);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256(token)).run();
}
