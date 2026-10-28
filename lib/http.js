// Shared helpers for Pages Functions. Intellectual property of Sidedoor Digital.

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
  });
}

export async function readBody(request) {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new HttpError(415, 'Expected JSON');
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'That request could not be read');
  }
}

export function text(value, { max = 200, required = false, label = 'This field' } = {}) {
  const v = String(value ?? '').trim();
  if (required && !v) throw new HttpError(400, `${label} is needed`);
  if (v.length > max) throw new HttpError(400, `${label} is too long`);
  return v;
}

export function siteUrl(value) {
  let v = String(value ?? '').trim();
  if (!v) throw new HttpError(400, 'Site address is needed');
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  let u;
  try { u = new URL(v); } catch { throw new HttpError(400, `"${value}" is not a valid web address`); }
  if (!['http:', 'https:'].includes(u.protocol) || !u.hostname.includes('.')) {
    throw new HttpError(400, `"${value}" is not a valid web address`);
  }
  return u.origin + (u.pathname === '/' ? '' : u.pathname);
}

export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();

export function requireUser(ctx, { allowPending = false } = {}) {
  const user = ctx.data.user;
  if (!user) throw new HttpError(401, 'Please log in');
  if (user.must_change_password && !allowPending) {
    throw new HttpError(403, 'Pick a new password first', 'password_change');
  }
  return user;
}

export function requireAdmin(ctx) {
  const user = requireUser(ctx);
  if (user.role !== 'admin') throw new HttpError(404, 'Not found');
  return user;
}

export function chargePence(minutes, ratePence) {
  if (!minutes) return 0;
  return Math.round((minutes / 60) * ratePence);
}
