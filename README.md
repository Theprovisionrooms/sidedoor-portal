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

## Coming next

- Stage 2: billing. Build fee and monthlies, Revolut link sent on the 1st, phone notifications.
- Stage 3: analytics from Search Console per site.
- Stage 4: automated security checks (SSL, uptime, headers, domain expiry) and seasonal recommendations per client.
