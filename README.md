# Sidedoor Portal | app.getsidedoor.co.uk

The client app. Clients log in on their phone to see their live site, send change requests, approve quotes and see the work being done. Jordan gets the admin side for onboarding, quoting and logging work.

Intellectual property of Sidedoor Digital.

## Stack

One Cloudflare Pages project: static app in `public/`, API as Pages Functions in `functions/api/`, shared code in `lib/`, D1 for the database. One push builds and deploys everything.

## First-time setup

1. Create the repo `theprovisionrooms/sidedoor-portal` and push these files.
2. Create the database and paste its id into `wrangler.toml`:
   ```
   npx.cmd wrangler d1 create sidedoor-portal
   npx.cmd wrangler d1 migrations apply sidedoor-portal --remote
   ```
3. In Cloudflare Pages, create a project from the repo. Build command: none. Output directory: `public`.
4. Pages project > Settings > Bindings: add D1 binding `DB` pointing at `sidedoor-portal`.
5. Pages project > Settings > Variables and secrets: add secret `SETUP_TOKEN` (any long random string).
6. Custom domain: `app.getsidedoor.co.uk`.
7. Create your admin login once. In a browser console on the live app:
   ```js
   fetch('/api/setup', { method: 'POST', headers: { 'content-type': 'application/json' },
     body: JSON.stringify({ token: 'YOUR_SETUP_TOKEN', name: 'Jordan Pang', email: 'digitalsidedoor@gmail.com', password: 'a long password' }) })
   ```
   Then delete the `SETUP_TOKEN` secret. The endpoint stops working once an admin exists anyway.
8. Log in, go to Clients > Import, fill in emails, import, and send each welcome message from the Send out screen.

## Let client sites show in the viewer

The "My site" screen shows each live site inside a phone and desktop frame. If a site sends `X-Frame-Options: DENY` or a strict `frame-ancestors`, the frame stays blank. In that site's `_headers`, allow the app (this also blocks everyone else from framing it, which is a security win):

```
/*
  Content-Security-Policy: frame-ancestors 'self' https://app.getsidedoor.co.uk
```

## Running locally

```
npm install
npx.cmd wrangler d1 migrations apply sidedoor-portal --local
echo SETUP_TOKEN=local-token > .dev.vars
npx.cmd wrangler pages dev
```

## How requests work

1. Client sends a request (or you log one for them).
2. You quote it in minutes. 0 minutes = free, goes straight to approved.
3. Client approves or declines on their phone. Nothing starts without approval.
4. You mark it started, then done with the time actually spent. Billing is capped at the quote.
5. Every step shows in the request's conversation so the client sees the work.

## Security in this build

- Passwords: PBKDF2-SHA256, 100k iterations, unique salt. Temporary passwords must be changed on first login.
- Sessions: random token in an HttpOnly, Secure, SameSite cookie; only its hash is stored. 30 days. Changing password signs out other devices; archiving a client signs them out everywhere.
- 8 failed logins in 15 minutes locks that email for 15 minutes.
- Writes from other origins are refused. Clients can only ever see their own data.
- Strict CSP and security headers in `public/_headers`.

## Stage 2: billing and phone notifications

### One-time setup
1. Apply the new migration: `npx.cmd wrangler d1 migrations apply sidedoor-portal --remote`
2. Make notification keys: `node scripts/vapid-keys.mjs`. Add both lines as secrets in the Pages project (Settings > Variables and secrets): `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`. Optional: `VAPID_SUBJECT` = `mailto:digitalsidedoor@gmail.com`.
3. Pick a long random string and add it as secret `CRON_SECRET` on the Pages project.
4. Deploy the daily tick worker once (it lives in `cron-worker/`, separate from the Pages project):
   ```
   npx.cmd wrangler deploy --config cron-worker/wrangler.toml
   npx.cmd wrangler secret put CRON_SECRET --config cron-worker/wrangler.toml
   ```
   Use the same string as step 3. It runs at 08:07 UTC every day.
5. In the app: Money > Settings, add your Revolut link. If it can take an amount, put `{amount}` where it goes, e.g. `https://revolut.me/yourname/{amount}`.
6. Monthly plans and when they start are set per client (Details), or pre-filled on the Import screen. A client mid-build gets a later start month so they aren't billed before launch.

### How the month works
- On the 1st, each client gets one draft bill: their monthly plan plus any changes finished the month before.
- You get a ping: "5 bills ready to send". Open Money, check them, tap Send all. (Or tick "Send automatically" to skip your check.)
- Clients get a ping, open the bill and tap Pay with Revolut. The bill reference (SDD-0004 etc.) is shown for them to use.
- They tap "I've already paid". You get a ping, check Revolut, tap Confirm. They get a thank-you ping.
- 3 days past due, the client gets one gentle reminder a week until it's sorted.
- Build deposits, balances and anything else: Money > One-off bill.
- Cancelling a bill releases any change work on it, so it lands on the next one.

### Notifications
Clients and you switch them on from the Home nudge or Account. On iPhone they only work once the app is added to the home screen and opened from there (iOS 16.4 or later). Account has a Test button.

## Stage 3 and 4: brand, analytics, site health, ideas

### What's new
- The app now matches getsidedoor.co.uk: your fonts, door mark, wordmark, the city under paper and the rainy night panels.
- **My site** is a hub: is each site up, protections on, Google numbers, and the behind-the-scenes log.
- **Analytics** from Search Console: visits, times shown, average place, day by day, top searches and pages.
- **Health checks**: up/down every 30 minutes (you get a ping after two misses in a row, and again when it's back), plus a daily check of the padlock, certificate, security headers and domain renewal.
- **Security news**: post a scam or threat in plain English with "not affected", "handled" or "one thing to do".
- **Behind the scenes log**: add what you did for a client from their page. They see it on their Security page.
- **Ideas**: seasonal and growth ideas written from each build. Clients see the ones in season for their site. "Go ahead for £15" creates an approved job at that price. Manage them from Today > Ideas library.

### One-time setup
1. Apply the new migration: `npx.cmd wrangler d1 migrations apply sidedoor-portal --remote`
2. Search Console secrets on the Pages project (Settings > Variables and secrets), both from the service account JSON file:
   - `GSC_CLIENT_EMAIL` = the `client_email` value
   - `GSC_PRIVATE_KEY` = the `private_key` value, the whole thing from `-----BEGIN PRIVATE KEY-----` to `-----END PRIVATE KEY-----\n`. Paste it as it appears in the file, the `\n` bits are fine.
3. Optional: `APP_ORIGIN` = `https://app.getsidedoor.co.uk` if the app ever runs on another address too.
4. Redeploy the Pages project, then redeploy the timer so it picks up the 30 minute check:
   `npx.cmd wrangler deploy --config cron-worker/wrangler.toml`
5. In the app: Today > Search Console > **Link sites and pull numbers now**.
6. Push the client site security headers (separate zip, `client-site-headers.zip`) before clients log in, so their Security page shows all six protections on.

### The timer
- Every 30 minutes: up/down check on every site.
- 08:07 UTC daily: bills (on the 1st) and reminders, then health checks, then analytics, a few sites per call so it stays inside Cloudflare's free limits.

## Coming next

- Ideas for E. Bartlett once her two sites are built.
- Anything that comes out of the first month of real use.
