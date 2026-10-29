// System check: is everything this app needs actually switched on? Admin only.
import { json, requireAdmin, now } from '../../../lib/http.js';
import { checkSchema, LATEST } from '../../../lib/schema.js';
import { listProperties, gscConfigured } from '../../../lib/google.js';

export async function onRequestGet(ctx) {
  requireAdmin(ctx);
  const { env, request } = ctx;
  const url = new URL(request.url);
  const checks = [];
  const add = (group, label, ok, fix, level = 'bad') => checks.push({ group, label, ok: !!ok, fix: ok ? null : fix, level: ok ? 'ok' : level });

  // Database
  const schema = await checkSchema(env, { repair: true });
  add('Database', 'All database updates applied', !schema.missing_migrations.length,
    `Run in your sidedoor-portal folder: npx.cmd wrangler d1 migrations apply sidedoor-portal --remote (missing: ${schema.missing_migrations.join(', ')})`);
  add('Database', 'All tables present', !schema.missing_tables.length, `Missing: ${schema.missing_tables.join(', ')}. Send this to Claude.`);
  add('Database', 'All fields present', !schema.missing_columns.length, `Couldn't add: ${schema.missing_columns.join(', ')}. Send this to Claude.`);
  let writeOk = false, writeErr = '';
  try {
    await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('system_check', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(now()).run();
    writeOk = !!(await env.DB.prepare("SELECT value FROM settings WHERE key = 'system_check'").first());
  } catch (e) { writeErr = e.message; }
  add('Database', 'Can save data', writeOk, `Writing to the database failed: ${writeErr}`);

  // Secrets (presence only, values never leave Cloudflare)
  add('Secrets', 'Phone notifications keys (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)', env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY,
    'Run node scripts/vapid-keys.mjs, add both lines as Secrets on the Pages project (Production), then Retry deployment.');
  add('Secrets', 'Timer key (CRON_SECRET)', env.CRON_SECRET, 'Add CRON_SECRET as a Secret on the Pages project and the same value on the timer worker.');
  add('Secrets', 'Search Console (GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY)', gscConfigured(env), 'Add both from the Google JSON file as Secrets, then Retry deployment.', 'warn');
  add('Secrets', 'PageSpeed key (PSI_API_KEY, optional)', env.PSI_API_KEY, 'Optional. Speed tests still run without it, just with a shared daily limit.', 'info');
  add('Secrets', 'Setup token removed', !env.SETUP_TOKEN, 'You are set up, so delete SETUP_TOKEN from the Pages project secrets.', 'warn');

  // Google, only if asked (it calls out)
  if (url.searchParams.get('google') && gscConfigured(env)) {
    let props = [], err = '';
    try { props = await listProperties(env); } catch (e) { err = e.message; }
    add('Google', `Search Console sign-in (${props.length} properties shared)`, !err && props.length, err || 'Signed in, but no properties are shared with the service account yet. Add it as a Restricted user in Search Console.', 'warn');
  }

  // Timer: has it called in recently?
  const { n: recentChecks } = await env.DB.prepare('SELECT COUNT(*) AS n FROM site_checks WHERE checked_at > ?').bind(new Date(Date.now() - 2 * 3600e3).toISOString()).first();
  const { n: sites } = await env.DB.prepare('SELECT COUNT(*) AS n FROM sites').first();
  add('Timer', 'Up/down checks running (last 2 hours)', !sites || recentChecks > 0,
    'The timer worker is not calling in. Run: npx.cmd wrangler deploy --config cron-worker/wrangler.toml, then set its CRON_SECRET to match.', 'warn');

  return json({ checks, schema: { applied: schema.applied, latest: LATEST, repaired: schema.repaired, tracking: schema.tracking }, origin: url.origin });
}
