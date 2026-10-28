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
  inbox: '<svg viewBox="0 0 24 24"><path d="M4 13l2-8h12l2 8v6H4z"/><path d="M4 13h5l1 2h4l1-2h5"/></svg>',
  door: '<svg viewBox="0 0 32 40" class="door"><path d="M5 38V9a11 11 0 0 1 22 0v29"/><path class="glow" d="M5 38V9a11 11 0 0 1 22 0v29"/><circle cx="21.5" cy="24" r="1.6"/></svg>'
};

/* ---------- chrome ---------- */
function chrome(active, opts = {}) {
  const u = state.user;
  const show = !!u && !u.must_change_password && !opts.bare;
  top.hidden = !show;
  tabs.hidden = !show;
  document.body.classList.toggle('no-tabs', !show);
  view.classList.toggle('wide', !!opts.wide);
  if (!show) return;
  $('#top-who').textContent = u.role === 'admin' ? 'Admin' : state.client?.business_name || '';
  const items = u.role === 'admin'
    ? [['/', 'Today', I.today], ['/clients', 'Clients', I.clients], ['/account', 'Account', I.me]]
    : [['/', 'Home', I.home], ['/site', 'My site', I.site], ['/requests', 'Requests', I.req], ['/account', 'Account', I.me]];
  tabs.innerHTML = items.map(([p, label, icon]) =>
    `<a href="#${p}" class="${active === p ? 'on' : ''}" ${active === p ? 'aria-current="page"' : ''}>${icon}<span>${label}</span></a>`).join('');
}

