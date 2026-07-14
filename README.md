# Bel-Nebula — payment & captive portal

This covers the two pieces you asked for now: the **backend** (Paystack +
MikroTik provisioning) and the **frontend** (the sign-in/payment page
students see). MikroTik router configuration itself is out of scope here —
you said you'll handle that separately — but the backend is already built
to talk to it once it's ready, and runs in a mock mode until then.

## 1. Backend

```
cd backend
cp .env.example .env      # fill in your Paystack keys
npm install
npm start                 # or: npm run dev
```

It starts on `http://localhost:4000` by default. Until you set
`MIKROTIK_HOST` in `.env`, MikroTik calls are logged to the console
instead of hitting a real router — so you can test the whole payment
flow today.

Endpoints:
- `GET /api/packages` — the 4 packages, read by the frontend
- `POST /api/payment/initialize` — starts a Paystack transaction
- `POST /api/payment/verify` — confirms payment, creates the hotspot user
- `POST /api/webhook/paystack` — set this as your webhook URL in the
  Paystack dashboard (Settings → API Keys & Webhooks) as a second,
  more reliable confirmation path
- `GET /api/health` — quick check, also reports mock mode status

## 2. Frontend

`frontend/index.html` is a static page — no build step. Two ways to try it:

- **Quick local test:** open `frontend/index.html` directly in a browser
  (with the backend running), or serve the folder with any static server,
  e.g. `npx serve frontend`.
- Edit `frontend/config.js` and set `API_BASE_URL` to wherever the
  backend actually runs (this is the only thing you need to change to
  point the page at a live deployment).

Since it's opened on phones inside a captive-portal browser, MikroTik
will hand it a few extra bits of information in the URL — a device MAC
address and a special login link. `script.js` reads those automatically;
if they're missing (e.g. you're just testing in a normal browser tab) it
still works, it just won't be able to silently log the router in for you.

## What's not built yet

- MikroTik hotspot profiles named `pkg-3hrs`, `pkg-24hrs`, `pkg-1week`,
  `pkg-1month` (the backend expects these exact names — `backend/config/packages.js`)
  and the captive portal redirect pointing at this frontend
  — you're handling this part
- A real database for transactions (currently in-memory, resets on
  restart — fine for testing, not for production)
- Deployment (hosting the backend somewhere reachable from the router,
  and the frontend somewhere reachable from students' phones)

Happy to help with any of those when you're ready — just say the word.
