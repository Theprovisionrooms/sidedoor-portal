// Sidedoor Portal | Intellectual property of Sidedoor Digital.
const view = document.getElementById('view');
const tabs = document.getElementById('tabs');
const top = document.getElementById('top');
const state = { user: null, client: null, lastLogins: [] };

/* ---------- helpers ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const money = (p) => `£${((p || 0) / 100).toFixed(2)}`;
const firstName = (n) => String(n || '').trim().split(/\s+/)[0];
function duration(m) {
  if (m == null) return '';
  if (m === 0) return 'No charge';
  if (m < 60) return `${m} mins`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} hr ${r} mins` : `${h} hr`;
}
function ago(iso) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  if (s < 172800) return 'yesterday';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening'; };

let toastTimer;
function toast(msg, bad = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = 'toast'), 2800);
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin'
  });
  let data = {};
  try { data = await res.json(); } catch {}
  if (method !== 'GET') badgeTimer = 0;
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login')) { state.user = null; go('/login'); }
    if (data.code === 'password_change') go('/password');
    const e = new Error(data.error || 'Something went wrong. Try again.');
    e.status = res.status;
    throw e;
  }
  return data;
}

function go(path) {
  if (location.hash !== '#' + path) location.hash = path;
  else route();
}

// Wires a form: collects values, disables the button, shows errors inline.
function onSubmit(form, fn) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', form);
    const err = $('.error', form);
    if (err) err.textContent = '';
    if (btn) btn.disabled = true;
    try { await fn(Object.fromEntries(new FormData(form)), form); }
    catch (x) { if (err) err.textContent = x.message; else toast(x.message, true); }
    finally { if (btn && document.body.contains(btn)) btn.disabled = false; }
  });
}

/* ---------- icons ---------- */
const I = {
  home: '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/></svg>',
  site: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
  req: '<svg viewBox="0 0 24 24"><path d="M5 4h14v12H9l-4 4z"/><path d="M9 9h6M9 12h4"/></svg>',
  me: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  clients: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.6-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.8 3 2.6 3.5 5.2"/></svg>',
  today: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  network: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M10.8 7.2 6.3 15.8M13.2 7.2l4.5 8.6M7.5 18h9"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  money: '<svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="13" rx="2.5"/><path d="M2.5 10.5h19M6.5 15h4"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
  inbox: '<svg viewBox="0 0 24 24"><path d="M4 13l2-8h12l2 8v6H4z"/><path d="M4 13h5l1 2h4l1-2h5"/></svg>',
  door: '<img class="mark" src="/assets/art/door-mark.webp" alt="" width="84" height="106">',
  wordmark: '<img class="wm" src="/assets/brand/wm-sidedoor-ink.webp" alt="Sidedoor" width="360" height="33"><img class="wm-digital" src="/assets/brand/wm-digital-ink.webp" alt="Digital" width="150" height="12">'
};

/* ---------- chrome ---------- */
function chrome(active, opts = {}) {
  if (active !== null || !opts.bare) document.body.classList.remove('at-door');
  const u = state.user;
  const show = !!u && !u.must_change_password && !opts.bare;
  top.hidden = !show;
  tabs.hidden = !show;
  document.body.classList.toggle('no-tabs', !show);
  view.classList.toggle('wide', !!opts.wide);
  if (!show) return;
  $('#top-who').textContent = u.role === 'admin' ? 'Admin' : state.client?.business_name || '';
  const items = u.role === 'admin'
    ? [['/', 'Today', I.today], ['/clients', 'Clients', I.clients], ['/money', 'Money', I.money], ['/account', 'Account', I.me]]
    : [['/', 'Home', I.home], ['/site', 'My site', I.site], ['/requests', 'Requests', I.req], ['/network', 'Network', I.network], ['/account', 'More', I.more]];
  tabs.innerHTML = items.map(([p, label, icon]) =>
    `<a href="#${p}" class="${active === p ? 'on' : ''}" ${active === p ? 'aria-current="page"' : ''}>${icon}<span>${label}</span></a>`).join('');
  refreshBadges();
}

function render(html) {
  const paint = () => {
    view.innerHTML = `<div class="fade-in">${html}</div>`;
    $$('[data-w]', view).forEach((el) => (el.style.width = `${Math.min(100, Number(el.dataset.w) || 0)}%`));
    window.scrollTo(0, 0);
  };
  const real = !html.includes('class="skeleton"');
  if (real && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches && view.dataset.painted) {
    document.startViewTransition(paint);
  } else paint();
  if (real) { view.dataset.painted = '1'; countUp(view); }
}
const loading = () => render('<div class="stack"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>');

/* ---------- shared bits ---------- */
const CLIENT_STATUS = {
  new: 'Sent to Jordan', quoted: 'Needs your OK', approved: 'Approved, in the queue',
  in_progress: 'Being worked on', done: 'Done', declined: 'Not going ahead', cancelled: 'Cancelled'
};
const ADMIN_STATUS = {
  new: 'Needs a quote', quoted: 'Waiting on client', approved: 'Approved, to do',
  in_progress: 'In progress', done: 'Done', declined: 'Declined', cancelled: 'Cancelled'
};
const statusPill = (s) => `<span class="pill ${s}">${esc((state.user?.role === 'admin' ? ADMIN_STATUS : CLIENT_STATUS)[s] || s)}</span>`;

function requestCard(r, showClient = false) {
  const price = r.status === 'done' ? r.charge_pence : r.quoted_pence;
  return `<a class="card tight" href="#/requests/${esc(r.id)}">
    <div class="row between"><h3 class="grow">${esc(r.title)}</h3>${price != null ? `<span class="mono faint">${price ? money(price) : 'Free'}</span>` : ''}</div>
    <div class="item"><div class="meta">${statusPill(r.status)}${r.urgent ? '<span class="pill urgent">Urgent</span>' : ''}
      ${showClient ? `<span class="faint">${esc(r.business_name)}</span>` : ''}<span class="faint">${ago(r.updated_at)}</span></div></div>
  </a>`;
}

function emptyBlock(icon, title, sub = '') {
  return `<div class="card empty">${icon}<h3>${esc(title)}</h3>${sub ? `<p class="faint">${esc(sub)}</p>` : ''}</div>`;
}

/* ---------- auth screens ---------- */
function loginView() {
  chrome(null, { bare: true });
  document.body.classList.add('at-door');
  render(`<div class="login">
    <div class="center">${I.door}${I.wordmark}</div>
    <div class="door-card">
      <p class="tagline"><b>There's the obvious way of doing things.</b>Then there's the Sidedoor.</p>
      <form class="stack" id="f" novalidate>
        <div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" autocomplete="username" required></div>
        <div class="field"><label for="pw">Password</label><input class="input" id="pw" name="password" type="password" autocomplete="current-password" required></div>
        <p class="error" role="alert"></p>
        <button class="btn neon block" type="submit"><i class="glyph" aria-hidden="true"></i>Step inside</button>
        <p class="faint center">Forgotten it? Message Jordan and he'll reset it for you.</p>
      </form>
    </div>
  </div>`);
  onSubmit($('#f'), async (v) => {
    const r = await api('/auth/login', { method: 'POST', body: v });
    await loadMe();
    go(r.must_change_password ? '/password' : '/');
  });
}

function passwordView(forced) {
  chrome(forced ? null : '/account', { bare: forced });
  render(`<div class="${forced ? 'login' : 'stack'}">
    ${forced ? `<div class="center">${I.door}</div>` : ''}
    <p class="eyebrow">${forced ? 'One quick thing' : 'Account'}</p>
    <h1>${forced ? `Welcome in, ${esc(firstName(state.user.name))}.` : 'Change password'}</h1>
    <p class="lede">${forced ? "Pick your own password and you're done. At least 10 characters. A short phrase works well." : 'At least 10 characters.'}</p>
    <form class="stack" id="f" novalidate>
      <div class="field"><label for="cur">${forced ? 'Temporary password from Jordan' : 'Current password'}</label><input class="input" id="cur" name="current" type="password" autocomplete="current-password" required></div>
      <div class="field"><label for="next">New password</label><input class="input" id="next" name="next" type="password" autocomplete="new-password" minlength="10" required></div>
      <p class="error" role="alert"></p>
      <button class="btn neon block" type="submit">Save password</button>
      ${forced ? '<button class="linkish" type="button" id="out">Log out</button>' : ''}
    </form>
  </div>`);
  onSubmit($('#f'), async (v) => {
    await api('/auth/password', { method: 'POST', body: v });
    await loadMe();
    toast('Password saved');
    go(forced ? '/welcome' : '/account');
  });
  $('#out')?.addEventListener('click', logout);
}

function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function welcomeView() {
  chrome(null, { bare: true });
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  render(`<div class="login stack">
    <div class="center">${I.door}</div>
    <h1>You're in.</h1>
    <p class="lede">This is where everything about your site lives now. See it live, send me changes, and see what I'm doing behind the scenes.</p>
    ${isStandalone() ? '' : `<div class="card"><h3>Pop it on your home screen</h3>
      <p class="muted">${ios ? 'Tap the Share button at the bottom of Safari, then <b>Add to Home Screen</b>.' : 'Tap the menu (three dots) in Chrome, then <b>Install app</b> or <b>Add to Home screen</b>.'} It'll sit there like a normal app.</p>
      ${!ios ? '<button class="btn ghost small" id="install" hidden>Install now</button>' : ''}</div>`}
    <a class="btn neon block" href="#/">Take me in</a>
  </div>`);
  if (deferredInstall) {
    const b = $('#install');
    if (b) { b.hidden = false; b.onclick = () => deferredInstall.prompt(); }
  }
}
let deferredInstall = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });

async function logout() {
  try { await api('/auth/logout', { method: 'POST', body: {} }); } catch {}
  state.user = null; state.client = null;
  go('/login');
}

function wirePushRow() {
  const drawPush = async () => {
    let st; try { st = await pushState(); } catch { st = 'unsupported'; }
    const label = { on: 'On for this phone', off: 'Off', denied: 'Blocked. Allow them in your phone settings.', unsupported: "This browser can't do notifications", 'needs-install': 'Add the app to your home screen first, then open it from there' }[st];
    $('#pushst').textContent = label;
    $('#pushbtns').innerHTML = st === 'on' ? '<button class="btn ghost small" id="ptest">Test</button> <button class="btn ghost small" id="poff">Turn off</button>'
      : st === 'off' ? '<button class="btn small" id="pon">Turn on</button>' : '';
    $('#pon')?.addEventListener('click', async () => { try { await enablePush(); toast('Notifications on'); drawPush(); } catch (e) { toast(e.message, true); } });
    $('#poff')?.addEventListener('click', async () => { await disablePush(); toast('Notifications off'); drawPush(); });
    $('#ptest')?.addEventListener('click', async () => { try { await api('/push/test', { method: 'POST', body: {} }); toast('Sent. It should pop up in a moment.'); } catch (e) { toast(e.message, true); } });
  };
  drawPush();
}