function render(html) {
  view.innerHTML = `<div class="fade-in">${html}</div>`;
  window.scrollTo(0, 0);
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
  render(`<div class="login">
    ${I.door}
    <p class="eyebrow">Sidedoor Digital</p>
    <h1>Your site, sorted.</h1>
    <p class="tagline">There's the obvious way of doing things. Then there's the Sidedoor.</p>
    <form class="stack" id="f" novalidate>
      <div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" autocomplete="username" required></div>
      <div class="field"><label for="pw">Password</label><input class="input" id="pw" name="password" type="password" autocomplete="current-password" required></div>
      <p class="error" role="alert"></p>
      <button class="btn neon block" type="submit">Step inside</button>
      <p class="faint">Forgotten it? Message Jordan and he'll reset it for you.</p>
    </form>
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
    ${forced ? I.door : ''}
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
    ${I.door}
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

function accountView() {
  chrome('/account');
  const u = state.user;
  render(`<div class="stack">
    <p class="eyebrow">Account</p>
    <h1>${esc(u.name)}</h1>
    <p class="lede">${esc(u.email)}${state.client ? ` · ${esc(state.client.business_name)}` : ''}</p>
    <a class="card tight" href="#/password-change"><h3>Change password</h3><p class="faint">Signs you out on other devices</p></a>
    ${u.role === 'client' ? `<div class="card tight"><h3>Talk to Jordan</h3><p class="muted">For anything about your site, use <a href="#/requests/new">a request</a> so it's all kept in one place. Something urgent and the site's down? Mark the request as urgent and I'll see it straight away.</p></div>` : ''}
    <button class="btn ghost block" id="out">Log out</button>
    <p class="faint">Sidedoor Digital · 98 King Street, Southport · getsidedoor.co.uk</p>
  </div>`);
  $('#out').onclick = logout;
}

/* ---------- client: home ---------- */
async function clientHome() {
  chrome('/');
  loading();
  const d = await api('/home');
  const site = d.sites[0];
  const needOk = d.open_requests.filter((r) => r.status === 'quoted');
  render(`<div class="stack">
    <p class="eyebrow">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    <h1>${greeting()}, ${esc(firstName(state.user.name))}.</h1>
    ${needOk.length ? `<a class="card night" href="#/requests/${esc(needOk[0].id)}">
        <p class="eyebrow">Needs your OK</p><h2>${esc(needOk[0].title)}</h2>
        <p class="muted">${duration(needOk[0].quoted_minutes)} · ${money(needOk[0].quoted_pence)}. Tap to approve.</p>
        ${needOk.length > 1 ? `<p class="faint">Plus ${needOk.length - 1} more waiting</p>` : ''}</a>` : ''}
    ${site ? `<a class="card night" href="#/site/${esc(site.id)}">
        <p class="eyebrow">Your site</p><h2>${esc(hostOf(site.url))}</h2>
        <p class="muted">See it as your customers do, on phone and desktop.</p>
        <span class="btn ghost on-night small">View live site</span></a>` : ''}
    <div class="stats">
      <div class="card stat"><b>${d.open_requests.length}</b><span>Open requests</span></div>
      <div class="card stat"><b>${d.done_count}</b><span>Jobs done</span></div>
      <div class="card stat"><b>${money(d.client.hourly_rate_pence)}</b><span>Per hour</span></div>
    </div>
    <a class="btn neon block" href="#/requests/new">Ask for a change</a>
    <div class="section-title"><h2>On the go</h2><a class="faint" href="#/requests">See all</a></div>
    <div class="list">${d.open_requests.length ? d.open_requests.slice(0, 5).map((r) => requestCard(r)).join('')
      : emptyBlock(I.req, 'Nothing on the go', 'When you want something changed, send it through and I will quote it.')}</div>
  </div>`);
}

/* ---------- site viewer ---------- */
async function siteView(id) {
  chrome('/site');
  loading();
  const d = await api('/home');
  const sites = d.sites;
  if (!sites.length) return render(emptyBlock(I.site, 'No site linked yet', 'Jordan will add it here.'));
  const site = sites.find((s) => s.id === id) || sites[0];
  let mode = innerWidth < 700 ? 'phone' : 'desktop';
  render(`<div class="stack">
    <p class="eyebrow">Live site</p>
    <h1 class="site-title">${esc(hostOf(site.url))}</h1>
    ${sites.length > 1 ? `<div class="chips">${sites.map((s) => `<a class="chip" href="#/site/${esc(s.id)}" aria-pressed="${s.id === site.id}">${esc(s.name)}</a>`).join('')}</div>` : ''}
    <div class="row between wrap">
      <div class="seg" role="group" aria-label="Device"><button data-m="phone">Phone</button><button data-m="desktop">Desktop</button></div>
      <div class="row"><a class="btn ghost small" href="${esc(site.url)}" target="_blank" rel="noopener">Open</a>
      <a class="btn small" href="#/requests/new?site=${esc(site.id)}">Change something</a></div>
    </div>
    <div class="stage" id="stage"><div class="scaler" id="scaler"></div></div>
    <p class="faint">This is your real site, live right now. Scroll inside the frame to look around.</p>
  </div>`);
  const stage = $('#stage'), scaler = $('#scaler');
  function draw() {
    $$('.seg button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.m === mode));
    const phone = mode === 'phone';
    scaler.innerHTML = phone
      ? `<div class="device phone-frame"><div class="notch"></div><div class="screen"><iframe title="Phone view of ${esc(site.name)}" src="${esc(site.url)}" referrerpolicy="no-referrer"></iframe></div></div>`
      : `<div class="device desk-frame"><div class="bar"><span class="dots"><i></i><i></i><i></i></span><span class="addr">${esc(site.url)}</span></div><div class="screen"><iframe title="Desktop view of ${esc(site.name)}" src="${esc(site.url)}" referrerpolicy="no-referrer"></iframe></div></div>`;
    fit();
  }
  function fit() {
    const dev = $('.device', scaler);
    if (!dev) return;
    const w = dev.offsetWidth, h = dev.offsetHeight;
    const availW = stage.clientWidth - 36;
    const availH = mode === 'phone' ? Math.max(420, innerHeight - 330) : Infinity;
    const k = Math.min(1, availW / w, availH / h);
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

/* ---------- requests ---------- */
async function requestsList() {
  chrome('/requests');
  loading();
  const { requests } = await api('/requests');
  const open = requests.filter((r) => ['new', 'quoted', 'approved', 'in_progress'].includes(r.status));
  const past = requests.filter((r) => !open.includes(r));
  render(`<div class="stack">
    <p class="eyebrow">Requests</p>
    <div class="row between"><h1>Your changes</h1></div>
    <p class="lede">Work is ${money(state.client?.hourly_rate_pence ?? 1500)} an hour and most changes take under an hour. I'll always quote first, nothing starts until you say so.</p>
    <a class="btn neon block" href="#/requests/new">Ask for a change</a>
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
      <div class="field"><label for="title">In a few words</label><input class="input" id="title" name="title" maxlength="120" placeholder="e.g. New Christmas opening hours" required></div>
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
      <div class="field"><label for="r">Hourly rate (£)</label><input class="input" id="r" name="rate" type="number" min="0" step="0.5" value="15"></div>
      <div class="field"><label for="no">Private notes</label><textarea class="input" id="no" name="notes" placeholder="Only you see these"></textarea></div>
      <p class="error" role="alert"></p>
      <button class="btn neon block" type="submit">Create login</button>
    </form>
  </div>`);
  onSubmit($('#f'), async (v) => {
    const body = {
      business_name: v.business_name, contact_name: v.contact_name, email: v.email, phone: v.phone, notes: v.notes,
      hourly_rate_pence: Math.round(Number(v.rate || 15) * 100),
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
    <a class="btn neon block" href="#/requests/new?client=${esc(c.id)}">Log a request for them</a>

    <div class="section-title"><h2>Sites</h2></div>
    <div class="list">${d.sites.map((s) => `<div class="card tight row between"><div class="grow"><h3>${esc(s.name)}</h3><a class="faint" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(hostOf(s.url))}</a></div>
      <button class="x" data-del-site="${esc(s.id)}" aria-label="Remove ${esc(s.name)}">&times;</button></div>`).join('') || '<p class="faint">No sites yet.</p>'}</div>
    <form class="card stack" id="sf"><div class="grid2"><input class="input" name="name" placeholder="Site name"><input class="input" name="url" placeholder="example.co.uk" required></div>
      <p class="error"></p><button class="btn ghost small" type="submit">Add site</button></form>

    <div class="section-title"><h2>Logins</h2></div>
    <div class="list">${d.users.map((u) => `<div class="card tight row between"><div class="grow"><h3>${esc(u.name)}</h3>
      <p class="faint">${esc(u.email)} · ${u.must_change_password ? 'Not set up yet' : u.last_login_at ? `Seen ${ago(u.last_login_at)}` : 'Set up'}</p></div>
      <button class="btn ghost small" data-reset="${esc(u.id)}">Reset</button></div>`).join('')}</div>
    <form class="card stack" id="uf"><h3>Add another person</h3><div class="grid2"><input class="input" name="name" placeholder="Name" required><input class="input" name="email" type="email" placeholder="Email" required></div>
      <p class="error"></p><button class="btn ghost small" type="submit">Create login</button></form>

    <div class="section-title"><h2>Requests</h2></div>
    <div class="list">${d.requests.map((r) => requestCard(r)).join('') || '<p class="faint">None yet.</p>'}</div>

    <div class="section-title"><h2>Details</h2></div>
    <form class="card stack" id="ef">
      <div class="grid2"><div class="field"><label>Business name</label><input class="input" name="business_name" value="${esc(c.business_name)}"></div>
      <div class="field"><label>Contact name</label><input class="input" name="contact_name" value="${esc(c.contact_name)}"></div></div>
      <div class="grid2"><div class="field"><label>Phone</label><input class="input" name="phone" value="${esc(c.phone || '')}"></div>
      <div class="field"><label>Hourly rate (£)</label><input class="input" name="rate" type="number" step="0.5" min="0" value="${(c.hourly_rate_pence / 100).toFixed(2)}"></div></div>
      <div class="field"><label>Private notes</label><textarea class="input" name="notes">${esc(c.notes || '')}</textarea></div>
      <p class="error"></p><button class="btn small" type="submit">Save</button>
    </form>
    <button class="btn danger block" id="arch">${c.archived ? 'Restore client' : 'Archive client (blocks their login)'}</button>
  </div>`);

  onSubmit($('#sf'), async (v) => { await api(`/admin/clients/${id}/sites`, { method: 'POST', body: v }); toast('Site added'); route(); });
  onSubmit($('#uf'), async (v) => {
    const r = await api(`/admin/clients/${id}/users`, { method: 'POST', body: v });
    state.lastLogins = [{ ...r.login, phone: c.phone }]; go('/send');
  });
  onSubmit($('#ef'), async (v) => {
    await api(`/admin/clients/${id}`, { method: 'PATCH', body: { business_name: v.business_name, contact_name: v.contact_name, phone: v.phone, notes: v.notes, hourly_rate_pence: Math.round(Number(v.rate) * 100) } });
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
  { business_name: 'Candymonium', users: [{ name: 'Anthony', email: '' }], sites: [{ name: 'Candymonium', url: 'candymonium.co.uk' }] },
  { business_name: "Digz N' Lidz", users: [{ name: 'Mark', email: '' }, { name: 'Danny', email: '' }], sites: [{ name: "Digz N' Lidz", url: 'digznlidz.co.uk' }] },
  { business_name: 'WATAG', users: [{ name: 'Jay', email: '' }], sites: [{ name: 'WATAG', url: 'watagapp.co.uk' }] },
  { business_name: 'Rubies & Pearls', users: [{ name: 'Ruby', email: '' }], sites: [{ name: 'Rubies & Pearls', url: 'rubiesandpearls.co.uk' }] },
  { business_name: 'Dougie Joyce', users: [{ name: 'Dougie', email: '' }], sites: [
    { name: "Joyce's Irish Whiskey", url: 'joyceirishwhiskey.co.uk' },
    { name: '3D Fight Club', url: '3dfightclubofficial.com' },
    { name: 'Elite Force', url: '' }] },
  { business_name: 'E. Bartlett', users: [{ name: '', email: '' }], sites: [{ name: 'Portaloo hire', url: '' }, { name: 'Exhibition', url: '' }] },
  { business_name: 'Growing with Chaos', users: [{ name: '', email: '' }], sites: [{ name: 'Growing with Chaos', url: '' }] }
];

function importView() {
  chrome('/clients', { wide: true });
  const rows = structuredClone(IMPORT_SEED).map((r) => ({ ...r, on: true, phone: '' }));
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
        business_name: r.business_name, phone: r.phone,
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

/* ---------- router ---------- */
let cleanup = null;
async function loadMe() {
  const d = await api('/auth/me');
  state.user = d.user;
  state.client = d.client;
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
  [/^\/site(?:\/([\w-]+))?$/, (m) => siteView(m[1]), 'client'],
  [/^\/clients\/new$/, newClientView, 'admin'],
  [/^\/clients\/([\w-]+)$/, (m) => clientDetailView(m[1]), 'admin'],
  [/^\/clients$/, adminClients, 'admin'],
  [/^\/import$/, importView, 'admin'],
  [/^\/send$/, sendView, 'admin'],
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
