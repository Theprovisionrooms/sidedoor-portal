// Sidedoor Portal timer. Intellectual property of Sidedoor Digital.
const DAILY = '7 8 * * *';

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(event.cron === DAILY ? daily(env) : call(env, 'uptime'));
  }
};

async function call(env, job) {
  const res = await fetch(`${env.APP_URL}/api/cron?job=${job}`, {
    method: 'POST',
    headers: { 'x-cron-secret': env.CRON_SECRET, 'content-type': 'application/json' },
    body: '{}'
  });
  const data = await res.json().catch(() => ({}));
  console.log(job, res.status, JSON.stringify(data));
  return data;
}

async function daily(env) {
  await call(env, 'daily');
  // Health and analytics do a few sites per call; keep going until they're through.
  for (const job of ['health', 'analytics']) {
    for (let i = 0; i < 6; i++) {
      const r = await call(env, job);
      if (!r.more) break;
    }
  }
}