function accountView() {
  if (state.user.role === 'client') return moreView();
  chrome('/account');
  const u = state.user;
  render(`<div class="stack">
    <p class="eyebrow">Account</p>
    <h1>${esc(u.name)}</h1>
    <p class="lede">${esc(u.email)}${state.client ? ` · ${esc(state.client.business_name)}` : ''}</p>
    <a class="card tight" href="#/password-change"><h3>Change password</h3><p class="faint">Signs you out on other devices</p></a>
    <div class="card tight row" id="pushrow"><div class="grow"><h3>Phone notifications</h3><p class="faint" id="pushst">Checking...</p></div><span id="pushbtns"></span></div>
    ${u.role === 'client' ? `<a class="card tight" href="#/refer"><h3>Refer a business</h3><p class="faint">Know someone who needs a site or an app?</p></a>` : `<a class="card tight" href="#/leads"><h3>Leads</h3><p class="faint">Businesses your clients have passed on</p></a><a class="card tight" href="#/intros"><h3>Sidedoor network</h3><p class="faint">Members and intro requests</p></a>`}
    ${u.role === 'client' ? `<div class="card tight"><h3>Talk to Jordan</h3><p class="muted">For anything about your site, use <a href="#/requests/new">a request</a> so it's all kept in one place. Something urgent and the site's down? Mark the request as urgent and I'll see it straight away.</p></div>` : ''}
    <button class="btn ghost block" id="out">Log out</button>
    <p class="faint">Sidedoor Digital · 98 King Street, Southport · getsidedoor.co.uk</p>
  </div>`);
  $('#out').onclick = logout;
  wirePushRow();
}

/* ---------- client: home ---------- */
async function clientHome() {
  chrome('/');
  loading();
  const d = await api('/home');
  const site = d.sites[0];
  const needOk = d.open_requests.filter((r) => r.status === 'quoted');
  let bills = null, ideas = [], scenes = null, refs = null, net = null;
  await Promise.all([
    api('/referrals').then((r) => (refs = r)).catch(() => {}),
    api('/network').then((r) => (net = r)).catch(() => {}),
    api('/billing').then((b) => (bills = b)).catch(() => {}),
    api('/ideas').then((r) => (ideas = r.ideas.filter((i) => !i.action))).catch(() => {}),
    api('/insights').then((r) => (scenes = r)).catch(() => {})
  ]);
  const dueBill = bills?.invoices.find((i) => i.status === 'sent' && !i.claimed_paid_at);
  render(`<div class="stack">
    <p class="eyebrow">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    <h1>${greeting()}, ${esc(firstName(state.user.name))}.</h1>
    ${needOk.length ? `<a class="card night" href="#/requests/${esc(needOk[0].id)}">
        <p class="eyebrow">Needs your OK</p><h2>${esc(needOk[0].title)}</h2>
        <p class="muted">${duration(needOk[0].quoted_minutes)} · ${money(needOk[0].quoted_pence)}. Tap to approve.</p>
        ${needOk.length > 1 ? `<p class="faint">Plus ${needOk.length - 1} more waiting</p>` : ''}</a>` : ''}
    ${site ? `<a class="card night" href="#/view/${esc(site.id)}">
        <p class="eyebrow">Your site</p><h2>${esc(hostOf(site.url))}</h2>
        <p class="muted">See it as your customers do, on phone and desktop.</p>
        <span class="btn ghost on-night small">View live site</span></a>` : ''}
    <div class="stats">
      <div class="card stat"><b>${d.open_requests.length}</b><span>Open requests</span></div>
      <div class="card stat"><b>${d.done_count}</b><span>Jobs done</span></div>
      <div class="card stat"><b>${money(d.client.hourly_rate_pence)}</b><span>Per hour</span></div>
    </div>
    ${dueBill ? `<a class="card night" href="#/billing/${esc(dueBill.id)}"><p class="eyebrow">${dueBill.overdue ? 'Overdue' : 'Bill ready'}</p>
        <div class="row between"><h2>${esc(dueBill.title)}</h2><span class="price-sm">${money(dueBill.total_pence)}</span></div>
        <span class="btn neon small">Pay with Revolut</span></a>` : ''}
    <a class="btn neon block" href="#/requests/new">Ask for a change</a>
    ${pushNudge()}
    ${scenes ? `<a class="card" href="#/site">
      <div class="row between"><span class="eyebrow">Behind the scenes</span><span class="faint">This month</span></div>
      <div class="scenes mt16"><div><b>${nf(scenes.checks_30d)}</b><span>Checks</span></div><div><b>${scenes.health.filter((h) => h.protections).reduce((t, h) => t + h.protections_ok, 0)}/${scenes.health.filter((h) => h.protections).reduce((t, h) => t + h.protections_total, 0) || '-'}</b><span>Protections</span></div><div><b>${scenes.analytics.find((a) => a.has_data) ? nf(scenes.analytics.reduce((t, a) => t + (a.now?.clicks || 0), 0)) : '-'}</b><span>Google visits</span></div></div>
      ${scenes.log[0] ? `<p class="faint mt16">Latest: ${esc(scenes.log[0].title)}, ${ago(scenes.log[0].created_at)}</p>` : ''}</a>` : ''}
    ${new Date().getDate() <= 10 && scenes ? `<a class="card lit" href="#/report"><p class="eyebrow">New</p><h3 class="mt8">Your ${esc(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1)).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' }))} report is in</h3><p class="faint mt8">Tap to see your month.</p></a>` : ''}
    ${ideas.length ? `<div class="section-title"><h2>Ideas for right now</h2><a class="faint" href="#/ideas">All ideas</a></div><div class="list" id="ideas">${ideas.slice(0, 2).map((i) => ideaCard(i, d.client.hourly_rate_pence)).join('')}</div>` : ''}
    <div class="section-title"><h2>On the go</h2><a class="faint" href="#/requests">See all</a></div>
    <div class="list">${d.open_requests.length ? d.open_requests.slice(0, 5).map((r) => requestCard(r)).join('')
      : emptyBlock(I.req, 'Nothing on the go', 'When you want something changed, send it through and I will quote it.')}</div>
    ${net ? networkTeaser(net) : ''}
    ${referCard(refs)}
  </div>`);
  if ($('#ideas')) wireIdeas($('#ideas'), ideas, d.client.hourly_rate_pence);
}

/* ---------- requests ---------- */
async function requestsList() {
  chrome('/requests');
  loading();
  const [{ requests }, home] = await Promise.all([api('/requests'), api('/home').catch(() => ({}))]);
  const reply = home.reply_mins;
  const replyText = reply == null ? '' : reply < 60 ? 'under an hour' : reply < 180 ? `about ${Math.round(reply / 60)} hour${Math.round(reply / 60) === 1 ? '' : 's'}` : reply < 1440 ? 'the same day' : 'a day or so';
  const open = requests.filter((r) => ['new', 'quoted', 'approved', 'in_progress'].includes(r.status));
  const past = requests.filter((r) => !open.includes(r));
  render(`<div class="stack">
    <p class="eyebrow">Requests</p>
    <div class="row between"><h1>Your changes</h1></div>
    <p class="lede">Work is ${money(state.client?.hourly_rate_pence ?? 1500)} an hour and most changes take under an hour. I'll always quote first, nothing starts until you say so.</p>
    ${replyText ? `<p class="status-line"><i class="led on"></i>Jordan usually quotes in ${replyText}</p>` : ''}
    <div class="row"><a class="btn neon grow" href="#/requests/new">Ask for a change</a><a class="btn ghost" href="#/ideas">Ideas</a></div>
    <div class="section-title"><h2>Open</h2></div>
    <div class="list">${open.length ? open.map((r) => requestCard(r)).join('') : emptyBlock(I.req, 'All clear', 'Nothing waiting.')}</div>
    ${past.length ? `<div class="section-title"><h2>Finished</h2></div><div class="list">${past.map((r) => requestCard(r)).join('')}</div>` : ''}
  </div>`);
}

async function newRequest(query) {
  const admin = state.user.role === 'admin';
  chrome(admin ? '/' : '/requests');
  loading();
  let sites = [], clients = [];
  if (admin) clients = (await api('/admin/clients')).clients.filter((c) => !c.archived);
  else sites = (await api('/home')).sites;
  const preClient = query.get('client') || '';
  if (admin && preClient) sites = (await api(`/admin/clients/${preClient}`)).sites;
  const preSite = query.get('site') || '';
  const ideas = ['Update opening hours', 'Change prices', 'Swap photos', 'New page', 'Seasonal update', 'Something is broken'];

  render(`<div class="stack">
    <p class="eyebrow">New request</p>
    <h1>${admin ? 'Log a request' : 'What do you need?'}</h1>
    <p class="lede">${admin ? 'For something a client asked for outside the app.' : "Tell me in your own words. I'll come back with a quote before doing anything."}</p>
    <div class="chips" id="ideas">${ideas.map((i) => `<button type="button" class="chip">${esc(i)}</button>`).join('')}</div>
    <form class="stack" id="f" novalidate>
      ${admin ? `<div class="field"><label for="client">Client</label><select class="input" id="client" name="client_id" required>
        <option value="">Choose a client</option>${clients.map((c) => `<option value="${esc(c.id)}" ${c.id === preClient ? 'selected' : ''}>${esc(c.business_name)}</option>`).join('')}</select></div>` : ''}
      ${sites.length > 1 ? `<div class="field"><label for="site">Which site?</label><select class="input" id="site" name="site_id">
        ${sites.map((s) => `<option value="${esc(s.id)}" ${s.id === preSite ? 'selected' : ''}>${esc(s.name)} (${esc(hostOf(s.url))})</option>`).join('')}</select></div>`
        : sites.length === 1 ? `<input type="hidden" name="site_id" value="${esc(sites[0].id)}">` : ''}
      <div class="field"><label for="title">In a few words</label><input class="input" id="title" name="title" maxlength="120" placeholder="e.g. New Christmas opening hours" value="${esc(query.get('title') || '')}" required></div>
      <div class="field"><label for="details">The details</label><textarea class="input" id="details" name="details" maxlength="4000" placeholder="What should change, where on the site, and any wording or prices. Links help too." required></textarea></div>
      <label class="check"><input type="checkbox" name="urgent" value="1"> It's urgent (something's broken or time-critical)</label>
      <p class="error" role="alert"></p>
      <button class="btn neon block" type="submit">${admin ? 'Log it' : 'Send to Jordan'}</button>
    </form>
  </div>`);
  $$('#ideas .chip').forEach((c) => (c.onclick = () => { $('#title').value = c.textContent; $('#details').focus(); }));
  $('#client')?.addEventListener('change', (e) => go(`/requests/new?client=${e.target.value}`));
  onSubmit($('#f'), async (v) => {
    v.urgent = !!v.urgent;
    const { request } = await api('/requests', { method: 'POST', body: v });
    toast(admin ? 'Logged' : "Sent. I'll quote it shortly.");
    go(`/requests/${request.id}`);
  });
}

async function requestDetail(id) {
  const admin = state.user.role === 'admin';
  chrome(admin ? '/' : '/requests');
  loading();
  const { request: r, messages } = await api(`/requests/${id}`);
  const me = state.user.id;

  let action = '';
  if (!admin && r.status === 'quoted') {
    action = `<div class="card night quote">
      <p class="eyebrow">Jordan's quote</p>
      <div class="price">${money(r.quoted_pence)}<small>${duration(r.quoted_minutes)} at ${money(r.rate_pence)}/hr</small></div>
      ${r.quote_note ? `<p>${esc(r.quote_note)}</p>` : ''}
      <p class="faint">You'll never pay more than this. If it takes less time, you pay less.</p>
      <div class="grid2"><button class="btn neon" data-act="approve">Approve</button><button class="btn ghost on-night" data-act="decline">Not right now</button></div>
    </div>`;
  } else if (!admin && r.status === 'new') {
    action = `<div class="card"><h3>With Jordan</h3><p class="muted">I'll look at this and send a quote. You'll see it here.</p>
      <button class="linkish" data-act="cancel">Cancel this request</button></div>`;
  } else if (admin && (r.status === 'new' || r.status === 'quoted')) {
    action = `<form class="card stack" id="qf">
      <h3>${r.status === 'quoted' ? 'Update quote' : 'Quote it'}</h3>
      <div class="chips" id="qchips">${[0, 15, 30, 45, 60, 90, 120].map((m) => `<button type="button" class="chip" data-m="${m}" aria-pressed="${r.quoted_minutes === m}">${m === 0 ? 'Free' : duration(m)}</button>`).join('')}</div>
      <div class="field"><label for="qm">Minutes</label><input class="input" id="qm" name="minutes" type="number" min="0" step="5" inputmode="numeric" value="${r.quoted_minutes ?? 60}" required></div>
      <p class="faint" id="qprice"></p>
      <div class="field"><label for="qn">Note to client (optional)</label><textarea class="input" id="qn" name="note" maxlength="1000" placeholder="What's included, anything they should know">${esc(r.quote_note || '')}</textarea></div>
      <p class="error"></p>
      <button class="btn neon block" type="submit">Send quote</button>
    </form>`;
  } else if (admin && (r.status === 'approved' || r.status === 'in_progress')) {
    action = `<form class="card stack" id="cf">
      <h3>${r.status === 'approved' ? 'Approved' : 'In progress'}</h3>
      <p class="muted">Quoted ${duration(r.quoted_minutes)} (${money(r.quoted_pence)}). Billing is capped at the quote.</p>
      ${r.status === 'approved' ? '<button type="button" class="btn ghost block" data-act="start">Mark as started</button>' : ''}
      <div class="field"><label for="lm">Time actually spent (minutes)</label><input class="input" id="lm" name="minutes" type="number" min="0" step="5" inputmode="numeric" value="${r.quoted_minutes ?? 0}"></div>
      <div class="field"><label for="lmsg">Message to client (optional)</label><textarea class="input" id="lmsg" name="message" maxlength="4000" placeholder="What you did. This is where they see the work."></textarea></div>
      <p class="error"></p>
      <button class="btn neon block" type="submit">Mark as done</button>
      <button type="button" class="linkish" data-act="cancel">Cancel request</button>
    </form>`;
  } else if (r.status === 'done') {
    action = `<div class="card"><h3>Done ${ago(r.completed_at)}</h3><p class="muted">${r.charge_pence ? `${duration(r.logged_minutes)} · ${money(r.charge_pence)}` : 'No charge'}</p></div>`;
  }

  render(`<div class="stack">
    <a class="faint" href="#${admin ? (r.client_id ? `/clients/${esc(r.client_id)}` : '/') : '/requests'}">&larr; Back</a>
    <div class="row wrap">${statusPill(r.status)}${r.urgent ? '<span class="pill urgent">Urgent</span>' : ''}${admin ? `<span class="faint">${esc(r.business_name)}</span>` : ''}</div>
    <h1>${esc(r.title)}</h1>
    ${r.site ? `<p class="faint">${esc(hostOf(r.site.url))}</p>` : ''}
    <div class="card"><p class="label">The details</p><p class="msgtext">${esc(r.details).replace(/\n/g, '<br>')}</p><p class="faint">Sent ${ago(r.created_at)}</p></div>
    ${action}
    <div class="section-title"><h2>Conversation</h2></div>
    <div class="thread" id="thread">${thread(messages, me)}</div>
    <form class="stack" id="mf">
      <textarea class="input" name="body" maxlength="4000" placeholder="${admin ? 'Message the client' : 'Message Jordan about this'}" required></textarea>
      <p class="error"></p>
      <button class="btn block" type="submit">Send message</button>
    </form>
  </div>`);

  $$('[data-act]').forEach((b) => (b.onclick = async () => {
    const act = b.dataset.act;
    if (act === 'cancel' && !confirm('Cancel this request?')) return;
    b.disabled = true;
    try {
      await api(`/requests/${id}/action`, { method: 'POST', body: { action: act } });
      toast({ approve: 'Approved. Thanks!', decline: 'No problem.', start: 'Marked as started', cancel: 'Cancelled' }[act]);
      route();
    } catch (e) { toast(e.message, true); b.disabled = false; }
  }));

  const qf = $('#qf');
  if (qf) {
    const upd = () => { const m = Number($('#qm').value) || 0; $('#qprice').textContent = m ? `${duration(m)} = ${money(Math.round((m / 60) * r.rate_pence))}` : 'Free of charge. Goes straight to approved.'; };
    $$('#qchips .chip').forEach((c) => (c.onclick = () => { $('#qm').value = c.dataset.m; $$('#qchips .chip').forEach((x) => x.setAttribute('aria-pressed', x === c)); upd(); }));
    $('#qm').oninput = upd; upd();
    onSubmit(qf, async (v) => { await api(`/requests/${id}/action`, { method: 'POST', body: { action: 'quote', minutes: Number(v.minutes), note: v.note } }); toast('Quote sent'); route(); });
  }
  const cf = $('#cf');
  if (cf) onSubmit(cf, async (v) => { await api(`/requests/${id}/action`, { method: 'POST', body: { action: 'complete', minutes: v.minutes === '' ? null : Number(v.minutes), message: v.message } }); toast('Marked as done'); route(); });

  onSubmit($('#mf'), async (v, form) => {
    const { messages: m } = await api(`/requests/${id}/messages`, { method: 'POST', body: v });
    $('#thread').innerHTML = thread(m, me);
    form.reset();
  });
}

function thread(messages, me) {
  if (!messages.length) return '<p class="faint">No messages yet.</p>';
  return messages.map((m) => m.kind === 'event'
    ? `<div class="event">${esc(m.body)} · ${ago(m.created_at)}</div>`
    : `<div class="msg ${m.author_role === state.user.role ? 'mine' : 'theirs'}">${esc(m.body)}<span class="by">${esc(m.author_role === 'admin' ? 'Jordan' : m.author || 'Client')} · ${ago(m.created_at)}</span></div>`).join('');
}

/* ---------- admin ---------- */
async function adminToday() {
  chrome('/');
  loading();
  const d = await api('/admin/dashboard');
  const block = (title, list, empty) => `<div class="section-title"><h2>${title}</h2><span class="faint">${list.length}</span></div>
    <div class="list">${list.length ? list.map((r) => requestCard(r, true)).join('') : `<p class="faint">${empty}</p>`}</div>`;
  render(`<div class="stack">
    <p class="eyebrow">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    <h1>${greeting()}, ${esc(firstName(state.user.name))}.</h1>
    <div class="stats">
      <div class="card stat"><b>${d.needs_quote.length + d.to_do.length}</b><span>Need you</span></div>
      <div class="card stat"><b>${money(d.month.earned_pence)}</b><span>Request work this month</span></div>
      <div class="card stat"><b>${d.client_count}</b><span>Clients</span></div>
    </div>
    <div class="row"><a class="btn neon grow" href="#/clients/new">Add client</a><a class="btn ghost" href="#/requests/new">Log request</a></div>
    ${pushNudge()}
    ${d.watch.length ? `<div class="card ${d.watch.some((w) => w.level === 'bad') ? 'night' : ''}">
      <p class="eyebrow">Sites to look at</p>
      <ul class="watch mt8">${d.watch.map((w) => `<li class="${w.level}"><a href="#/clients/${esc(w.client_id)}"><b>${esc(w.site)}</b> <span>${esc(w.text)}</span></a></li>`).join('')}</ul></div>`
      : d.sites_count ? `<div class="card tight row"><i class="led on"></i><span class="grow">All ${d.sites_count} sites up and protected.</span></div>` : ''}
    <div class="tools"><a class="chip" href="#/intros">Network</a><a class="chip" href="#/leads">Leads</a><a class="chip" href="#/admin-ideas">Ideas library</a><a class="chip" href="#/notes">Security news</a><a class="chip" href="#/gsc">Search Console</a></div>
    ${block('Needs a quote', d.needs_quote, 'Nothing new.')}
    ${block('To do', d.to_do, 'Nothing approved and waiting.')}
    ${block('Waiting on client', d.waiting_on_client, 'No quotes out.')}
  </div>`);
}

async function adminClients() {
  chrome('/clients');
  loading();
  const { clients } = await api('/admin/clients');
  const live = clients.filter((c) => !c.archived), gone = clients.filter((c) => c.archived);
  const card = (c) => `<a class="card tight" href="#/clients/${esc(c.id)}">
    <div class="row between"><h3 class="grow">${esc(c.business_name)}</h3>${c.open_count ? `<span class="pill new">${c.open_count} open</span>` : ''}</div>
    <div class="meta row wrap"><span class="faint">${esc(c.contact_name)}</span><span class="faint">${c.site_count} site${c.site_count === 1 ? '' : 's'}</span>
    <span class="faint">${c.last_login_at ? `Seen ${ago(c.last_login_at)}` : 'Not logged in yet'}</span></div></a>`;
  render(`<div class="stack">
    <p class="eyebrow">Clients</p>
    <h1>Everyone</h1>
    <div class="row"><a class="btn neon grow" href="#/clients/new">Add client</a><a class="btn ghost" href="#/import">Import</a></div>
    <div class="list">${live.length ? live.map(card).join('') : emptyBlock(I.clients, 'No clients yet', 'Import your current clients in one go.')}</div>
    ${gone.length ? `<div class="section-title"><h2>Archived</h2></div><div class="list">${gone.map(card).join('')}</div>` : ''}
  </div>`);
}

function newClientView() {
  chrome('/clients');
  render(`<div class="stack">
    <a class="faint" href="#/clients">&larr; Clients</a>
    <p class="eyebrow">New client</p>
    <h1>Add a client</h1>
    <p class="lede">They'll get a temporary password to send over. They pick their own on first login.</p>
    <form class="stack" id="f" novalidate>
      <div class="field"><label for="b">Business name</label><input class="input" id="b" name="business_name" required></div>
      <div class="grid2">
        <div class="field"><label for="n">Contact name</label><input class="input" id="n" name="contact_name" required></div>
        <div class="field"><label for="p">Phone (for WhatsApp/text)</label><input class="input" id="p" name="phone" type="tel" inputmode="tel"></div>
      </div>
      <div class="field"><label for="e">Login email</label><input class="input" id="e" name="email" type="email" required></div>
      <div class="grid2">
        <div class="field"><label for="sn">Site name</label><input class="input" id="sn" name="site_name" placeholder="Main site"></div>
        <div class="field"><label for="su">Site address</label><input class="input" id="su" name="site_url" placeholder="example.co.uk" inputmode="url"></div>
      </div>
      <div class="grid2"><div class="field"><label for="r">Hourly rate (£)</label><input class="input" id="r" name="rate" type="number" min="0" step="0.5" value="15"></div>
      <div class="field"><label for="mf">Monthly plan (£, 0 if none)</label><input class="input" id="mf" name="monthly" inputmode="decimal" value="0"></div></div>
      <div class="field"><label for="no">Private notes</label><textarea class="input" id="no" name="notes" placeholder="Only you see these"></textarea></div>
      <p class="error" role="alert"></p>
      <button class="btn neon block" type="submit">Create login</button>
    </form>
  </div>`);
  onSubmit($('#f'), async (v) => {
    const body = {
      business_name: v.business_name, contact_name: v.contact_name, email: v.email, phone: v.phone, notes: v.notes,
      hourly_rate_pence: Math.round(Number(v.rate || 15) * 100),
      monthly_fee_pence: Math.round(Number(v.monthly || 0) * 100),
      sites: v.site_url ? [{ name: v.site_name || v.business_name, url: v.site_url }] : []
    };
    const r = await api('/admin/clients', { method: 'POST', body });
    state.lastLogins = r.logins;
    go('/send');
  });
}

/* Welcome message in Jordan's voice */
function welcomeText(l) {
  return `Hi ${firstName(l.name)}, it's Jordan from Sidedoor.

Your Sidedoor app is ready. It's where you can see your site, send me any changes, and keep an eye on everything I'm doing behind the scenes. From now on anything about the site goes through there rather than WhatsApp, so nothing gets lost.

${location.origin}
Email: ${l.email}
Temporary password: ${l.temp_password}

It'll ask you to pick your own password the first time. Then add it to your home screen and it sits there like a normal app.

Any problems, just shout.
Jordan`;
}
function waNumber(phone) {
  let d = String(phone || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) return d.slice(1);
  if (d.startsWith('00')) return d.slice(2);
  if (d.startsWith('0')) return '44' + d.slice(1);
  return d;
}

function sendView() {
  chrome('/clients');
  const logins = state.lastLogins;
  if (!logins.length) return go('/clients');
  render(`<div class="stack">
    <p class="eyebrow">Send out</p>
    <h1>${logins.length === 1 ? 'Login ready' : `${logins.length} logins ready`}</h1>
    <p class="lede">Copy these now. The temporary passwords aren't shown again (you can always reset one).</p>
    <div class="list">${logins.map((l, i) => {
      const msg = welcomeText(l);
      const wa = `https://wa.me/${waNumber(l.phone)}?text=${encodeURIComponent(msg)}`;
      const sms = `sms:${encodeURIComponent(l.phone || '')}?&body=${encodeURIComponent(msg)}`;
      return `<div class="card stack" data-i="${i}">
        <div class="row between"><h3>${esc(l.name)}</h3><span class="faint">${esc(l.business_name || '')}</span></div>
        <div class="cred">${esc(msg)}</div>
        <div class="row wrap">
          <button class="btn neon small" data-copy="${i}">Copy message</button>
          <a class="btn ghost small" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>
          ${l.phone ? `<a class="btn ghost small" href="${esc(sms)}">Text</a>` : ''}
          <label class="check grow"><input type="checkbox" data-sent> Sent</label>
        </div>
      </div>`;
    }).join('')}</div>
    <button class="btn block" id="done">All sent</button>
  </div>`);
  $$('[data-copy]').forEach((b) => (b.onclick = async () => {
    try { await navigator.clipboard.writeText(welcomeText(logins[b.dataset.copy])); toast('Copied'); }
    catch { toast('Copy failed, long-press the message instead', true); }
  }));
  $('#done').onclick = () => {
    if ($$('[data-sent]').some((c) => !c.checked) && !confirm("Not all ticked as sent. The temporary passwords won't be shown again. Carry on?")) return;
    state.lastLogins = [];
    go('/clients');
  };
}

async function clientDetailView(id) {
  chrome('/clients');
  loading();
  const d = await api(`/admin/clients/${id}`);
  const c = d.client;
  render(`<div class="stack">
    <a class="faint" href="#/clients">&larr; Clients</a>
    <p class="eyebrow">${c.archived ? 'Archived client' : 'Client'}</p>
    <h1>${esc(c.business_name)}</h1>
    <p class="lede">${esc(c.contact_name)}${c.phone ? ` · <a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : ''} · ${money(c.hourly_rate_pence)}/hr</p>
    <div class="row"><a class="btn neon grow" href="#/requests/new?client=${esc(c.id)}">Log a request for them</a><a class="btn ghost" href="#/site?client=${esc(c.id)}">Their view</a></div>
    <a class="faint" href="#/report?client=${esc(c.id)}">Their monthly report</a>

    <div class="section-title"><h2>Sites</h2></div>
    <div class="list">${d.sites.map((s) => {
      let h = null; try { h = s.health ? JSON.parse(s.health) : null; } catch {}
      const p = h?.protections, keys = ['https', 'hsts', 'nosniff', 'framing', 'referrer', 'permissions'];
      const okN = p ? keys.filter((k) => p[k]).length : null;
      return `<div class="card tight"><div class="row between"><div class="grow"><h3>${esc(s.name)}</h3><a class="faint" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(hostOf(s.url))}</a></div>
        <button class="x" data-del-site="${esc(s.id)}" aria-label="Remove ${esc(s.name)}">&times;</button></div>
        <p class="status-line"><i class="led ${s.down_since ? 'off' : h ? 'on' : ''}"></i>${s.down_since ? `Down since ${ago(s.down_since)}` : h ? `Checked ${ago(s.health_checked_at)}` : 'Not checked yet'}${okN != null ? ` · ${okN}/6 protections` : ''}${h && h.frames_in_app === false ? ' · blocks preview' : ''}${h?.domain_expires ? ` · domain to ${dateUK(h.domain_expires)}` : ''}</p>
        <p class="faint">${s.gsc_property ? `Analytics: ${esc(s.gsc_property)}${s.analytics_error ? ` (error: ${esc(s.analytics_error)})` : s.analytics_synced_at ? `, synced ${ago(s.analytics_synced_at)}` : ''}` : 'Analytics not linked'}</p>
        <button class="btn ghost small mt8" data-check="${esc(s.id)}">Check now</button></div>`;
    }).join('') || '<p class="faint">No sites yet.</p>'}</div>
    <form class="card stack" id="sf"><div class="grid2"><input class="input" name="name" placeholder="Site name"><input class="input" name="url" placeholder="example.co.uk" required></div>
      <p class="error"></p><button class="btn ghost small" type="submit">Add site</button></form>

    <div class="section-title"><h2>Behind the scenes</h2></div>
    <form class="card stack" id="wf">
      <p class="faint">Log anything you've done for them that they'd otherwise never see. It shows on their Security page.</p>
      <div class="grid2"><select class="input" name="kind" aria-label="Type"><option value="update">Update</option><option value="security">Security</option><option value="backup">Backup</option><option value="speed">Speed</option><option value="other">Other</option></select>
        <select class="input" name="site_id" aria-label="Site"><option value="">All their sites</option>${d.sites.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></div>
      <input class="input" name="title" required placeholder="e.g. Updated the payment library to the latest version">
      <textarea class="input" name="body" placeholder="Optional detail, in plain English"></textarea>
      <label class="check"><input type="checkbox" name="notify" value="1"> Ping their phone</label>
      <p class="error"></p><button class="btn ghost small" type="submit">Add to their log</button>
    </form>

    <div class="section-title"><h2>Logins</h2></div>
    <div class="list">${d.users.map((u) => `<div class="card tight row between"><div class="grow"><h3>${esc(u.name)}</h3>
      <p class="faint">${esc(u.email)} · ${u.must_change_password ? 'Not set up yet' : u.last_login_at ? `Seen ${ago(u.last_login_at)}` : 'Set up'}</p></div>
      <button class="btn ghost small" data-reset="${esc(u.id)}">Reset</button></div>`).join('')}</div>
    <form class="card stack" id="uf"><h3>Add another person</h3><div class="grid2"><input class="input" name="name" placeholder="Name" required><input class="input" name="email" type="email" placeholder="Email" required></div>
      <p class="error"></p><button class="btn ghost small" type="submit">Create login</button></form>

    <div class="section-title"><h2>Requests</h2></div>
    <div class="list">${d.requests.map((r) => requestCard(r)).join('') || '<p class="faint">None yet.</p>'}</div>

    <div class="section-title"><h2>Billing</h2><a class="faint" href="#/invoices/new?client=${esc(c.id)}">New bill</a></div>
    <p class="faint">${c.monthly_fee_pence ? `${money(c.monthly_fee_pence)} a month${c.monthly_from ? `, from ${monthLabel(c.monthly_from)}` : ''}` : 'No monthly plan'}${c.pay_link ? ' · Own pay link' : ''}</p>
    <div class="list">${d.invoices.map((i) => invoiceCard(i)).join('') || '<p class="faint">No bills yet.</p>'}</div>

    <div class="section-title"><h2>Details</h2></div>
    <form class="card stack" id="ef">
      <div class="grid2"><div class="field"><label>Business name</label><input class="input" name="business_name" value="${esc(c.business_name)}"></div>
      <div class="field"><label>Contact name</label><input class="input" name="contact_name" value="${esc(c.contact_name)}"></div></div>
      <div class="grid2"><div class="field"><label>Phone</label><input class="input" name="phone" value="${esc(c.phone || '')}"></div>
      <div class="field"><label>Hourly rate (£)</label><input class="input" name="rate" type="number" step="0.5" min="0" value="${(c.hourly_rate_pence / 100).toFixed(2)}"></div></div>
      <div class="grid2"><div class="field"><label>Monthly plan (£)</label><input class="input" name="monthly" inputmode="decimal" value="${(c.monthly_fee_pence / 100).toFixed(2)}"></div>
      <div class="field"><label>Plan starts</label><input class="input" name="monthly_from" type="month" value="${esc(c.monthly_from || '')}"></div></div>
      <div class="field"><label>Their own pay link (optional)</label><input class="input" name="pay_link" value="${esc(c.pay_link || '')}" placeholder="Uses your default"></div>
      <div class="field"><label>Private notes</label><textarea class="input" name="notes">${esc(c.notes || '')}</textarea></div>
      <p class="error"></p><button class="btn small" type="submit">Save</button>
    </form>
    <button class="btn danger block" id="arch">${c.archived ? 'Restore client' : 'Archive client (blocks their login)'}</button>
  </div>`);

  onSubmit($('#sf'), async (v) => { await api(`/admin/clients/${id}/sites`, { method: 'POST', body: v }); toast('Site added'); route(); });
  onSubmit($('#wf'), async (v, form) => { await api('/admin/worklog', { method: 'POST', body: { ...v, client_id: id, notify: !!v.notify } }); toast('Added to their log'); form.reset(); });
  $$('[data-check]').forEach((b) => (b.onclick = async () => {
    b.disabled = true; b.textContent = 'Checking...';
    try { await api('/admin/checks', { method: 'POST', body: { site_id: b.dataset.check } }); toast('Checked'); route(); }
    catch (e) { toast(e.message, true); b.disabled = false; b.textContent = 'Check now'; }
  }));
  onSubmit($('#uf'), async (v) => {
    const r = await api(`/admin/clients/${id}/users`, { method: 'POST', body: v });
    state.lastLogins = [{ ...r.login, phone: c.phone }]; go('/send');
  });
  onSubmit($('#ef'), async (v) => {
    await api(`/admin/clients/${id}`, { method: 'PATCH', body: { business_name: v.business_name, contact_name: v.contact_name, phone: v.phone, notes: v.notes, hourly_rate_pence: Math.round(Number(v.rate) * 100), monthly_fee_pence: Math.round(Number(v.monthly || 0) * 100), monthly_from: v.monthly_from, pay_link: v.pay_link } });
    toast('Saved'); route();
  });
  $$('[data-del-site]').forEach((b) => (b.onclick = async () => {
    if (!confirm('Remove this site from their account?')) return;
    try { await api(`/admin/sites/${b.dataset.delSite}`, { method: 'DELETE' }); route(); } catch (e) { toast(e.message, true); }
  }));
  $$('[data-reset]').forEach((b) => (b.onclick = async () => {
    if (!confirm('Give them a new temporary password? Their current one stops working.')) return;
    try { const r = await api(`/admin/clients/${id}/reset-password`, { method: 'POST', body: { user_id: b.dataset.reset } }); state.lastLogins = [r.login]; go('/send'); }
    catch (e) { toast(e.message, true); }
  }));
  $('#arch').onclick = async () => {
    if (!c.archived && !confirm(`Archive ${c.business_name}? They won't be able to log in.`)) return;
    await api(`/admin/clients/${id}`, { method: 'PATCH', body: { archived: !c.archived } });
    toast(c.archived ? 'Restored' : 'Archived'); route();
  };
}

