import { json } from '../../../lib/http.js';

export async function onRequestGet({ env }) {
  return json({ key: env.VAPID_PUBLIC_KEY || null });
}
