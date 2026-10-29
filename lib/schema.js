// Keeps the live database in step with the code. Intellectual property of Sidedoor Digital.
// For every database update that's been applied, check the columns it added are really there,
// and quietly add any that are missing (an older copy of an update can leave gaps).
// It never runs an update that hasn't been applied: that stays with `wrangler d1 migrations apply`.

const EXPECTED = [
  { file: '0001_init.sql', tables: ['clients', 'users', 'sessions', 'login_attempts', 'sites', 'requests', 'request_messages'], columns: [] },
  {
    file: '0002_billing_push.sql', tables: ['settings', 'invoices', 'invoice_lines', 'push_subscriptions'],
    columns: [
      ['clients', 'monthly_fee_pence', 'INTEGER NOT NULL DEFAULT 0'],
      ['clients', 'pay_link', 'TEXT'],
      ['clients', 'monthly_from', 'TEXT'],
      ['requests', 'invoice_id', 'TEXT']
    ]
  },
  {
    file: '0003_insights.sql', tables: ['analytics_daily', 'analytics_top', 'site_checks', 'work_log', 'security_notes', 'ideas', 'idea_actions'],
    columns: [
      ['sites', 'analytics_synced_at', 'TEXT'], ['sites', 'analytics_error', 'TEXT'], ['sites', 'health', 'TEXT'],
      ['sites', 'health_checked_at', 'TEXT'], ['sites', 'fail_count', 'INTEGER NOT NULL DEFAULT 0'], ['sites', 'down_since', 'TEXT']
    ]
  },
  { file: '0004_reports_speed_referrals.sql', tables: ['referrals'], columns: [['sites', 'speed', 'TEXT'], ['sites', 'speed_checked_at', 'TEXT']] },
  { file: '0005_network.sql', tables: ['network_profiles', 'network_intros'], columns: [['referrals', 'thanked_at', 'TEXT']] },
  { file: '0006_updates.sql', tables: ['updates', 'update_reads'], columns: [] }
];

export const LATEST = EXPECTED[EXPECTED.length - 1].file;

let checkedThisIsolate = false;

export async function checkSchema(env, { repair = true } = {}) {
  const report = { applied: [], missing_migrations: [], missing_tables: [], repaired: [], missing_columns: [], tracking: true };
  let applied;
  try {
    applied = new Set((await env.DB.prepare('SELECT name FROM d1_migrations').all()).results.map((r) => r.name));
  } catch {
    report.tracking = false; // No record of updates: assume everything ran and just check what's there.
    applied = new Set(EXPECTED.map((e) => e.file));
  }
  const tables = new Set((await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()).results.map((r) => r.name));
  const colCache = new Map();
  const cols = async (t) => {
    if (!colCache.has(t)) colCache.set(t, new Set((await env.DB.prepare(`PRAGMA table_info(${t})`).all()).results.map((r) => r.name)));
    return colCache.get(t);
  };
  for (const m of EXPECTED) {
    if (!applied.has(m.file)) { report.missing_migrations.push(m.file); continue; }
    report.applied.push(m.file);
    for (const t of m.tables) if (!tables.has(t)) report.missing_tables.push(t);
    for (const [t, c, ddl] of m.columns) {
      if (!tables.has(t)) continue;
      if ((await cols(t)).has(c)) continue;
      if (repair) {
        try {
          await env.DB.prepare(`ALTER TABLE ${t} ADD COLUMN ${c} ${ddl}`).run();
          (await cols(t)).add(c);
          report.repaired.push(`${t}.${c}`);
        } catch (e) {
          report.missing_columns.push(`${t}.${c} (${e.message})`);
        }
      } else report.missing_columns.push(`${t}.${c}`);
    }
  }
  report.ok = !report.missing_migrations.length && !report.missing_tables.length && !report.missing_columns.length;
  return report;
}

// Runs once per server instance, before the first request is handled. Cheap and silent.
export async function ensureSchemaOnce(env) {
  if (checkedThisIsolate) return;
  checkedThisIsolate = true;
  try {
    const r = await checkSchema(env, { repair: true });
    if (r.repaired.length) console.log('schema repaired', r.repaired.join(', '));
  } catch (e) {
    console.error('schema check failed', e);
  }
}