/* ---------- import ---------- */
// Pre-filled with everyone Jordan has built for. Fill in emails and missing addresses.
const IMPORT_SEED = [
  { business_name: 'Candymonium', monthly: '40', users: [{ name: 'Anthony', email: '' }], sites: [{ name: 'Candymonium', url: 'candymonium.co.uk' }] },
  { business_name: "Digz N' Lidz", monthly: '47', users: [{ name: 'Mark', email: '' }, { name: 'Danny', email: '' }], sites: [{ name: "Digz N' Lidz", url: 'digznlidz.co.uk' }] },
  { business_name: 'WATAG', monthly: '40', users: [{ name: 'Jay', email: '' }], sites: [{ name: 'WATAG', url: 'watagapp.co.uk' }] },
  { business_name: 'Rubies & Pearls', monthly: '20', users: [{ name: 'Ruby', email: '' }], sites: [{ name: 'Rubies & Pearls', url: 'www.rubiesandpearls.co.uk' }] },
  { business_name: 'Dougie Joyce', monthly: '50', users: [{ name: 'Dougie', email: '' }], sites: [
    { name: "Joyce's Irish Whiskey", url: 'www.jiwhiskey.co.uk' },
    { name: '3D Fight Club', url: 'www.3dfc.tv' },
    { name: 'Elite Force', url: 'eliteforce.site' }] },
  // Build starts 4 Nov, about 3 weeks, so the plan starts in December. Half the build now, half when live.
  { business_name: 'E. Bartlett', monthly: '40', from: '2026-12', build: '475', paid: '0', users: [{ name: '', email: '' }],
    sites: [{ name: 'Portaloo hire', url: '' }, { name: 'Exhibition', url: '' }] },
  { business_name: 'Growing with Chaos', on: false, users: [{ name: '', email: '' }], sites: [{ name: 'Growing with Chaos', url: '' }] }
];

function importView() {
  chrome('/clients', { wide: true });
  const rows = structuredClone(IMPORT_SEED).map((r) => ({ on: true, phone: '', ...r }));
  const draw = () => {
    render(`<div class="stack">
      <a class="faint" href="#/clients">&larr; Clients</a>
      <p class="eyebrow">Move everyone over</p>
      <h1>Import clients</h1>
      <p class="lede">Fill in each login email and any missing site addresses. Untick anyone not ready yet. Sites with no address are skipped, you can add them later.</p>
      <div class="list">${rows.map((r, i) => `<div class="card stack imp ${r.on ? '' : 'off'}" data-row="${i}">
        <div class="row"><label class="check"><input type="checkbox" data-k="on" ${r.on ? 'checked' : ''}></label>
          <input class="input grow" data-k="business_name" value="${esc(r.business_name)}" aria-label="Business name"></div>
        <div class="field"><span class="label">People who log in</span>
          ${r.users.map((u, j) => `<div class="mini-row"><input class="input" data-u="${j}" data-f="name" placeholder="Name" value="${esc(u.name)}">
            <input class="input" data-u="${j}" data-f="email" type="email" placeholder="Email" value="${esc(u.email)}">
            <button class="x" type="button" data-rm-u="${j}" aria-label="Remove person">&times;</button></div>`).join('')}
          <button class="linkish" type="button" data-add-u>+ Add person</button></div>
        <div class="field"><span class="label">Sites</span>
          ${r.sites.map((s, j) => `<div class="mini-row"><input class="input" data-s="${j}" data-f="name" placeholder="Site name" value="${esc(s.name)}">
            <input class="input" data-s="${j}" data-f="url" placeholder="address.co.uk" value="${esc(s.url)}">
            <button class="x" type="button" data-rm-s="${j}" aria-label="Remove site">&times;</button></div>`).join('')}
          <button class="linkish" type="button" data-add-s>+ Add site</button></div>
        <input class="input" data-k="phone" type="tel" placeholder="Phone for WhatsApp (optional)" value="${esc(r.phone)}">
        <div class="grid2"><div class="field"><span class="label">Monthly plan £</span><input class="input" data-k="monthly" inputmode="decimal" value="${esc(r.monthly || '')}" placeholder="0"></div>
          <div class="field"><span class="label">Plan starts</span><input class="input" data-k="from" type="month" value="${esc(r.from || '')}"></div></div>
        <div class="grid2"><div class="field"><span class="label">Build fee £ (if still owed)</span><input class="input" data-k="build" inputmode="decimal" value="${esc(r.build || '')}" placeholder="Leave blank if paid"></div>
          <div class="field"><span class="label">Already paid £</span><input class="input" data-k="paid" inputmode="decimal" value="${esc(r.paid || '')}" placeholder="0"></div></div>
        ${Number(r.build) > Number(r.paid || 0) && !Number(r.paid) ? `<p class="hint">A deposit bill for half (£${(Number(r.build) / 2).toFixed(2)}) is drafted, ready to send.</p>` : ''}
      </div>`).join('')}</div>
      <button class="btn ghost" id="addc" type="button">+ Add another client</button>
      <p class="error" id="ierr" role="alert"></p>
      <button class="btn neon block" id="go" type="button">Import ${rows.filter((r) => r.on).length} clients</button>
    </div>`);

    $$('[data-row]').forEach((card) => {
      const r = rows[card.dataset.row];
      card.addEventListener('input', (e) => {
        const t = e.target;
        if (t.dataset.k === 'on') { r.on = t.checked; draw(); return; }
        if (t.dataset.k) r[t.dataset.k] = t.value;
        if (t.dataset.u) r.users[t.dataset.u][t.dataset.f] = t.value;
        if (t.dataset.s) r.sites[t.dataset.s][t.dataset.f] = t.value;
      });
      card.addEventListener('change', (e) => { if (['build', 'paid'].includes(e.target.dataset.k)) draw(); });
      card.addEventListener('click', (e) => {
        const t = e.target;
        if ('addU' in t.dataset) { r.users.push({ name: '', email: '' }); draw(); }
        if ('addS' in t.dataset) { r.sites.push({ name: '', url: '' }); draw(); }
        if (t.dataset.rmU) { r.users.splice(Number(t.dataset.rmU), 1); draw(); }
        if (t.dataset.rmS) { r.sites.splice(Number(t.dataset.rmS), 1); draw(); }
      });
    });
    $('#addc').onclick = () => { rows.push({ business_name: '', users: [{ name: '', email: '' }], sites: [{ name: '', url: '' }], on: true, phone: '' }); draw(); };
    $('#go').onclick = async (e) => {
      const btn = e.currentTarget;
      const clients = rows.filter((r) => r.on).map((r) => ({
        business_name: r.business_name, phone: r.phone, monthly_fee_pence: Math.round(Number(r.monthly || 0) * 100), monthly_from: r.from || '',
        build_fee_pence: Math.round(Number(r.build || 0) * 100), build_paid_pence: Math.round(Number(r.paid || 0) * 100),
        users: r.users.filter((u) => u.name || u.email),
        sites: r.sites.filter((s) => s.url.trim())
      }));
      $('#ierr').textContent = '';
      btn.disabled = true;
      try {
        const res = await api('/admin/import', { method: 'POST', body: { clients } });
        state.lastLogins = res.logins;
        toast(`${res.created} clients imported`);
        go('/send');
      } catch (x) { $('#ierr').textContent = x.message; btn.disabled = false; }
    };
  };
  draw();
}

