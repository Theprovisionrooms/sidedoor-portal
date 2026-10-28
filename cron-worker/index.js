// Sidedoor Portal daily tick. Intellectual property of Sidedoor Digital.
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(tick(env));
  }
};

async function tick(env) {
  const res = await fetch(`${env.APP_URL}/api/cron`, {
    method: 'POST',
    headers: { 'x-cron-secret': env.CRON_SECRET, 'content-type': 'application/json' },
    body: '{}'
  });
  console.log('cron', res.status, await res.text());
}
