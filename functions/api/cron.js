// Called by the small cron worker (cron-worker/). Guarded by CRON_SECRET.
//   ?job=daily (or no job): on the 1st build this month's bills; every day, gentle nudges on overdue bills
//   ?job=uptime            every 30 minutes, is each site up
//   ?job=health            daily, padlock, certificate, security headers, domain renewal (a few sites per call)
//   ?job=analytics         daily, Search Console numbers (a few sites per call)
//   ?job=speed             daily, PageSpeed for sites not tested this week (two per call)
import { json, HttpError, now } from '../../lib/http.js';
import { generateMonthly, sendInvoice, listInvoices, settings, currentPeriod, ukDay, monthName } from '../../lib/billing.js';
import { lastFullMonth } from '../../lib/report.js';
import { notify } from '../../lib/notify.js';
import { uptimeRun, deepCheckDue, speedDue } from '../../lib/health.js';
import { syncDue } from '../../lib/google.js';

function safeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function onRequestPost({ request, env }) {
  if (!safeEqual(request.headers.get('x-cron-secret') || '', env.CRON_SECRET || '')) throw new HttpError(404, 'Not found');
  const url = new URL(request.url);
  const job = url.searchParams.get('job') || 'daily';
  if (job === 'uptime') return json(await uptimeRun(env));
  if (job === 'health') return json(await deepCheckDue(env, env.APP_ORIGIN || url.origin));
  if (job === 'analytics') return json(await syncDue(env));
  if (job === 'speed') return json(await speedDue(env));
  if (job !== 'daily') throw new HttpError(400, 'Unknown job');
  const force = url.searchParams.get('force') === 'monthly'; // for testing
  const report = { period: currentPeriod(), created: [], sent: [], reminded: [] };

  if (ukDay() === 1 || force) {
    report.created = await generateMonthly(env, report.period);
    const s = await settings(env);
    if (s.auto_send === '1') {
      for (const d of await listInvoices(env, { statuses: ['draft'] })) {
        try { await sendInvoice(env, d.id); report.sent.push(d.ref); } catch (e) { report.sent.push(`${d.ref} failed: ${e.message}`); }
      }
    }
    // Monthly reports are ready for last month.
    const { results: users } = await env.DB.prepare(
      "SELECT u.id FROM users u JOIN clients c ON c.id = u.client_id WHERE c.archived = 0 AND u.role = 'client' AND EXISTS (SELECT 1 FROM sites s WHERE s.client_id = c.id)"
    ).all();
    if (users.length) {
      await notify(env, { userIds: users.map((u) => u.id) }, {
        title: `Your ${monthName(lastFullMonth())} report is in`,
        body: 'Visits from Google, checks, fixes and everything done behind the scenes.',
        url: '/#/report'
      });
    }
    report.reports_sent = users.length;
    const waiting = (await listInvoices(env, { statuses: ['draft'] })).length;
    if (waiting) {
      await notify(env, { admins: true }, {
        title: `${waiting} bill${waiting === 1 ? '' : 's'} ready to send`,
        body: 'One tap and they go out with your Revolut link.',
        url: '/#/money'
      });
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const threeDaysAgo = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  for (const inv of await listInvoices(env, { statuses: ['sent'] })) {
    if (!inv.due_date || inv.due_date > threeDaysAgo || inv.claimed_paid_at) continue;
    const row = await env.DB.prepare('SELECT reminded_at FROM invoices WHERE id = ?').bind(inv.id).first();
    if (row.reminded_at && row.reminded_at > weekAgo) continue;
    await notify(env, { clientId: inv.client_id }, {
      title: 'Quick reminder from Jordan',
      body: `${inv.title} (£${(inv.total_pence / 100).toFixed(2)}) is still open. Tap to pay, or tell me if you already have.`,
      url: `/#/billing/${inv.id}`
    });
    await env.DB.prepare('UPDATE invoices SET reminded_at = ? WHERE id = ?').bind(now(), inv.id).run();
    report.reminded.push(inv.ref);
  }
  report.date = today;
  return json(report);
}