/* ---------- phone notifications ---------- */
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
function keyBytes(b64) {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
}
async function pushState() {
  if (!pushSupported()) return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.ready;
  return (await reg.pushManager.getSubscription()) ? 'on' : 'off';
}
async function enablePush() {
  const { key } = await api('/push/key');
  if (!key) throw new Error("Notifications aren't switched on yet. Jordan's on it.");
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Notifications were blocked. You can allow them in your phone settings.');
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
  await api('/push/subscribe', { method: 'POST', body: sub.toJSON() });
}
async function disablePush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await api('/push/subscribe', { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(() => {});
    await sub.unsubscribe();
  }
}
// Keeps this phone linked to whoever is logged in on it.
async function syncPush() {
  try {
    if (!pushSupported() || Notification.permission !== 'granted') return;
    const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if (sub) await api('/push/subscribe', { method: 'POST', body: sub.toJSON() });
  } catch {}
}

// Small card nudging people to switch notifications on. Fills itself in.
function pushNudge() {
  setTimeout(async () => {
    const el = $('#push-nudge');
    if (!el) return;
    let st;
    try { st = await pushState(); } catch { return; }
    if (st === 'off' && Notification.permission === 'default') {
      el.innerHTML = `<div class="card row">${I.bell.replace('<svg', '<svg class="bell"')}
        <div class="grow"><h3>Get a ping on your phone</h3><p class="faint">${state.user.role === 'admin' ? 'New requests, approvals and payments.' : 'When a quote is ready, work is done or a bill comes in.'}</p></div>
        <button class="btn small" id="push-on">Turn on</button></div>`;
      $('#push-on').onclick = async () => {
        try { await enablePush(); el.innerHTML = ''; toast('Notifications on'); } catch (e) { toast(e.message, true); }
      };
    } else if (st === 'needs-install') {
      el.innerHTML = `<div class="card row">${I.bell.replace('<svg', '<svg class="bell"')}<div class="grow"><h3>Want notifications?</h3>
        <p class="faint">Add this app to your home screen first (Share, then Add to Home Screen), then open it from there.</p></div></div>`;
    }
  }, 50);
  return '<div id="push-nudge"></div>';
}

/* ---------- billing: shared ---------- */
const INV_STATUS = { draft: 'Draft', sent: 'Due', paid: 'Paid', void: 'Cancelled' };
const dateUK = (d) => (d ? new Date(d.length === 10 ? d + 'T12:00:00Z' : d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
function invPill(i) {
  if (i.status === 'sent' && i.claimed_paid_at) return '<span class="pill approved">Payment on its way</span>';
  if (i.overdue) return '<span class="pill urgent">Overdue</span>';
  const cls = { draft: 'new', sent: 'quoted', paid: 'done', void: 'cancelled' }[i.status];
  return `<span class="pill ${cls}">${INV_STATUS[i.status]}</span>`;
}
function invoiceCard(i, showClient = false) {
  return `<a class="card tight" href="#/billing/${esc(i.id)}">
    <div class="row between"><h3 class="grow">${esc(i.title)}</h3><span class="mono">${money(i.total_pence)}</span></div>
    <div class="meta row wrap">${invPill(i)}${showClient ? `<span class="faint">${esc(i.business_name)}</span>` : ''}
      <span class="faint">${esc(i.ref)}</span>${i.status === 'sent' && i.due_date ? `<span class="faint">Due ${dateUK(i.due_date)}</span>` : ''}</div></a>`;
}

/* ---------- billing: client ---------- */
async function billingView() {
  chrome('/account');
  loading();
  const d = await api('/billing');
  const due = d.invoices.filter((i) => i.status === 'sent');
  const past = d.invoices.filter((i) => i.status !== 'sent');
  const pct = d.build ? Math.round((d.build.paid_pence / Math.max(1, d.build.total_pence)) * 100) : 0;
  render(`<div class="stack">
    <p class="eyebrow">Billing</p>
    <h1>${d.outstanding_pence ? `${money(d.outstanding_pence)} to pay` : 'All paid up.'}</h1>
    <p class="lede">${d.outstanding_pence ? 'Tap a bill to pay it with Revolut.' : 'Nothing owed. Thanks for keeping on top of it.'}</p>
    ${due.map((i) => `<a class="card night" href="#/billing/${esc(i.id)}">
      <p class="eyebrow">${i.claimed_paid_at ? 'Payment on its way' : i.overdue ? 'Overdue' : `Due ${dateUK(i.due_date)}`}</p>
      <div class="row between"><h2>${esc(i.title)}</h2><span class="price-sm">${money(i.total_pence)}</span></div>
      <span class="btn neon small">${i.claimed_paid_at ? 'View' : 'Pay now'}</span></a>`).join('')}
    <div class="stats">
      <div class="card stat"><b>${d.monthly_fee_pence ? money(d.monthly_fee_pence) : 'None'}</b><span>${d.monthly_from && d.monthly_from > new Date().toISOString().slice(0, 7) ? `Monthly plan from ${monthLabel(d.monthly_from)}` : 'Monthly plan'}</span></div>
      <div class="card stat"><b>${money(d.hourly_rate_pence)}</b><span>Per hour for changes</span></div>
      <div class="card stat"><b>${d.invoices.filter((i) => i.status === 'paid').length}</b><span>Bills paid</span></div>
    </div>
    ${d.build ? `<div class="card stack"><div class="row between"><h3>Your build</h3><span class="mono faint">${money(d.build.paid_pence)} of ${money(d.build.total_pence)}</span></div>
      <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i data-w="${pct}"></i></div>
      <p class="faint">${pct >= 100 ? 'Build fully paid. It is all yours.' : 'Paid off as each stage is billed.'}</p></div>` : ''}
    <div class="card"><h3>How billing works</h3><p class="muted">On the 1st of each month you get one bill with your monthly plan plus any changes finished the month before. Every change was quoted and approved by you first, so there are no surprises.</p></div>
    ${past.length ? `<div class="section-title"><h2>History</h2></div><div class="list">${past.map((i) => invoiceCard(i)).join('')}</div>` : ''}
  </div>`);
  $$('.bar i').forEach((b) => (b.style.width = `${Math.min(100, Number(b.dataset.w))}%`));
}

async function invoiceView(id) {
  const admin = state.user.role === 'admin';
  chrome(admin ? '/money' : '/account');
  loading();
  const { invoice: i } = await api(`/invoices/${id}`);
  const editable = admin && i.status === 'draft';
  let actions = '';
  if (!admin && i.status === 'sent') {
    actions = i.claimed_paid_at
      ? `<div class="card"><h3>Thanks, payment noted</h3><p class="muted">Jordan will tick it off once it lands. Nothing else to do.</p></div>`
      : `<div class="stack">
          ${i.pay_url ? `<a class="btn neon block" href="${esc(i.pay_url)}" target="_blank" rel="noopener">Pay ${money(i.total_pence)} with Revolut</a>` : ''}
          <button class="btn ghost block" data-claim>I've already paid</button>
          <p class="faint">Use <b>${esc(i.ref)}</b> as the reference so Jordan can match it up.</p></div>`;
  } else if (admin) {
    const a = [];
    if (i.status === 'draft') a.push('<button class="btn neon" data-act="send">Send to client</button>');
    if (i.status === 'sent' && i.claimed_paid_at) a.push('<button class="btn neon" data-act="paid">Confirm it arrived</button>', '<button class="btn ghost" data-act="not_received">Not arrived yet</button>');
    else if (i.status === 'sent') a.push('<button class="btn neon" data-act="paid">Mark as paid</button>');
    if (i.status === 'paid') a.push('<button class="btn ghost" data-act="unpaid">Reopen</button>');
    if (i.status === 'draft' || i.status === 'sent') a.push('<button class="btn danger" data-act="void">Cancel bill</button>');
    actions = `<div class="row wrap">${a.join('')}</div>`;
  }

  render(`<div class="stack">
    <a class="faint" href="#${admin ? '/money' : '/billing'}">&larr; Back</a>
    <div class="row wrap">${invPill(i)}<span class="faint">${esc(i.ref)}</span>${admin ? `<a class="faint" href="#/clients/${esc(i.client_id)}">${esc(i.business_name)}</a>` : ''}</div>
    <h1>${esc(i.title)}</h1>
    <div class="card invoice">
      ${editable ? `<form class="stack" id="ef">
        <div class="field"><label>Title</label><input class="input" name="title" value="${esc(i.title)}"></div>
        <div class="field"><span class="label">Lines</span><div id="lines" class="stack"></div><button class="linkish" type="button" id="addl">+ Add line</button></div>
        <div class="grid2"><div class="field"><label>Due date</label><input class="input" type="date" name="due_date" value="${esc(i.due_date || '')}"></div>
        <div class="field"><label>Pay link (blank = default)</label><input class="input" name="pay_link" value="${esc(i.pay_link || '')}" placeholder="https://revolut.me/..."></div></div>
        <div class="field"><label>Note to client</label><textarea class="input" name="note">${esc(i.note || '')}</textarea></div>
        <p class="error"></p><button class="btn small" type="submit">Save draft</button></form>`
      : `${i.lines.map((l) => `<div class="line"><span>${esc(l.description)}</span><span class="mono">${money(l.amount_pence)}</span></div>`).join('')}
        <div class="line total"><span>Total</span><span class="mono">${money(i.total_pence)}</span></div>
        ${i.note ? `<p class="muted">${esc(i.note)}</p>` : ''}
        <p class="faint">${i.status === 'paid' ? `Paid ${dateUK(i.paid_at)}` : i.due_date ? `Due ${dateUK(i.due_date)}` : ''}${i.sent_at ? ` · Sent ${dateUK(i.sent_at)}` : ''}</p>`}
    </div>
    ${actions}
    ${!admin ? '<p class="faint">Sidedoor Digital · 98 King Street, Southport PR8 0XX · Not VAT registered</p>' : ''}
  </div>`);

  if (editable) {
    const lines = i.lines.map((l) => ({ description: l.description, amount: (l.amount_pence / 100).toFixed(2) }));
    const drawLines = () => {
      $('#lines').innerHTML = lines.map((l, j) => `<div class="mini-row"><input class="input" data-j="${j}" data-f="description" value="${esc(l.description)}" placeholder="What for">
        <input class="input" data-j="${j}" data-f="amount" value="${esc(l.amount)}" inputmode="decimal" placeholder="£"><button class="x" type="button" data-rm="${j}" aria-label="Remove line">&times;</button></div>`).join('');
    };
    drawLines();
    $('#lines').addEventListener('input', (e) => { const t = e.target; if (t.dataset.j) lines[t.dataset.j][t.dataset.f] = t.value; });
    $('#lines').addEventListener('click', (e) => { if (e.target.dataset.rm) { lines.splice(Number(e.target.dataset.rm), 1); drawLines(); } });
    $('#addl').onclick = () => { lines.push({ description: '', amount: '' }); drawLines(); };
    onSubmit($('#ef'), async (v) => {
      await api(`/admin/invoices/${id}`, { method: 'PATCH', body: { action: 'edit', ...v,
        lines: lines.map((l) => ({ description: l.description, amount_pence: Math.round(Number(l.amount) * 100) })) } });
      toast('Draft saved'); route();
    });
  }
  $$('[data-act]').forEach((b) => (b.onclick = async () => {
    const act = b.dataset.act;
    if (act === 'void' && !confirm('Cancel this bill? Any change work on it goes back to be billed later.')) return;
    if (act === 'send' && editable && !confirm(`Send ${money(i.total_pence)} to ${i.business_name}? Save any edits first.`)) return;
    b.disabled = true;
    try {
      await api(`/admin/invoices/${id}`, { method: 'PATCH', body: { action: act } });
      toast({ send: 'Sent. Their phone will ping.', paid: 'Marked as paid', unpaid: 'Reopened', void: 'Cancelled', not_received: 'Back to unpaid' }[act]);
      route();
    } catch (e) { toast(e.message, true); b.disabled = false; }
  }));
  $('[data-claim]')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { await api(`/invoices/${id}/paid`, { method: 'POST', body: {} }); toast("Thanks! I'll confirm once it lands."); route(); }
    catch (x) { toast(x.message, true); e.target.disabled = false; }
  });
}

/* ---------- billing: admin ---------- */
async function moneyView() {
  chrome('/money');
  loading();
  const d = await api('/admin/billing');
  const section = (title, list, extra = '') => list.length ? `<div class="section-title"><h2>${title}</h2>${extra}</div><div class="list">${list.map((i) => invoiceCard(i, true)).join('')}</div>` : '';
  render(`<div class="stack">
    <p class="eyebrow">Money</p>
    <h1>${money(d.outstanding_pence)} owed</h1>
    <p class="lede">${money(d.paid_this_month_pence)} in so far this month.</p>
    ${!d.push_ready ? '<div class="card"><h3>Phone notifications are off</h3><p class="faint">Add the VAPID secrets in Cloudflare (see README) so clients get pinged when bills go out.</p></div>' : ''}
    ${!d.settings.default_pay_link ? '<div class="card night"><h3>Add your Revolut link</h3><p class="muted">Bills can\'t go out until there is a link to pay with. Settings are at the bottom.</p></div>' : ''}
    <div class="stats">
      <div class="card stat"><b>${money(d.monthly_recurring_pence)}</b><span>Monthly plans</span></div>
      <div class="card stat"><b>${d.drafts.length}</b><span>Ready to send</span></div>
      <div class="card stat"><b>${d.to_confirm.length}</b><span>To confirm</span></div>
    </div>
    ${d.drafts.length ? `<button class="btn neon block" id="sendall">Send all ${d.drafts.length} bill${d.drafts.length === 1 ? '' : 's'}</button>` : ''}
    <div class="row"><button class="btn ghost grow" id="run">Build ${esc(monthLabel(d.period))} bills now</button><a class="btn ghost" href="#/invoices/new">One-off bill</a></div>
    <p class="faint">This happens by itself on the 1st. Clients already billed for the month are skipped.</p>
    ${section('Say they have paid', d.to_confirm)}
    ${section('Ready to send', d.drafts)}
    ${section('Waiting on payment', d.unpaid)}
    ${section('Recently paid', d.recent_paid)}
    <div class="section-title"><h2>Settings</h2></div>
    <form class="card stack" id="sf">
      <div class="field"><label for="pl">Your Revolut link</label><input class="input" id="pl" name="default_pay_link" value="${esc(d.settings.default_pay_link)}" placeholder="https://revolut.me/yourname" inputmode="url">
        <span class="hint">If your link can take an amount, put {amount} where it goes and each bill fills it in. A client can have their own link on their page.</span></div>
      <label class="check"><input type="checkbox" name="auto_send" ${d.settings.auto_send ? 'checked' : ''}> Send bills automatically on the 1st (skip my check)</label>
      <div class="field"><label for="rr">Referral thank-you (shown to clients)</label><input class="input" id="rr" name="referral_reward" value="${esc(d.settings.referral_reward)}" placeholder="e.g. a month on me">
        <span class="hint">Finishes the line "If they come on board, ... as a thank you." Leave blank to not offer anything.</span></div>
      <p class="error"></p><button class="btn small" type="submit">Save settings</button>
    </form>
  </div>`);
  $('#sendall')?.addEventListener('click', async (e) => {
    if (!confirm(`Send ${d.drafts.length} bills now? Each client gets a notification.`)) return;
    e.target.disabled = true;
    try { const r = await api('/admin/billing/send-all', { method: 'POST', body: {} }); toast(r.failed.length ? r.failed[0] : `${r.sent.length} sent`, !!r.failed.length); route(); }
    catch (x) { toast(x.message, true); e.target.disabled = false; }
  });
  $('#run').onclick = async (e) => {
    e.target.disabled = true;
    try { const r = await api('/admin/billing/run', { method: 'POST', body: {} }); toast(r.created.length ? `${r.created.length} drafts made` : 'Nothing new to bill'); route(); }
    catch (x) { toast(x.message, true); e.target.disabled = false; }
  };
  onSubmit($('#sf'), async (v) => { await api('/admin/billing', { method: 'PATCH', body: { default_pay_link: v.default_pay_link, auto_send: !!v.auto_send, referral_reward: v.referral_reward } }); toast('Saved'); route(); });
}
function monthLabel(period) {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
}

