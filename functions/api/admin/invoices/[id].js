import { json, readBody, requireAdmin, text, now, uid, HttpError } from '../../../../lib/http.js';
import { loadInvoice, sendInvoice, parseLines } from '../../../../lib/billing.js';
import { notifyLater } from '../../../../lib/notify.js';

export async function onRequestPatch(ctx) {
  requireAdmin(ctx);
  const { env, request, params } = ctx;
  const inv = await loadInvoice(env, params.id);
  const b = await readBody(request);

  switch (b.action) {
    case 'send':
      return json({ invoice: await sendInvoice(env, inv.id, { waitUntil: (p) => ctx.waitUntil(p) }) });

    case 'paid':
      if (inv.status !== 'sent' && inv.status !== 'draft') throw new HttpError(409, `${inv.ref} is ${inv.status}`);
      await env.DB.prepare("UPDATE invoices SET status = 'paid', paid_at = ? WHERE id = ?").bind(now(), inv.id).run();
      notifyLater(ctx, { clientId: inv.client_id }, { title: 'Payment received, thank you', body: `${inv.ref} is all paid up.`, url: `/#/billing/${inv.id}` });
      break;

    case 'unpaid':
      if (inv.status !== 'paid') throw new HttpError(409, 'Only paid invoices can be reopened');
      await env.DB.prepare("UPDATE invoices SET status = 'sent', paid_at = NULL, claimed_paid_at = NULL WHERE id = ?").bind(inv.id).run();
      break;

    case 'not_received':
      // Client said paid but nothing arrived yet: clear the flag, keep it open.
      await env.DB.prepare('UPDATE invoices SET claimed_paid_at = NULL WHERE id = ?').bind(inv.id).run();
      break;

    case 'void':
      if (inv.status === 'paid') throw new HttpError(409, 'Reopen it first if you need to cancel a paid invoice');
      // Free up any change work so it can go on a later bill.
      await env.DB.batch([
        env.DB.prepare("UPDATE invoices SET status = 'void' WHERE id = ?").bind(inv.id),
        env.DB.prepare('UPDATE requests SET invoice_id = NULL WHERE invoice_id = ?').bind(inv.id)
      ]);
      break;

    case 'edit': {
      if (inv.status !== 'draft') throw new HttpError(409, 'Only drafts can be edited. Cancel it and make a new one.');
      const title = 'title' in b ? text(b.title, { required: true, max: 120, label: 'Title' }) : inv.title;
      const note = 'note' in b ? text(b.note, { max: 1000 }) || null : inv.note;
      const due = 'due_date' in b ? (b.due_date || null) : inv.due_date;
      const link = 'pay_link' in b ? (String(b.pay_link || '').trim() || null) : inv.pay_link;
      if (link && !/^https:\/\/\S+$/.test(link)) throw new HttpError(400, 'Pay link needs to start with https://');
      const stmts = [env.DB.prepare('UPDATE invoices SET title = ?, note = ?, due_date = ?, pay_link = ? WHERE id = ?').bind(title, note, due, link, inv.id)];
      if ('lines' in b) {
        // Keep links to change requests on lines that stay; drop the rest.
        const keep = parseLines(b.lines);
        const byDesc = new Map(inv.lines.filter((l) => l.request_id).map((l) => [l.description, l.request_id]));
        stmts.push(env.DB.prepare('DELETE FROM invoice_lines WHERE invoice_id = ?').bind(inv.id));
        stmts.push(env.DB.prepare('UPDATE requests SET invoice_id = NULL WHERE invoice_id = ?').bind(inv.id));
        keep.forEach((l, i) => {
          const rid = byDesc.get(l.description) || null;
          stmts.push(env.DB.prepare('INSERT INTO invoice_lines (id, invoice_id, description, amount_pence, request_id, sort) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(uid(), inv.id, l.description, l.amount_pence, rid, i));
          if (rid) stmts.push(env.DB.prepare('UPDATE requests SET invoice_id = ? WHERE id = ?').bind(inv.id, rid));
        });
      }
      await env.DB.batch(stmts);
      break;
    }
    default:
      throw new HttpError(400, 'Unknown action');
  }
  return json({ invoice: await loadInvoice(env, inv.id) });
}
