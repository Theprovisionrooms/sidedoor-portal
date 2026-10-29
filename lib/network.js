// The Sidedoor network. Intellectual property of Sidedoor Digital.
import { HttpError, text } from './http.js';

export const CATEGORIES = ['Food and drink', 'Retail', 'Leisure and activities', 'Health and beauty', 'Events', 'Trades and services', 'Professional services', 'Other'];

export async function profileFor(env, clientId) {
  const [p, c] = await Promise.all([
    env.DB.prepare('SELECT * FROM network_profiles WHERE client_id = ?').bind(clientId).first(),
    env.DB.prepare('SELECT business_name, contact_name, phone FROM clients WHERE id = ?').bind(clientId).first()
  ]);
  if (!c) throw new HttpError(404, "Couldn't find that client");
  const u = await env.DB.prepare('SELECT email FROM users WHERE client_id = ? ORDER BY created_at LIMIT 1').bind(clientId).first();
  // Sensible defaults so joining is one tap.
  return p ? { ...p, visible: !!p.visible } : {
    client_id: clientId, visible: false, display_name: c.business_name, category: '', town: 'Southport', about: '', offer: '', looking_for: '',
    contact_name: c.contact_name, contact_phone: c.phone || '', contact_email: u?.email || '', joined_at: null
  };
}

export function parseProfile(b) {
  const category = text(b.category, { max: 60 });
  return {
    visible: b.visible ? 1 : 0,
    display_name: text(b.display_name, { required: true, max: 80, label: 'Business name' }),
    category: CATEGORIES.includes(category) ? category : 'Other',
    town: text(b.town, { max: 60, label: 'Town' }) || null,
    about: text(b.about, { max: 280, label: 'About' }) || null,
    offer: text(b.offer, { max: 160, label: 'Member perk' }) || null,
    looking_for: text(b.looking_for, { max: 160, label: 'Looking for' }) || null,
    contact_name: text(b.contact_name, { max: 80, label: 'Contact name' }) || null,
    contact_phone: text(b.contact_phone, { max: 40, label: 'Phone' }) || null,
    contact_email: text(b.contact_email, { max: 160, label: 'Email' }) || null
  };
}

// Public card: no contact details.
export function card(p, me) {
  return {
    client_id: p.client_id, display_name: p.display_name, category: p.category, town: p.town, about: p.about,
    offer: p.offer, looking_for: p.looking_for, joined_at: p.joined_at, is_me: p.client_id === me
  };
}

export async function directory(env, me) {
  const { results } = await env.DB.prepare(
    `SELECT p.* FROM network_profiles p JOIN clients c ON c.id = p.client_id
      WHERE p.visible = 1 AND c.archived = 0 ORDER BY p.joined_at DESC`
  ).all();
  return results.map((p) => card(p, me));
}

// Intros for one client, with the other side's contact details once Jordan has introduced them.
export async function introsFor(env, clientId) {
  const { results } = await env.DB.prepare(
    `SELECT i.*, pf.display_name AS from_name, pt.display_name AS to_name,
            pf.contact_name AS from_contact, pf.contact_phone AS from_phone, pf.contact_email AS from_email,
            pt.contact_name AS to_contact, pt.contact_phone AS to_phone, pt.contact_email AS to_email
       FROM network_intros i
       LEFT JOIN network_profiles pf ON pf.client_id = i.from_client
       LEFT JOIN network_profiles pt ON pt.client_id = i.to_client
      WHERE (i.from_client = ? OR (i.to_client = ? AND i.status = 'introduced'))
      ORDER BY i.created_at DESC LIMIT 50`
  ).bind(clientId, clientId).all();
  return results.map((r) => {
    const mine = r.from_client === clientId;
    const open = r.status === 'introduced';
    return {
      id: r.id, status: r.status, created_at: r.created_at, decided_at: r.decided_at, message: r.message,
      direction: mine ? 'out' : 'in',
      other: mine ? r.to_name : r.from_name,
      other_id: mine ? r.to_client : r.from_client,
      contact: open ? (mine
        ? { name: r.to_contact, phone: r.to_phone, email: r.to_email }
        : { name: r.from_contact, phone: r.from_phone, email: r.from_email }) : null,
      unseen: mine ? !r.seen_from : !r.seen_to
    };
  });
}