async function newInvoiceView(query) {
  chrome('/money');
  loading();
  const { clients } = await api('/admin/clients');
  const pre = query.get('client') || '';
  const presets = [['Build deposit', 'build'], ['Build balance', 'build'], ['Domain renewal', 'other'], ['Extra work', 'other']];
  render(`<div class="stack">
    <a class="faint" href="#/money">&larr; Money</a>
    <p class="eyebrow">One-off bill</p>
    <h1>New bill</h1>
    <div class="chips" id="pre">${presets.map(([t, k]) => `<button type="button" class="chip" data-k="${k}">${t}</button>`).join('')}</div>
    <form class="stack" id="f" novalidate>
      <div class="field"><label for="c">Client</label><select class="input" id="c" name="client_id" required><option value="">Choose a client</option>
        ${clients.filter((c) => !c.archived).map((c) => `<option value="${esc(c.id)}" ${c.id === pre ? 'selected' : ''}>${esc(c.business_name)}</option>`).join('')}</select></div>
      <div class="grid2"><div class="field"><label for="t">Title</label><input class="input" id="t" name="title" required placeholder="Build deposit"></div>
      <div class="field"><label for="k">Type</label><select class="input" id="k" name="kind"><option value="build">Build fee</option><option value="other">Other</option></select></div></div>
      <div class="grid2"><div class="field"><label for="a">Amount (£)</label><input class="input" id="a" name="amount" inputmode="decimal" required></div>
      <div class="field"><label for="dd">Due date</label><input class="input" id="dd" name="due_date" type="date"></div></div>
      <div class="field"><label for="n">Note to client</label><textarea class="input" id="n" name="note" placeholder="Thanks for going with Sidedoor. Here's the deposit to get us started."></textarea></div>
      <p class="error"></p>
      <div class="grid2"><button class="btn neon" type="submit" name="go" value="send">Send now</button><button class="btn ghost" type="submit" name="go" value="draft">Save as draft</button></div>
    </form>
  </div>`);
  $$('#pre .chip').forEach((c) => (c.onclick = () => { $('#t').value = c.textContent; $('#k').value = c.dataset.k; $('#a').focus(); }));
  let mode = 'send';
  $$('button[name=go]').forEach((b) => b.addEventListener('click', () => (mode = b.value)));
  onSubmit($('#f'), async (v) => {
    const amount = Math.round(Number(String(v.amount).replace(/[£,\s]/g, '')) * 100);
    if (!amount) throw new Error('Pop in an amount');
    const { invoice } = await api('/admin/invoices', { method: 'POST', body: {
      client_id: v.client_id, kind: v.kind, title: v.title, note: v.note, due_date: v.due_date || null,
      lines: [{ description: v.title, amount_pence: amount }], send: mode === 'send'
    } });
    toast(mode === 'send' ? 'Sent' : 'Draft saved');
    go(`/billing/${invoice.id}`);
  });
}

/* ---------- insights: shared ---------- */
const nf = (n) => (n == null ? '-' : Number(n).toLocaleString('en-GB'));
const VERDICT = { not_affected: ['done', 'Not affected'], handled: ['approved', 'Handled'], action: ['urgent', 'One thing to do'] };
const LOG_KIND = { security: 'Security', update: 'Update', backup: 'Backup', speed: 'Speed', other: 'Work' };

function change(now, before, { lowerIsBetter = false } = {}) {
  if (before == null || now == null || !before) return '';
  const pct = Math.round(((now - before) / before) * 100);
  if (!pct) return '<span class="delta">Same as the 4 weeks before</span>';
  const good = lowerIsBetter ? pct < 0 : pct > 0;
  return `<span class="delta ${good ? 'up' : 'down'}">${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}% on the 4 weeks before</span>`;
}
function posChange(now, before) {
  if (before == null || now == null) return '';
  const d = Math.round((before - now) * 10) / 10;
  if (!d) return '<span class="delta">Same as the 4 weeks before</span>';
  return `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲ Up' : '▼ Down'} ${Math.abs(d)} places</span>`;
}

// A small single-series line, no axes. Decorative: the numbers sit next to it.
function sparkline(daily, key = 'clicks') {
  if (!daily?.length) return '';
  const W = 120, H = 34, max = Math.max(1, ...daily.map((d) => d[key]));
  const pts = daily.map((d, i) => [(i / Math.max(1, daily.length - 1)) * W, H - 3 - (d[key] / max) * (H - 6)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path class="spark-area" d="${line}L${W},${H}L0,${H}Z"/><path class="spark-line" d="${line}"/></svg>`;
}

// Full chart: one series, one axis, crosshair and tooltip on hover or touch.
function lineChart(el, daily, key, label) {
  const W = Math.max(280, el.clientWidth), H = 220, L = 38, R = 10, T = 14, B = 26;
  const max = Math.max(1, ...daily.map((d) => d[key]));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const x = (i) => L + (i / Math.max(1, daily.length - 1)) * (W - L - R);
  const y = (v) => T + (1 - v / top) * (H - T - B);
  const line = daily.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join('');
  const ticks = [0, top / 2, top];
  const fmtD = (s) => new Date(s + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const xl = [0, Math.floor((daily.length - 1) / 2), daily.length - 1];
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)} per day, ${esc(fmtD(daily[0].date))} to ${esc(fmtD(daily[daily.length - 1].date))}. Highest ${nf(max)}.">
      ${ticks.map((t) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${nf(Math.round(t))}</text>`).join('')}
      ${xl.map((i) => `<text class="axis" x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === daily.length - 1 ? 'end' : 'middle'}">${esc(fmtD(daily[i].date))}</text>`).join('')}
      <path class="chart-area" d="${line}L${x(daily.length - 1)},${y(0)}L${x(0)},${y(0)}Z"/>
      <path class="chart-line" d="${line}"/>
      <line class="cross" y1="${T}" y2="${H - B}" x1="0" x2="0" hidden/>
      <circle class="dot" r="4.5" cx="0" cy="0" hidden/>
      <rect class="hit" x="${L}" y="0" width="${W - L - R}" height="${H}"/>
    </svg><div class="tip" hidden></div>`;
  const svg = $('svg', el), tip = $('.tip', el), cross = $('.cross', el), dot = $('.dot', el);
  const show = (evt) => {
    const box = svg.getBoundingClientRect();
    const px = ((evt.clientX - box.left) / box.width) * W;
    const i = Math.max(0, Math.min(daily.length - 1, Math.round(((px - L) / (W - L - R)) * (daily.length - 1))));
    const d = daily[i];
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.hidden = false;
    dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(d[key])); dot.hidden = false;
    tip.hidden = false;
    tip.innerHTML = `<b>${nf(d[key])}</b> ${esc(label.toLowerCase())}<span>${esc(new Date(d.date + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }))}</span>`;
    const left = (x(i) / W) * box.width;
    tip.style.left = `${Math.min(Math.max(left, 60), box.width - 60)}px`;
  };
  const hide = () => { tip.hidden = true; cross.hidden = true; dot.hidden = true; };
  const hit = $('.hit', el);
  hit.addEventListener('pointermove', show);
  hit.addEventListener('pointerdown', show);
  hit.addEventListener('pointerleave', hide);
}

async function sitesForView(clientId) {
  if (state.user.role === 'admin') return (await api(`/admin/clients/${clientId}`)).sites;
  return (await api('/home')).sites;
}

/* ---------- client: my site hub ---------- */
async function siteHub(query) {
  const admin = state.user.role === 'admin';
  const clientId = query.get('client') || '';
  chrome(admin ? '/clients' : '/site');
  loading();
  const d = await api(`/insights${admin ? `?client=${encodeURIComponent(clientId)}` : ''}`);
  const q = admin ? `?client=${encodeURIComponent(clientId)}` : '';
  if (!d.health.length) return render(`<div class="stack">${admin ? `<a class="faint" href="#/clients/${esc(clientId)}">&larr; Client</a>` : ''}${emptyBlock(I.site, 'No site linked yet', 'Jordan will add it here.')}</div>`);
  const down = d.health.filter((h) => h.up_now === false);
  const protOk = d.health.reduce((t, h) => t + (h.protections_ok || 0), 0);
  const protTotal = d.health.filter((h) => h.protections).reduce((t, h) => t + h.protections_total, 0);

  render(`<div class="stack">
    ${admin ? `<a class="faint" href="#/clients/${esc(clientId)}">&larr; Client (you're seeing what they see)</a>` : ''}
    <p class="eyebrow">${d.health.length > 1 ? 'Your sites' : 'Your site'}</p>
    <h1>${down.length ? 'One thing needs a look.' : 'All looked after.'}</h1>
    <p class="lede">${down.length ? "Jordan's already been told and is on it." : 'Checked every 30 minutes, day and night. Here is what is going on behind the scenes.'}</p>

    <div class="list">${d.health.map((h) => `<div class="card site-card ${h.up_now === false ? 'lit' : ''}">
      <div class="row between"><div class="grow"><h2 class="site-title">${esc(hostOf(h.url))}</h2>
        <p class="status-line"><i class="led ${h.up_now === false ? 'off' : h.up_now ? 'on' : ''}"></i>${h.up_now === false ? 'Down right now' : h.up_now ? `Up${h.last_checked_at ? `, checked ${ago(h.last_checked_at)}` : ''}` : 'First check runs shortly'}</p></div></div>
      ${uptimeStrip(h.days)}
      ${speedBlock(h.speed)}
      <div class="row wrap mt16"><a class="btn small" href="#/view/${esc(h.site_id)}${q}">View live</a>${admin ? '' : `<a class="btn ghost small" href="#/requests/new?site=${esc(h.site_id)}">Change something</a>`}</div>
    </div>`).join('')}</div>

    <div class="stats">
      <div class="card stat"><b>${nf(d.checks_30d)}</b><span>Checks this month</span></div>
      <div class="card stat"><b>${protTotal ? `${protOk}/${protTotal}` : '-'}</b><span>Protections on</span></div>
      <div class="card stat"><b>${d.jobs_30d}</b><span>Jobs done this month</span></div>
    </div>

    <a class="card night" href="#/report${q}">
      <p class="eyebrow">Monthly report</p>
      <h2>Your month at a glance</h2>
      <p class="muted">Visits, checks, jobs done and everything behind the scenes, on one page you can save or print.</p>
      <span class="btn ghost on-night small">Open report</span>
    </a>

    <div class="section-title"><h2>Found on Google</h2></div>
    <div class="list">${d.analytics.map((a) => analyticsCard(a, q)).join('')}</div>

    <div class="section-title"><h2>Behind the scenes</h2><a class="faint" href="#/security${q}">Security and full log</a></div>
    <a class="card" href="#/security${q}">
      ${d.notes[0] ? `<div class="row between"><span class="eyebrow">Security news</span>${verdictPill(d.notes[0].verdict)}</div><h3 class="mt8">${esc(d.notes[0].title)}</h3>` : ''}
      ${d.log.length ? `<ul class="log ${d.notes[0] ? 'mt16' : ''}">${d.log.slice(0, 3).map(logItem).join('')}</ul>` : `<p class="muted">${d.notes[0] ? '' : 'Every check, update and fix shows up here.'}</p>`}
    </a>
  </div>`);
}

function verdictPill(v) {
  const [cls, label] = VERDICT[v] || VERDICT.not_affected;
  return `<span class="pill ${cls}">${label}</span>`;
}
function logItem(l) {
  return `<li><span class="log-kind">${esc(LOG_KIND[l.kind] || 'Work')}</span><span class="grow"><b>${esc(l.title)}</b>${l.body ? `<span class="log-body">${esc(l.body)}</span>` : ''}</span><span class="log-when">${ago(l.created_at)}</span></li>`;
}

function analyticsCard(a, q = '') {
  const head = `<div class="row between"><h3 class="grow">${esc(hostOf(a.url))}</h3></div>`;
  if (!a.has_data) {
    return `<div class="card">${head}<p class="muted mt8">${a.linked ? (a.error ? "Google hasn't let us in yet. Jordan's sorting it." : 'Connected. The first numbers land within a day.') : 'Being connected to Google Search Console. Numbers show here once it is.'}</p></div>`;
  }
  return `<a class="card" href="#/analytics/${esc(a.site_id)}${q}">
    ${head}
    <div class="row between mt8"><div><b class="big">${nf(a.now.clicks)}</b><span class="faint block">visits from Google, last 4 weeks</span>${change(a.now.clicks, a.before?.clicks)}</div>${sparkline(a.daily)}</div>
    <p class="faint mt8">Shown in searches ${nf(a.now.impressions)} times. Tap for what people searched.</p>
  </a>`;
}

/* ---------- site viewer (moved) ---------- */
async function siteViewer(id, query) {
  const admin = state.user.role === 'admin';
  const clientId = query.get('client') || '';
  chrome(admin ? '/clients' : '/site');
  loading();
  const sites = await sitesForView(clientId);
  if (!sites.length) return render(emptyBlock(I.site, 'No site linked yet', 'Jordan will add it here.'));
  const site = sites.find((s) => s.id === id) || sites[0];
  const q = admin ? `?client=${encodeURIComponent(clientId)}` : '';
  let mode = innerWidth < 700 ? 'phone' : 'desktop';
  render(`<div class="stack">
    <a class="faint" href="#/site${q}">&larr; ${sites.length > 1 ? 'Your sites' : 'Your site'}</a>
    <p class="eyebrow">Live site</p>
    <h1 class="site-title">${esc(hostOf(site.url))}</h1>
    ${sites.length > 1 ? `<div class="chips">${sites.map((s) => `<a class="chip" href="#/view/${esc(s.id)}${q}" aria-pressed="${s.id === site.id}">${esc(s.name)}</a>`).join('')}</div>` : ''}
    <div class="row between wrap">
      <div class="seg" role="group" aria-label="Device"><button data-m="phone">Phone</button><button data-m="desktop">Desktop</button></div>
      <div class="row"><a class="btn ghost small" href="${esc(site.url)}" target="_blank" rel="noopener">Open</a>
      ${admin ? '' : `<a class="btn small" href="#/requests/new?site=${esc(site.id)}">Change something</a>`}</div>
    </div>
    <div class="stage" id="stage"><div class="scaler" id="scaler"></div></div>
    <p class="faint">This is your real site, live right now. Scroll inside the frame to look around.</p>
  </div>`);
  const stage = $('#stage'), scaler = $('#scaler');
  function draw() {
    $$('.seg button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.m === mode));
    scaler.innerHTML = mode === 'phone'
      ? `<div class="device phone-frame"><div class="notch"></div><div class="screen"><iframe title="Phone view of ${esc(site.name)}" src="${esc(site.url)}" referrerpolicy="no-referrer"></iframe></div></div>`
      : `<div class="device desk-frame"><div class="bar"><span class="dots"><i></i><i></i><i></i></span><span class="addr">${esc(site.url)}</span></div><div class="screen"><iframe title="Desktop view of ${esc(site.name)}" src="${esc(site.url)}" referrerpolicy="no-referrer"></iframe></div></div>`;
    fit();
  }
  function fit() {
    const dev = $('.device', scaler);
    if (!dev) return;
    const w = dev.offsetWidth, h = dev.offsetHeight;
    const availH = mode === 'phone' ? Math.max(420, innerHeight - 330) : Infinity;
    const k = Math.min(1, (stage.clientWidth - 36) / w, availH / h);
    dev.style.transform = `scale(${k})`;
    scaler.style.width = `${w * k}px`;
    scaler.style.height = `${h * k}px`;
  }
  $$('.seg button').forEach((b) => (b.onclick = () => { mode = b.dataset.m; draw(); }));
  draw();
  const onResize = () => fit();
  addEventListener('resize', onResize);
  cleanup = () => removeEventListener('resize', onResize);
}

/* ---------- analytics detail ---------- */
async function analyticsView(siteId, query) {
  const admin = state.user.role === 'admin';
  const q = admin && query.get('client') ? `?client=${encodeURIComponent(query.get('client'))}` : '';
  chrome(admin ? '/clients' : '/site');
  loading();
  const a = await api(`/analytics/${siteId}`);
  if (!a.has_data) return render(`<div class="stack"><a class="faint" href="#/site${q}">&larr; Back</a>${emptyBlock(I.site, 'No numbers yet', 'Once Google Search Console is connected, this fills in by itself.')}</div>`);
  let metric = 'clicks';
  const table = (rows, kind) => rows.length ? `<table class="data"><thead><tr><th>${kind === 'query' ? 'What they searched' : 'Page'}</th><th>Visits</th><th>Shown</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td>${esc(kind === 'page' ? (r.key.replace(/^https?:\/\/[^/]+/, '') || '/') : r.key)}</td><td>${nf(r.clicks)}</td><td>${nf(r.impressions)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="faint">Not enough searches yet. Google hides rare searches to protect people\'s privacy.</p>';
  render(`<div class="stack">
    <a class="faint" href="#/site${q}">&larr; Back</a>
    <p class="eyebrow">Google Search | last 4 weeks</p>
    <h1 class="site-title">${esc(hostOf(a.site.url))}</h1>
    <div class="stats">
      <div class="card stat"><b>${nf(a.now.clicks)}</b><span>Visits from Google</span>${change(a.now.clicks, a.before?.clicks)}</div>
      <div class="card stat"><b>${nf(a.now.impressions)}</b><span>Times shown</span>${change(a.now.impressions, a.before?.impressions)}</div>
      <div class="card stat"><b>${a.now.position ?? '-'}</b><span>Average place</span>${posChange(a.now.position, a.before?.position)}</div>
    </div>
    ${opportunitiesBlock(a.opportunities, a.site.id)}
    <div class="card">
      <div class="row between wrap"><h3>Day by day</h3><div class="seg" role="group" aria-label="Show"><button data-k="clicks" aria-pressed="true">Visits</button><button data-k="impressions">Shown</button></div></div>
      <div class="chart" id="chart"></div>
    </div>
    <div class="section-title"><h2>What people searched</h2></div>
    <div class="card">${table(a.queries, 'query')}</div>
    ${newSearchesBlock(a.new_queries)}
    <div class="section-title"><h2>Pages they landed on</h2></div>
    <div class="card">${table(a.pages, 'page')}</div>
    ${devicesBlock(a.devices)}
    <div class="card">
      <h3>What these mean</h3>
      <p class="muted"><b>Visits</b> are people who clicked through to your site from Google. <b>Shown</b> is how many times your site appeared in someone's results. <b>Average place</b> is where you usually sit, 1 is the top spot.</p>
      <p class="faint">Google's numbers run about two days behind. Updated ${a.synced_at ? ago(a.synced_at) : 'daily'}.</p>
    </div>
  </div>`);
  const draw = () => lineChart($('#chart'), a.daily, metric, metric === 'clicks' ? 'Visits' : 'Times shown');
  $$('.seg button').forEach((b) => (b.onclick = () => { metric = b.dataset.k; $$('.seg button').forEach((x) => x.setAttribute('aria-pressed', x === b)); draw(); }));
  draw();
  const onResize = () => draw();
  addEventListener('resize', onResize);
  cleanup = () => removeEventListener('resize', onResize);
}

