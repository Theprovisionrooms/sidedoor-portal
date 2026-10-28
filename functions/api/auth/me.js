import { json } from '../../../lib/http.js';

export async function onRequestGet({ data, env }) {
  const u = data.user;
  if (!u) return json({ user: null });
  let client = null;
  if (u.client_id) {
    client = await env.DB.prepare('SELECT id, business_name, contact_name, hourly_rate_pence FROM clients WHERE id = ?')
      .bind(u.client_id).first();
  }
  return json({
    user: { id: u.id, name: u.name, email: u.email, role: u.role, must_change_password: !!u.must_change_password },
    client
  });
}