/* ---------- security and the full log ---------- */
async function securityView(query) {
  const admin = state.user.role === 'admin';
  const clientId = query.get('client') || '';
  const q = admin ? `?client=${encodeURIComponent(clientId)}` : '';
  chrome(admin ? '/clients' : '/site');
  loading();
  const d = await api(`/insights${q}`);
  render(`<div class="stack">
    <a class="faint" href="#/site${q}">&larr; Back</a>
    <p class="eyebrow">Security</p>
    <h1>Locked up properly.</h1>
    <p class="lede">What's protecting your site, what Jordan's keeping an eye on, and everything done behind the scenes.</p>
    ${d.health.map((h) => `<div class="card">
      <div class="row between"><h3 class="grow site-title">${esc(hostOf(h.url))}</h3>${h.protections ? `<span class="mono">${h.protections_ok}/${h.protections_total}</span>` : ''}</div>
      ${h.protections ? `<ul class="checks">${h.protections.map((p) => `<li class="${p.ok ? 'ok' : 'todo'}"><i aria-hidden="true">${p.ok ? '✓' : '○'}</i><span><b>${esc(p.label)}</b>${p.ok ? '' : ' <span class="pill plain">Being added</span>'}<span class="faint block">${esc(p.why)}</span></span><span class="sr-only">${p.ok ? 'On' : 'Being added'}</span></li>`).join('')}</ul>`
        : '<p class="muted mt8">The first full check runs tonight.</p>'}
      ${uptimeStrip(h.days) ? `<p class="label mt16">Last 30 days</p>${uptimeStrip(h.days)}` : ''}
      ${speedBlock(h.speed) ? `<div class="mt16">${speedBlock(h.speed)}</div>` : ''}
      <dl class="facts">
        <div><dt>Up time, last 30 days</dt><dd>${h.uptime_30d != null ? `${h.uptime_30d}%` : 'Measuring, give it a day'}</dd></div>
        <div><dt>Speed</dt><dd>${h.avg_ms ? `${(h.avg_ms / 1000).toFixed(2)}s to respond` : '-'}</dd></div>
        <div><dt>Padlock certificate</dt><dd>${h.cert_expires ? `Renews automatically. Current one runs to ${dateUK(h.cert_expires)}` : 'Renews automatically'}</dd></div>
        <div><dt>Domain name</dt><dd>${h.domain_expires ? `Paid up to ${dateUK(h.domain_expires)}` : 'Checked daily'}</dd></div>
      </dl>
      ${admin && h.protections && !h.csp_scripts ? '<p class="faint mt8">Admin only: no script-locking policy yet.</p>' : ''}
    </div>`).join('')}

    <div class="section-title"><h2>Security news</h2></div>
    <div class="list">${d.notes.length ? d.notes.map((n) => `<div class="card">
      <div class="row between wrap"><span class="faint">${dateUK(n.created_at)}</span>${verdictPill(n.verdict)}</div>
      <h3 class="mt8">${esc(n.title)}</h3><p class="muted mt8 pre">${esc(n.body)}</p></div>`).join('')
      : '<div class="card"><p class="muted">When a scam or threat is doing the rounds, Jordan explains it here and says whether it touches your site.</p></div>'}</div>

    <div class="section-title"><h2>What's been done</h2></div>
    <div class="card">${d.log.length ? `<ul class="log">${d.log.map(logItem).join('')}</ul>` : '<p class="muted">Updates, backups and fixes show up here as they happen.</p>'}</div>
  </div>`);
}

/* ---------- ideas ---------- */
function ideaCard(i, rate, opts = {}) {
  const price = Math.round((i.minutes / 60) * rate);
  const kind = i.kind === 'security' ? 'Security' : i.kind === 'growth' ? 'Idea' : 'For this time of year';
  if (i.action === 'requested') {
    return `<a class="card tight" href="#/requests/${esc(i.request_id)}"><p class="eyebrow">${kind}</p><h3 class="mt8">${esc(i.title)}</h3><p class="faint mt8">On its way. Tap to follow it.</p></a>`;
  }
  return `<div class="card idea ${opts.lit ? 'lit' : ''}" data-idea="${esc(i.id)}">
    <p class="eyebrow">${kind}</p>
    <h3 class="mt8">${esc(i.title)}</h3>
    <p class="muted mt8">${esc(i.pitch)}</p>
    <p class="mono mt8">${duration(i.minutes)} · ${money(price)}</p>
    <div class="row wrap mt16"><button class="btn neon small" data-go="${esc(i.id)}">Go ahead for ${money(price)}</button><button class="linkish" data-skip="${esc(i.id)}">Not now</button></div>
  </div>`;
}

function wireIdeas(root, ideas, rate) {
  $$('[data-go]', root).forEach((b) => (b.onclick = async () => {
    const i = ideas.find((x) => x.id === b.dataset.go);
    const price = money(Math.round((i.minutes / 60) * rate));
    if (!confirm(`Go ahead with "${i.title}" for ${price}? Jordan gets started and you'll never pay more than this.`)) return;
    b.disabled = true;
    try {
      const r = await api(`/ideas/${i.id}`, { method: 'POST', body: { action: 'go' } });
      toast("Done. Jordan's been told.");
      go(`/requests/${r.request_id}`);
    } catch (e) { toast(e.message, true); b.disabled = false; }
  }));
  $$('[data-skip]', root).forEach((b) => (b.onclick = async () => {
    try {
      await api(`/ideas/${b.dataset.skip}`, { method: 'POST', body: { action: 'dismiss' } });
      b.closest('.idea').remove();
      toast("No problem, it won't come up again this year.");
    } catch (e) { toast(e.message, true); }
  }));
}

async function ideasView() {
  chrome('/requests');
  loading();
  const [{ ideas: now }, { ideas: all }] = await Promise.all([api('/ideas'), api('/ideas?all=1')]);
  const rate = state.client?.hourly_rate_pence ?? 1500;
  const later = all.filter((i) => !i.in_season && i.action !== 'requested');
  render(`<div class="stack">
    <a class="faint" href="#/requests">&larr; Requests</a>
    <p class="eyebrow">Ideas</p>
    <h1>Things worth doing.</h1>
    <p class="lede">Picked for your site and the time of year. Tap go ahead and it's approved at the price shown, nothing more.</p>
    <div class="list" id="now">${now.length ? now.map((i) => ideaCard(i, rate)).join('') : emptyBlock(I.req, 'Nothing right now', 'New ideas show up as the seasons change.')}</div>
    ${later.length ? `<div class="section-title"><h2>Later in the year</h2></div><div class="list">${later.map((i) => `<div class="card tight"><h3>${esc(i.title)}</h3><p class="faint mt8">From ${esc(seasonLabel(i.starts))}</p></div>`).join('')}</div>` : ''}
  </div>`);
  wireIdeas($('#now'), now, rate);
}
function seasonLabel(mmdd) {
  if (!mmdd) return 'any time';
  const [m, d] = mmdd.split('-').map(Number);
  return new Date(Date.UTC(2026, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

/* ---------- admin: Search Console, ideas, notes ---------- */
async function gscView() {
  chrome('/');
  loading();
  const d = await api('/admin/gsc');
  render(`<div class="stack">
    <a class="faint" href="#/">&larr; Today</a>
    <p class="eyebrow">Google Search Console</p>
    <h1>Analytics</h1>
    ${!d.configured ? `<div class="card night"><h3>Not connected yet</h3><p class="muted">Add GSC_CLIENT_EMAIL and GSC_PRIVATE_KEY as secrets in Cloudflare, then redeploy. The README has the steps.</p></div>` : `
    <div class="card"><span class="label">Service account</span><p class="mono mt8 break">${esc(d.service_account)}</p>
      <p class="faint mt8">Add this email as a Restricted user on each property in Search Console.</p></div>
    ${d.error ? `<div class="card lit"><p class="error">${esc(d.error)}</p></div>` : ''}
    <p class="muted">${d.properties.length} propert${d.properties.length === 1 ? 'y' : 'ies'} shared with it.</p>
    <button class="btn neon block" id="link">Link sites and pull numbers now</button>`}
    <div class="list">${d.sites.map((s) => `<div class="card tight"><div class="row between"><div class="grow"><h3>${esc(s.name)}</h3><p class="faint">${esc(s.business_name)} · ${esc(hostOf(s.url))}</p></div></div>
      <p class="faint mt8">${s.gsc_property ? `Linked: <span class="mono">${esc(s.gsc_property)}</span>` : 'Not linked'}${s.analytics_synced_at ? ` · synced ${ago(s.analytics_synced_at)}` : ''}</p>
      ${s.analytics_error ? `<p class="error">${esc(s.analytics_error)}</p>` : ''}</div>`).join('')}</div>
  </div>`);
  $('#link')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      const r = await api('/admin/gsc', { method: 'POST', body: {} });
      toast(`${r.linked.length} linked, ${r.synced.length} synced${r.unmatched.length ? `, ${r.unmatched.length} without a property` : ''}`, !!r.failed.length);
      route();
    } catch (x) { toast(x.message, true); e.target.disabled = false; }
  });
}

async function adminIdeasView() {
  chrome('/');
  loading();
  const [{ ideas }, { clients }] = await Promise.all([api('/admin/ideas'), api('/admin/clients')]);
  const who = (i) => i.business_name || (i.match_host ? i.match_host : 'Everyone');
  render(`<div class="stack">
    <a class="faint" href="#/">&larr; Today</a>
    <p class="eyebrow">Ideas</p>
    <h1>Ideas library</h1>
    <p class="lede">Clients see these when they're in season and match their site. One tap and it's an approved job.</p>
    <details class="card"><summary class="label">Add an idea</summary>
      <form class="stack mt16" id="f" novalidate>
        <div class="field"><label>Title</label><input class="input" name="title" required></div>
        <div class="field"><label>The pitch, in your words</label><textarea class="input" name="pitch" required></textarea></div>
        <div class="grid2"><div class="field"><label>Minutes</label><input class="input" name="minutes" inputmode="numeric" value="60"></div>
          <div class="field"><label>Type</label><select class="input" name="kind"><option value="seasonal">Seasonal</option><option value="growth">Growth</option><option value="security">Security</option></select></div></div>
        <div class="grid2"><div class="field"><label>Shows from (MM-DD, blank = always)</label><input class="input" name="starts" placeholder="11-01"></div>
          <div class="field"><label>Until (MM-DD)</label><input class="input" name="ends" placeholder="12-20"></div></div>
        <div class="grid2"><div class="field"><label>For sites on (domain)</label><input class="input" name="match_host" placeholder="Blank = every client"></div>
          <div class="field"><label>Or one client</label><select class="input" name="client_id"><option value="">Not just one</option>${clients.filter((c) => !c.archived).map((c) => `<option value="${esc(c.id)}">${esc(c.business_name)}</option>`).join('')}</select></div></div>
        <p class="error"></p><button class="btn neon" type="submit">Add idea</button>
      </form></details>
    <div class="list">${ideas.map((i) => `<div class="card tight ${i.active ? '' : 'dim'}">
      <div class="row between"><h3 class="grow">${esc(i.title)}</h3><span class="mono">${duration(i.minutes)}</span></div>
      <div class="meta"><span class="pill plain">${esc(who(i))}</span><span class="faint">${i.starts ? `${esc(seasonLabel(i.starts))} to ${esc(seasonLabel(i.ends))}` : 'Any time'}</span>
        ${i.taken ? `<span class="pill done">${i.taken} said yes</span>` : ''}${i.passed ? `<span class="faint">${i.passed} passed</span>` : ''}</div>
      <div class="row mt8"><button class="linkish" data-toggle="${esc(i.id)}" data-on="${i.active ? 0 : 1}">${i.active ? 'Switch off' : 'Switch on'}</button></div>
    </div>`).join('')}</div>
  </div>`);
  onSubmit($('#f'), async (v) => { await api('/admin/ideas', { method: 'POST', body: v }); toast('Idea added'); route(); });
  $$('[data-toggle]').forEach((b) => (b.onclick = async () => {
    const i = ideas.find((x) => x.id === b.dataset.toggle);
    try { await api('/admin/ideas', { method: 'PATCH', body: { ...i, active: b.dataset.on === '1' } }); route(); } catch (e) { toast(e.message, true); }
  }));
}

async function adminNotesView() {
  chrome('/');
  loading();
  const [{ notes }, { clients }] = await Promise.all([api('/admin/notes'), api('/admin/clients')]);
  render(`<div class="stack">
    <a class="faint" href="#/">&larr; Today</a>
    <p class="eyebrow">Security news</p>
    <h1>Tell them what's out there</h1>
    <p class="lede">A scam doing the rounds, a big hack in the news, a fake renewal email. Explain it plainly and say what it means for them.</p>
    <form class="card stack" id="f" novalidate>
      <div class="field"><label>Title</label><input class="input" name="title" required placeholder="Fake domain renewal emails"></div>
      <div class="field"><label>What it is and what to do</label><textarea class="input" name="body" required placeholder="You might get an email saying your domain is about to expire..."></textarea></div>
      <div class="grid2"><div class="field"><label>For them, this is</label><select class="input" name="verdict"><option value="not_affected">Not affected</option><option value="handled">Handled by Jordan</option><option value="action">One thing to do</option></select></div>
        <div class="field"><label>Who sees it</label><select class="input" name="client_id"><option value="">Every client</option>${clients.filter((c) => !c.archived).map((c) => `<option value="${esc(c.id)}">${esc(c.business_name)}</option>`).join('')}</select></div></div>
      <label class="check"><input type="checkbox" name="notify" value="1"> Ping their phones</label>
      <p class="error"></p><button class="btn neon" type="submit">Post it</button>
    </form>
    <div class="list">${notes.map((n) => `<div class="card tight"><div class="row between wrap">${verdictPill(n.verdict)}<span class="faint">${esc(n.business_name || 'Everyone')} · ${dateUK(n.created_at)}</span></div>
      <h3 class="mt8">${esc(n.title)}</h3><p class="muted mt8 pre">${esc(n.body)}</p><button class="linkish" data-del="${esc(n.id)}">Delete</button></div>`).join('')}</div>
  </div>`);
  onSubmit($('#f'), async (v) => { v.notify = !!v.notify; await api('/admin/notes', { method: 'POST', body: v }); toast('Posted'); route(); });
  $$('[data-del]').forEach((b) => (b.onclick = async () => {
    if (!confirm('Delete this note?')) return;
    await api(`/admin/notes?id=${encodeURIComponent(b.dataset.del)}`, { method: 'DELETE' }); route();
  }));
}

/* ---------- stage 4: uptime strip, speed, opportunities ---------- */
function uptimeStrip(days) {
  if (!days?.length || !days.some((d) => d.n)) return '';
  const cls = (d) => (!d.n ? 'none' : d.pct >= 99.5 ? 'good' : d.pct >= 95 ? 'blip' : 'bad');
  const label = (d) => `${new Date(d.day + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}: ${d.n ? `${d.pct}% up, ${d.n} checks` : 'no checks yet'}`;
  return `<div class="strip" role="img" aria-label="Up time for each of the last 30 days">${days.map((d) => `<i class="${cls(d)}" title="${esc(label(d))}"></i>`).join('')}</div>
    <div class="strip-key"><span>30 days ago</span><span>Today</span></div>`;
}

function speedBlock(sp) {
  if (!sp || sp.score == null) return '';
  const grade = sp.score >= 90 ? ['good', 'Fast'] : sp.score >= 50 ? ['blip', 'OK'] : ['bad', 'Slow'];
  const s = (ms) => (ms == null ? '-' : `${(ms / 1000).toFixed(1)}s`);
  return `<div class="speed">
    <div class="gauge ${grade[0]}" role="img" aria-label="Speed score ${sp.score} out of 100"><svg viewBox="0 0 36 36"><circle class="track" cx="18" cy="18" r="15.9"/><circle class="val" cx="18" cy="18" r="15.9" stroke-dasharray="${sp.score} 100"/></svg><b>${sp.score}</b></div>
    <div class="grow"><b class="speed-head">${grade[1]} on phones</b>
      <span class="faint block">Main content shows in ${s(sp.lcp_ms)}${sp.weight_kb ? `, page weighs ${sp.weight_kb > 1024 ? `${(sp.weight_kb / 1024).toFixed(1)}MB` : `${sp.weight_kb}KB`}` : ''}.</span>
      <span class="faint block">Google's own test, run weekly. Over 90 is great.</span></div>
  </div>`;
}

function opportunitiesBlock(list, siteId) {
  if (!list?.length) return '';
  return `<div class="card night">
    <p class="eyebrow">Within reach</p>
    <h2>Searches you nearly win</h2>
    <p class="muted">You already show up for these, just not near the top. Most clicks go to the first three results.</p>
    <ul class="opps">${list.map((o) => `<li>
      <div class="row between"><b>"${esc(o.key)}"</b><span class="mono">#${Math.round(o.position)}</span></div>
      <span class="faint block">Shown ${nf(o.impressions)} times in 4 weeks. In the top 3 that's roughly ${nf(o.potential)} more visits a month.</span>
      ${state.user.role === 'client' ? `<a class="linkish" href="#/requests/new?site=${esc(siteId)}&title=${encodeURIComponent(`Help me rank for "${o.key}"`)}">Ask Jordan about this</a>` : ''}
    </li>`).join('')}</ul>
    <p class="faint">Estimates use a cautious 10% click rate for a top 3 spot.</p>
  </div>`;
}

function devicesBlock(devices) {
  if (!devices?.length) return '';
  const names = { mobile: 'Phones', desktop: 'Computers', tablet: 'Tablets' };
  const phone = devices.find((d) => d.key === 'mobile');
  return `<div class="card">
    <h3>What they search on</h3>
    <ul class="bars mt16">${devices.map((d) => `<li><span class="bar-label">${esc(names[d.key] || d.key)}</span><span class="bar-track"><i data-w="${d.share}"></i></span><span class="mono">${d.share}%</span></li>`).join('')}</ul>
    ${phone && phone.share >= 60 ? `<p class="faint mt16">${phone.share}% of your Google visitors are on a phone, so that's the version that matters most.</p>` : ''}
  </div>`;
}

function newSearchesBlock(list) {
  if (!list?.length) return '';
  return `<div class="card"><h3>New searches finding you</h3><p class="faint">Not in your top searches the month before.</p>
    <ul class="tags mt16">${list.map((q) => `<li>${esc(q.key)}</li>`).join('')}</ul></div>`;
}

/* ---------- monthly report ---------- */
async function reportView(query) {
  const admin = state.user.role === 'admin';
  const clientId = query.get('client') || '';
  const q = (extra = {}) => {
    const p = new URLSearchParams(extra);
    if (admin) p.set('client', clientId);
    const s = p.toString();
    return s ? `?${s}` : '';
  };
  chrome(admin ? '/clients' : '/site');
  loading();
  const { report: r, periods } = await api(`/report${q(query.get('period') ? { period: query.get('period') } : {})}`);
  const t = r.totals;
  const kindLabel = { security: 'Security', update: 'Update', backup: 'Backup', speed: 'Speed', other: 'Work' };
  render(`<article class="report stack">
    <div class="no-print row between wrap"><a class="faint" href="#/site${admin ? `?client=${esc(clientId)}` : ''}">&larr; Back</a><button class="btn ghost small" id="print">Save as PDF</button></div>
    ${periods.length > 1 ? `<div class="chips no-print">${periods.map((p) => `<a class="chip" href="#/report${q({ period: p.period })}" aria-pressed="${p.period === r.period}">${esc(p.label)}</a>`).join('')}</div>` : ''}
    <header class="report-head">
      <img class="report-mark" src="/assets/art/door-mark.webp" alt="" width="40" height="50">
      <p class="eyebrow">Monthly report | ${esc(r.label)}</p>
      <h1>${esc(r.business_name)}</h1>
      <p class="lede">Here's your month, ${esc(firstName(r.contact_name))}. Everything that happened on your site${r.sites.length > 1 ? 's' : ''}, including the bits you never see.</p>
    </header>

    <div class="stats four">
      <div class="card stat"><b>${t.clicks != null ? nf(t.clicks) : '-'}</b><span>Visits from Google</span>${t.clicks != null ? change(t.clicks, t.clicks_prev).replace('4 weeks', 'month') : ''}</div>
      <div class="card stat"><b>${nf(t.checks)}</b><span>Health checks</span></div>
      <div class="card stat"><b>${t.jobs}</b><span>Jobs done</span></div>
      <div class="card stat"><b>${t.log}</b><span>Behind the scenes</span></div>
    </div>

    ${r.sites.map((s) => `<section class="card">
      <h2 class="site-title">${esc(hostOf(s.url))}</h2>
      <dl class="facts">
        <div><dt>Up time</dt><dd>${s.uptime != null ? `${s.uptime}%${s.downtime_mins ? `, about ${s.downtime_mins} minutes down in total` : ', not a single miss'}` : 'Monitoring started this month'}</dd></div>
        <div><dt>Visits from Google</dt><dd>${s.google ? `${nf(s.google.clicks)}${s.google.prev ? ` (${nf(s.google.prev.clicks)} the month before)` : ''}${s.google.full ? '' : ', part month'}` : 'Being connected'}</dd></div>
        <div><dt>Shown in searches</dt><dd>${s.google ? `${nf(s.google.impressions)} times` : '-'}</dd></div>
        <div><dt>Speed on phones</dt><dd>${s.speed ? `${s.speed.score}/100` : 'First test this week'}</dd></div>
        <div><dt>Protections</dt><dd>${s.protections_ok != null ? `${s.protections_ok} of ${s.protections_total} on` : 'Checked daily'}</dd></div>
        ${s.domain_expires ? `<div><dt>Domain</dt><dd>Paid up to ${dateUK(s.domain_expires)}</dd></div>` : ''}
      </dl>
      ${s.top_searches.length ? `<p class="label mt16">Top searches</p><ul class="tags mt8">${s.top_searches.map((x) => `<li>${esc(x.key)}</li>`).join('')}</ul>` : ''}
    </section>`).join('')}

    <section class="card">
      <h2>Jobs done</h2>
      ${r.jobs.length ? `<ul class="log mt16">${r.jobs.map((j) => `<li><span class="log-kind">${dateUK(j.completed_at).replace(/ \d{4}$/, '')}</span><span class="grow"><b>${esc(j.title)}</b></span><span class="log-when">${j.logged_minutes ? duration(j.logged_minutes) : 'Free'}</span></li>`).join('')}</ul>`
        : '<p class="muted mt8">No changes asked for this month. Your site just got on with it.</p>'}
    </section>

    <section class="card">
      <h2>Behind the scenes</h2>
      ${r.log.length ? `<ul class="log mt16">${r.log.map((l) => `<li><span class="log-kind">${esc(kindLabel[l.kind] || 'Work')}</span><span class="grow"><b>${esc(l.title)}</b>${l.body ? `<span class="log-body">${esc(l.body)}</span>` : ''}</span></li>`).join('')}</ul>`
        : '<p class="muted mt8">Checks ran every 30 minutes all month.</p>'}
      ${r.notes.length ? `<p class="label mt16">Security news this month</p><ul class="log mt8">${r.notes.map((n) => `<li><span class="grow"><b>${esc(n.title)}</b></span>${verdictPill(n.verdict)}</li>`).join('')}</ul>` : ''}
    </section>

    <section class="card night report-close">
      <p class="eyebrow">From Jordan</p>
      <p class="muted">Thanks for being with Sidedoor. If there's anything you want changed, added or looked at, it's one tap away in the app.</p>
      <p class="sig">Jordan</p>
      ${admin ? '' : '<a class="btn neon small no-print" href="#/refer">Know a business that needs this?</a>'}
    </section>
    <p class="faint report-foot">Sidedoor Digital · 98 King Street, Southport · getsidedoor.co.uk</p>
  </article>`);
  $('#print').onclick = () => window.print();
}

/* ---------- refer a business ---------- */
async function referView() {
  chrome('/account');
  loading();
  const { referrals, reward, passed, won } = await api('/referrals');
  const shareText = `I use Sidedoor Digital for my website and app. Jordan builds everything and looks after it properly. Worth a chat: https://getsidedoor.co.uk/?ref=${encodeURIComponent((state.client?.business_name || 'client').toLowerCase().replace(/[^a-z0-9]+/g, '-'))}`;
  const STATUS = { new: 'Passed to Jordan', contacted: 'Jordan has been in touch', won: 'Now a Sidedoor client', not_now: 'Not right now' };
  render(`<div class="stack">
    <a class="faint" href="#/account">&larr; Account</a>
    <p class="eyebrow">Refer a business</p>
    <h1>Know someone who'd want this?</h1>
    <p class="lede">Most of my work comes from people like you mentioning me. If you know a business that needs a site, an app, or just someone who answers, send them my way.${reward ? ` If they come on board, ${esc(reward)} as a thank you.` : ''}</p>
    ${passed ? `<div class="stats"><div class="card stat"><b>${passed}</b><span>Passed on</span></div><div class="card stat"><b>${won}</b><span>Now with Sidedoor</span></div><div class="card stat"><b>${won && reward ? '✓' : '-'}</b><span>${won && reward ? 'Thank you earned' : 'Thank you'}</span></div></div>` : ''}
    <button class="btn neon block" id="share">Send them a message</button>
    <form class="card stack" id="f" novalidate>
      <h3>Or pass on their details</h3>
      <p class="faint">Jordan gets a ping straight away and mentions your name when he gets in touch.</p>
      <div class="grid2"><div class="field"><label for="rn">Their name</label><input class="input" id="rn" name="name" required></div>
        <div class="field"><label for="rb">Their business</label><input class="input" id="rb" name="business" required></div></div>
      <div class="grid2"><div class="field"><label for="rp">Phone</label><input class="input" id="rp" name="phone" type="tel" inputmode="tel"></div>
        <div class="field"><label for="re">Email</label><input class="input" id="re" name="email" type="email"></div></div>
      <div class="field"><label for="rt">Anything useful to know</label><textarea class="input" id="rt" name="note" placeholder="e.g. Their booking system keeps falling over"></textarea></div>
      <p class="error"></p><button class="btn block" type="submit">Pass it on</button>
    </form>
    ${referrals.length ? `<div class="section-title"><h2>Your referrals</h2></div><div class="list">${referrals.map((r) => `<div class="card tight row between"><h3 class="grow">${esc(r.business)}</h3><span class="pill ${r.status === 'won' ? 'done' : r.status === 'contacted' ? 'approved' : 'plain'}">${STATUS[r.status]}</span></div>`).join('')}</div>` : ''}
  </div>`);
  $('#share').onclick = async () => {
    if (navigator.share) { try { await navigator.share({ text: shareText }); } catch {} return; }
    try { await navigator.clipboard.writeText(shareText); toast('Message copied, paste it anywhere'); } catch { toast(shareText); }
  };
  onSubmit($('#f'), async (v, form) => { await api('/referrals', { method: 'POST', body: v }); form.reset(); toast('Thank you. Jordan has it.'); route(); });
}

async function leadsView() {
  chrome('/');
  loading();
  const { referrals } = await api('/admin/referrals');
  const opts = [['new', 'New'], ['contacted', 'Contacted'], ['won', 'Won'], ['not_now', 'Not now']];
  render(`<div class="stack">
    <a class="faint" href="#/">&larr; Today</a>
    <p class="eyebrow">Leads</p>
    <h1>From your clients</h1>
    <p class="lede">Businesses your clients passed on. They see the status, so keep it up to date.</p>
    <div class="list">${referrals.length ? referrals.map((r) => `<div class="card tight ${r.status === 'new' ? 'lit' : ''}">
      <div class="row between"><h3 class="grow">${esc(r.business)}</h3><span class="faint">${ago(r.created_at)}</span></div>
      <p class="muted">${esc(r.name)}${r.phone ? ` · <a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>` : ''}${r.email ? ` · <a href="mailto:${esc(r.email)}">${esc(r.email)}</a>` : ''}</p>
      ${r.note ? `<p class="faint">${esc(r.note)}</p>` : ''}
      <p class="faint mt8">From ${esc(r.from_business || 'a client')}</p>
      <div class="chips mt8">${opts.map(([k, l]) => `<button class="chip" data-id="${esc(r.id)}" data-s="${k}" aria-pressed="${r.status === k}">${l}</button>`).join('')}</div>
    </div>`).join('') : emptyBlock(I.clients, 'No leads yet', 'Clients can pass on businesses from their Account page.')}</div>
  </div>`);
  $$('[data-s]').forEach((b) => (b.onclick = async () => {
    try { await api('/admin/referrals', { method: 'PATCH', body: { id: b.dataset.id, status: b.dataset.s } }); route(); } catch (e) { toast(e.message, true); }
  }));
}

/* ---------- polish: badges, count up ---------- */
let badgeTimer = 0;
async function refreshBadges() {
  if (!state.user || state.user.must_change_password) return;
  if (Date.now() - badgeTimer < 15000) return paintBadges();
  badgeTimer = Date.now();
  try { state.badges = await api('/badges'); } catch { state.badges = {}; }
  paintBadges();
}
function paintBadges() {
  const b = state.badges || {};
  $$('#tabs a').forEach((a) => {
    const n = b[a.getAttribute('href').slice(1)] || 0;
    let el = $('.badge', a);
    if (!n) { el?.remove(); return; }
    if (!el) { el = document.createElement('span'); el.className = 'badge'; a.appendChild(el); }
    el.textContent = n > 9 ? '9+' : n;
  });
}

function countUp(root) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  $$('.stat b, .scenes b, .big', root).forEach((el) => {
    const m = el.textContent.trim().match(/^([£]?)([\d,]+(?:\.\d+)?)(%?)$/);
    if (!m) return;
    const target = Number(m[2].replace(/,/g, ''));
    if (!target || target > 1e7) return;
    const dp = (m[2].split('.')[1] || '').length;
    const start = performance.now(), dur = 700;
    const tick = (now) => {
      const k = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - k, 3);
      const v = target * e;
      el.textContent = m[1] + (dp ? v.toFixed(dp) : Math.round(v).toLocaleString('en-GB')) + m[3];
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/* ---------- the Sidedoor network ---------- */
const initials = (n) => String(n || '?').replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const telHref = (p) => `tel:${String(p || '').replace(/[^\d+]/g, '')}`;

function memberCard(m, canAsk) {
  return `<div class="card member ${m.is_me ? 'lit' : ''}" data-member="${esc(m.client_id)}">
    <div class="row"><span class="mono-badge" aria-hidden="true">${esc(initials(m.display_name))}</span>
      <div class="grow"><h3>${esc(m.display_name)}</h3><p class="faint">${esc([m.category, m.town].filter(Boolean).join(' · '))}</p></div></div>
    ${m.about ? `<p class="muted mt8">${esc(m.about)}</p>` : ''}
    ${m.offer ? `<p class="perk mt8"><span>Member perk</span>${esc(m.offer)}</p>` : ''}
    ${m.looking_for ? `<p class="faint mt8"><b>Looking for:</b> ${esc(m.looking_for)}</p>` : ''}
    ${m.is_me ? '<a class="linkish" href="#/network/profile">This is you. Edit your profile</a>'
      : canAsk ? `<button class="btn ghost small mt16" data-ask="${esc(m.client_id)}">Ask Jordan for an intro</button>
        <form class="ask stack mt16" data-for="${esc(m.client_id)}" hidden>
          <textarea class="input" name="message" maxlength="1000" placeholder="What would you like to talk to them about?" required></textarea>
          <p class="error"></p><button class="btn neon small" type="submit">Send to Jordan</button></form>` : ''}
  </div>`;
}

function introCard(i) {
  const STATUS = { requested: ['new', 'With Jordan'], introduced: ['done', 'Introduced'], declined: ['plain', 'Jordan will be in touch'] };
  const [cls, label] = STATUS[i.status];
  const c = i.contact;
  return `<div class="card tight ${i.unseen ? 'lit' : ''}">
    <div class="row between"><h3 class="grow">${i.direction === 'out' ? '' : 'From '}${esc(i.other)}</h3><span class="pill ${cls}">${label}</span></div>
    ${i.message && i.direction === 'out' ? `<p class="faint mt8">"${esc(i.message)}"</p>` : ''}
    ${c ? `<div class="contact mt16">
      ${c.name ? `<b>${esc(c.name)}</b>` : ''}
      <div class="row wrap mt8">${c.phone ? `<a class="btn small" href="${esc(telHref(c.phone))}">Call</a><a class="btn ghost small" href="https://wa.me/${esc(waNumber(c.phone))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}${c.email ? `<a class="btn ghost small" href="mailto:${esc(c.email)}">Email</a>` : ''}</div>
      ${i.direction === 'in' && i.message ? `<p class="faint mt8">They said: "${esc(i.message)}"</p>` : ''}
    </div>` : ''}
  </div>`;
}

async function networkView(query) {
  chrome('/network');
  loading();
  const d = await api('/network');
  const joined = d.profile.visible;
  const others = d.members.filter((m) => !m.is_me);
  const cats = [...new Set(d.members.map((m) => m.category).filter(Boolean))];
  let filter = query.get('c') || '';
  const perks = others.filter((m) => m.offer);
  const draw = () => {
    const list = d.members.filter((m) => !filter || (filter === 'perks' ? m.offer : m.category === filter));
    $('#members').innerHTML = list.length ? list.map((m) => memberCard(m, joined)).join('') : '<p class="faint">Nobody in that one yet.</p>';
    $$('#filters .chip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.f === filter));
    wireAsk();
  };
  render(`<div class="stack">
    <p class="eyebrow">Sidedoor network</p>
    <h1>Businesses that have your back.</h1>
    <p class="lede">Every business here is looked after by Sidedoor. Find someone you need, share a perk, and Jordan will introduce you properly.</p>
    ${joined ? '' : `<div class="card night">
      <p class="eyebrow">You're not in it yet</p>
      <h2>Join the network</h2>
      <p class="muted">Other Sidedoor businesses can find you, you can ask for intros, and you can offer members a perk. Your phone and email are only shared when Jordan introduces you.</p>
      <a class="btn neon small" href="#/network/profile">Set up your profile</a>
    </div>`}
    ${d.intros.length ? `<div class="section-title"><h2>Your intros</h2></div><div class="list">${d.intros.map(introCard).join('')}</div>` : ''}
    <div class="stats">
      <div class="card stat"><b>${d.members.length}</b><span>Businesses</span></div>
      <div class="card stat"><b>${perks.length}</b><span>Member perks</span></div>
      <div class="card stat"><b>${cats.length}</b><span>Sectors</span></div>
    </div>
    ${perks.length ? `<div class="section-title"><h2>Member perks</h2></div>
      <div class="perk-rail">${perks.map((m) => `<a class="card perk-card" href="#/network?c=perks"><b>${esc(m.offer)}</b><span class="faint block mt8">${esc(m.display_name)}</span></a>`).join('')}</div>` : ''}
    <div class="section-title"><h2>Members</h2></div>
    <div class="chips" id="filters"><button class="chip" data-f="">All</button>${perks.length ? '<button class="chip" data-f="perks">With a perk</button>' : ''}${cats.map((c) => `<button class="chip" data-f="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <div class="list" id="members"></div>
    ${!others.length ? '<div class="card"><p class="muted">The network is just getting going. As more Sidedoor businesses join, they show up here.</p></div>' : ''}
  </div>`);
  $$('#filters .chip').forEach((c) => (c.onclick = () => { filter = c.dataset.f; draw(); }));
  draw();
  function wireAsk() {
    $$('[data-ask]').forEach((b) => (b.onclick = () => { const f = $(`form[data-for="${b.dataset.ask}"]`); f.hidden = !f.hidden; if (!f.hidden) $('textarea', f).focus(); }));
    $$('form.ask').forEach((f) => onSubmit(f, async (v) => {
      await api('/network/intro', { method: 'POST', body: { to_client: f.dataset.for, message: v.message } });
      toast("Sent. Jordan will make the intro.");
      route();
    }));
  }
}

async function networkProfileView() {
  chrome('/network');
  loading();
  const d = await api('/network');
  const p = d.profile;
  render(`<div class="stack">
    <a class="faint" href="#/network">&larr; Network</a>
    <p class="eyebrow">Your network profile</p>
    <h1>${p.visible ? 'Your profile' : 'Join the network'}</h1>
    <p class="lede">This is what other Sidedoor businesses see. Your phone and email stay private until Jordan introduces you to someone.</p>
    <form class="card stack" id="f" novalidate>
      <label class="check big-check"><input type="checkbox" name="visible" value="1" ${p.visible ? 'checked' : ''}> Show my business in the Sidedoor network</label>
      <div class="field"><label for="dn">Business name</label><input class="input" id="dn" name="display_name" value="${esc(p.display_name || '')}" required></div>
      <div class="grid2"><div class="field"><label for="cat">What you do</label><select class="input" id="cat" name="category">${d.categories.map((c) => `<option ${c === p.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
        <div class="field"><label for="tw">Town</label><input class="input" id="tw" name="town" value="${esc(p.town || '')}"></div></div>
      <div class="field"><label for="ab">A line about you</label><textarea class="input" id="ab" name="about" maxlength="280" placeholder="e.g. Southport's pick and mix shop. Sweet tubs, parties and events.">${esc(p.about || '')}</textarea></div>
      <div class="field"><label for="of">A perk for Sidedoor members (optional)</label><input class="input" id="of" name="offer" maxlength="160" value="${esc(p.offer || '')}" placeholder="e.g. 10% off party tubs for Sidedoor members">
        <span class="hint">Perks are the best way to get noticed. Members see them first.</span></div>
      <div class="field"><label for="lf">Looking for (optional)</label><input class="input" id="lf" name="looking_for" maxlength="160" value="${esc(p.looking_for || '')}" placeholder="e.g. a local photographer, a venue for a pop-up"></div>
      <p class="label mt16">Shared only when Jordan introduces you</p>
      <div class="grid2"><div class="field"><label for="cn">Contact name</label><input class="input" id="cn" name="contact_name" value="${esc(p.contact_name || '')}"></div>
        <div class="field"><label for="cp">Phone</label><input class="input" id="cp" name="contact_phone" type="tel" value="${esc(p.contact_phone || '')}"></div></div>
      <div class="field"><label for="ce">Email</label><input class="input" id="ce" name="contact_email" type="email" value="${esc(p.contact_email || '')}"></div>
      <p class="error"></p>
      <button class="btn neon block" type="submit">${p.visible ? 'Save profile' : 'Save and join'}</button>
    </form>
  </div>`);
  onSubmit($('#f'), async (v) => {
    v.visible = !!v.visible;
    await api('/network/profile', { method: 'PUT', body: v });
    toast(v.visible ? "You're in the network" : 'Saved. Hidden from the network.');
    go('/network');
  });
}

async function introsAdminView() {
  chrome('/');
  loading();
  const d = await api('/admin/intros');
  const pending = d.intros.filter((i) => i.status === 'requested');
  const done = d.intros.filter((i) => i.status !== 'requested');
  render(`<div class="stack">
    <a class="faint" href="#/">&larr; Today</a>
    <p class="eyebrow">Sidedoor network</p>
    <h1>Intros and members</h1>
    <div class="stats">
      <div class="card stat"><b>${d.members.filter((m) => m.visible).length}</b><span>In the network</span></div>
      <div class="card stat"><b>${pending.length}</b><span>Intros waiting</span></div>
      <div class="card stat"><b>${done.filter((i) => i.status === 'introduced').length}</b><span>Intros made</span></div>
    </div>
    <div class="section-title"><h2>Waiting on you</h2></div>
    <div class="list">${pending.length ? pending.map((i) => `<div class="card tight lit">
      <h3>${esc(i.from_name)} &rarr; ${esc(i.to_name)}</h3>
      <p class="muted mt8">"${esc(i.message || '')}"</p><p class="faint">${ago(i.created_at)}</p>
      <div class="row wrap mt8"><button class="btn neon small" data-intro="${esc(i.id)}" data-a="introduce">Introduce them</button><button class="linkish" data-intro="${esc(i.id)}" data-a="decline">Not this one</button></div>
      <p class="hint mt8">Introducing shares each side's contact details with the other and pings both phones.</p>
    </div>`).join('') : '<p class="faint">No intro requests waiting.</p>'}</div>
    <div class="section-title"><h2>Members</h2></div>
    <div class="list">${d.members.map((m) => `<div class="card tight ${m.visible ? '' : 'dim'}"><div class="row between"><h3 class="grow">${esc(m.display_name)}</h3>${m.visible ? `<button class="linkish" data-hide="${esc(m.client_id)}">Hide</button>` : '<span class="faint">Hidden</span>'}</div>
      <p class="faint">${esc([m.category, m.town].filter(Boolean).join(' · '))}</p>${m.offer ? `<p class="perk mt8"><span>Perk</span>${esc(m.offer)}</p>` : ''}</div>`).join('') || '<p class="faint">Nobody has joined yet. Clients join from their Network tab.</p>'}</div>
    ${done.length ? `<div class="section-title"><h2>History</h2></div><div class="list">${done.map((i) => `<div class="card tight row between"><span class="grow">${esc(i.from_name)} &rarr; ${esc(i.to_name)}</span><span class="pill ${i.status === 'introduced' ? 'done' : 'plain'}">${i.status === 'introduced' ? 'Introduced' : 'Declined'}</span></div>`).join('')}</div>` : ''}
  </div>`);
  $$('[data-intro]').forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    try { await api('/admin/intros', { method: 'PATCH', body: { id: b.dataset.intro, action: b.dataset.a } }); toast(b.dataset.a === 'introduce' ? 'Introduced. Both phones pinged.' : 'Declined'); route(); }
    catch (e) { toast(e.message, true); b.disabled = false; }
  }));
  $$('[data-hide]').forEach((b) => (b.onclick = async () => {
    if (!confirm('Hide this business from the network?')) return;
    await api('/admin/intros', { method: 'PATCH', body: { hide_client: b.dataset.hide } }); route();
  }));
}

/* ---------- More (clients) ---------- */
async function moreView() {
  chrome('/account');
  loading();
  const [bills, refs, net] = await Promise.all([api('/billing').catch(() => null), api('/referrals').catch(() => null), api('/network').catch(() => null)]);
  const u = state.user;
  render(`<div class="stack">
    <p class="eyebrow">More</p>
    <h1>${esc(firstName(u.name))}</h1>
    <p class="lede">${esc(state.client?.business_name || '')}</p>
    ${referCard(refs)}
    <div class="list">
      <a class="card tight row" href="#/billing"><span class="grow"><h3>Billing</h3><span class="faint block">${bills ? (bills.outstanding_pence ? `${money(bills.outstanding_pence)} to pay` : 'All paid up') : ''}</span></span>${bills?.outstanding_pence ? '<span class="pill quoted">Due</span>' : ''}</a>
      <a class="card tight row" href="#/report"><span class="grow"><h3>Monthly report</h3><span class="faint block">Your month on one page</span></span></a>
      <a class="card tight row" href="#/network/profile"><span class="grow"><h3>Network profile</h3><span class="faint block">${net?.profile.visible ? 'Live in the Sidedoor network' : 'Not in the network yet'}</span></span></a>
      <a class="card tight row" href="#/ideas"><span class="grow"><h3>Ideas for your site</h3><span class="faint block">Picked for the time of year</span></span></a>
    </div>
    <div class="section-title"><h2>Settings</h2></div>
    <div class="card tight row" id="pushrow"><div class="grow"><h3>Phone notifications</h3><p class="faint" id="pushst">Checking...</p></div><span id="pushbtns"></span></div>
    <a class="card tight" href="#/password-change"><h3>Change password</h3><p class="faint">Signs you out on other devices</p></a>
    <div class="card tight"><h3>Talk to Jordan</h3><p class="muted">For anything about your site, use <a href="#/requests/new">a request</a> so it's all kept in one place. Something urgent and the site's down? Mark it urgent and I'll see it straight away.</p></div>
    <button class="btn ghost block" id="out">Log out</button>
    <p class="faint">Sidedoor Digital · 98 King Street, Southport · getsidedoor.co.uk</p>
  </div>`);
  $('#out').onclick = logout;
  wirePushRow();
}

function networkTeaser(net) {
  const others = net.members.filter((m) => !m.is_me);
  const newIntro = net.intros.find((i) => i.unseen && i.status === 'introduced');
  if (newIntro) return `<a class="card lit" href="#/network"><p class="eyebrow">Network</p><h3 class="mt8">You've been introduced to ${esc(newIntro.other)}</h3><p class="faint mt8">Their details are waiting in the Network tab.</p></a>`;
  if (!net.profile.visible) return `<a class="card" href="#/network"><p class="eyebrow">Sidedoor network</p><h3 class="mt8">${others.length ? `${others.length} Sidedoor businesses are in the network` : 'Join the Sidedoor network'}</h3><p class="faint mt8">Find businesses you need, share a perk, get introduced properly.</p></a>`;
  if (!others.length) return '';
  const latest = others.slice(0, 3).map((m) => m.display_name);
  return `<a class="card" href="#/network"><p class="eyebrow">Sidedoor network</p><h3 class="mt8">${others.length} business${others.length === 1 ? '' : 'es'} in the network</h3><p class="faint mt8">Newest: ${esc(latest.join(', '))}</p></a>`;
}

function referCard(refs) {
  const reward = refs?.reward;
  return `<a class="card night refer-card" href="#/refer">
    <p class="eyebrow">Refer a mate</p>
    <h2>Know a business that needs this?</h2>
    <p class="muted">${reward ? `Send them my way. If they come on board, ${esc(reward)} as a thank you.` : 'Send them my way. Most of my work comes from people like you.'}</p>
    ${refs?.passed ? `<p class="refer-progress mt8"><b>${refs.passed}</b> passed on${refs.won ? ` · <b>${refs.won}</b> joined` : ''}</p>` : ''}
    <span class="btn neon small">Pass someone on</span>
  </a>`;
}

/* ---------- router ---------- */
let cleanup = null;
async function loadMe() {
  const d = await api('/auth/me');
  state.user = d.user;
  state.client = d.client;
  if (d.user && !d.user.must_change_password) syncPush();
}

const routes = [
  [/^\/login$/, loginView, 'public'],
  [/^\/password$/, () => passwordView(true), 'pending'],
  [/^\/welcome$/, welcomeView, 'any'],
  [/^\/password-change$/, () => passwordView(false), 'any'],
  [/^\/account$/, accountView, 'any'],
  [/^\/requests\/new$/, (m, q) => newRequest(q), 'any'],
  [/^\/requests\/([\w-]+)$/, (m) => requestDetail(m[1]), 'any'],
  [/^\/requests$/, requestsList, 'client'],
  [/^\/site$/, (m, q) => siteHub(q), 'any'],
  [/^\/view\/([\w-]+)$/, (m, q) => siteViewer(m[1], q), 'any'],
  [/^\/analytics\/([\w-]+)$/, (m, q) => analyticsView(m[1], q), 'any'],
  [/^\/security$/, (m, q) => securityView(q), 'any'],
  [/^\/ideas$/, ideasView, 'client'],
  [/^\/gsc$/, gscView, 'admin'],
  [/^\/admin-ideas$/, adminIdeasView, 'admin'],
  [/^\/notes$/, adminNotesView, 'admin'],
  [/^\/report$/, (m, q) => reportView(q), 'any'],
  [/^\/refer$/, referView, 'client'],
  [/^\/leads$/, leadsView, 'admin'],
  [/^\/network$/, (m, q) => networkView(q), 'client'],
  [/^\/network\/profile$/, networkProfileView, 'client'],
  [/^\/intros$/, introsAdminView, 'admin'],
  [/^\/clients\/new$/, newClientView, 'admin'],
  [/^\/clients\/([\w-]+)$/, (m) => clientDetailView(m[1]), 'admin'],
  [/^\/clients$/, adminClients, 'admin'],
  [/^\/import$/, importView, 'admin'],
  [/^\/send$/, sendView, 'admin'],
  [/^\/billing$/, billingView, 'client'],
  [/^\/billing\/([\w-]+)$/, (m) => invoiceView(m[1]), 'any'],
  [/^\/money$/, moneyView, 'admin'],
  [/^\/invoices\/new$/, (m, q) => newInvoiceView(q), 'admin'],
  [/^\/$/, () => (state.user.role === 'admin' ? adminToday() : clientHome()), 'any']
];

async function route() {
  if (cleanup) { cleanup(); cleanup = null; }
  const raw = location.hash.slice(1) || '/';
  const [path, qs] = raw.split('?');
  const query = new URLSearchParams(qs || '');
  const u = state.user;

  if (!u && path !== '/login') return go('/login');
  if (u && u.must_change_password && path !== '/password') return go('/password');
  if (u && path === '/login') return go('/');

  for (const [re, fn, who] of routes) {
    const m = path.match(re);
    if (!m) continue;
    if (who === 'admin' && u.role !== 'admin') return go('/');
    if (who === 'client' && u.role !== 'client') return go('/');
    try { await fn(m, query); }
    catch (e) {
      if (e.status === 401 || e.status === 403) return;
      render(`<div class="card empty"><h3>That didn't load</h3><p class="faint">${esc(e.message)}</p><button class="btn small" id="retry">Try again</button></div>`);
      $('#retry').onclick = route;
    }
    view.focus({ preventScroll: true });
    return;
  }
  go('/');
}

addEventListener('hashchange', route);
(async () => {
  try { await loadMe(); } catch { state.user = null; }
  route();
})();

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
