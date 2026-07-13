# Divya Foods — Deployment Guide

**Stack:** React/Vite → Vercel | FastAPI → Railway | MongoDB Atlas

> Render (`render.yaml`) and Fly.io (`backend/fly.toml`) configs also exist in
> this repo as alternatives, but the live backend runs on Railway — that's
> what this guide covers.

---

## Prerequisites

- [ ] GitHub account (free)
- [ ] Railway account — railway.com (usage-based billing for the backend)
- [ ] Vercel account — vercel.com (free for frontend)
- [ ] MongoDB Atlas cluster already running

---

## Step 1 — Push code to GitHub

Run these commands once from the project root:

```bash
git init
git add .
git commit -m "Initial commit — Divya Foods full-stack app"
```

Then on GitHub.com:
1. Create a **new private repository** called `divya-foods`
2. Copy the remote URL (e.g. `https://github.com/yourname/divya-foods.git`)

```bash
git remote add origin https://github.com/yourname/divya-foods.git
git branch -M main
git push -u origin main
```

---

## Step 2 — Deploy backend to Railway

1. Go to **railway.com → New Project → Deploy from GitHub repo**
2. Select your repo and set the service's **Root Directory** to `backend` — this is required, not optional: without it Railway builds from the repo root, finds the frontend's `package.json` first, and fails on `npm ci`
3. Railway auto-detects `backend/railway.toml` and builds from `backend/Dockerfile`
4. Go to the service's **Variables** tab and fill in these secrets:

| Key | Value |
|-----|-------|
| `MONGODB_URL` | Your Atlas connection string: `mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority` |
| `JWT_SECRET_KEY` | Generate a random 32+ character string (e.g. `openssl rand -hex 32`) |
| `ALLOWED_ORIGINS` | `["https://YOUR-APP.vercel.app","https://www.divyafoods.com"]` — fill in after Step 3 |
| `RAZORPAY_KEY_ID` | From Razorpay Dashboard → Settings → API Keys (use a **test mode** key while developing) |
| `RAZORPAY_KEY_SECRET` | From Razorpay Dashboard → Settings → API Keys (test mode secret) |
| `RAZORPAY_WEBHOOK_SECRET` | See "Razorpay webhook setup" below — **required**, not optional (see note) |
| `SMTP_PASSWORD` | Gmail App Password (see note below) |
| `CLOUDINARY_CLOUD_NAME` | From your Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | From your Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | From your Cloudinary dashboard |

5. Save → Railway redeploys automatically
6. Under **Settings → Networking**, generate a public domain if one isn't assigned yet
7. Note your backend URL, e.g. `https://divya-foods-api-production-9380.up.railway.app`
8. Confirm it works: visit `https://YOUR-RAILWAY-URL/health`

### Razorpay webhook setup
The app confirms payment two ways: the customer's browser calling `/orders/verify`
right after checkout, **and** Razorpay calling `/webhooks/razorpay` directly on
its own servers. The webhook is the safety net — it's what finalizes an order
if the customer closes the tab, loses connection, or their browser never
completes the round trip. Without `RAZORPAY_WEBHOOK_SECRET` set, the handler
correctly refuses to process anything (fails closed, so this is not a security
gap) — but that also means the safety net silently doesn't exist.

1. Razorpay Dashboard → **Settings → Webhooks → Add New Webhook**
2. Webhook URL: `https://YOUR-RAILWAY-URL/webhooks/razorpay`
3. Select events: `payment.captured`, `payment.failed`, `refund.created`, `refund.processed`
4. Save — Razorpay shows a signing secret **once**. Copy it immediately.
5. Railway → your backend service → Variables → add `RAZORPAY_WEBHOOK_SECRET` with that value

### Gmail App Password setup
1. Enable 2-Factor Authentication on salesdivyafoods@gmail.com
2. Go to Google Account → Security → App Passwords
3. Generate a password for "Mail" → paste it as `SMTP_PASSWORD`

---

## Step 3 — Deploy frontend to Vercel

1. Go to **vercel.com → Add New Project**
2. Import your GitHub repo
3. Vercel auto-detects Vite — accept the defaults
4. Set these **Environment Variables** before clicking Deploy:

| Key | Value |
|-----|-------|
| `VITE_API_BASE_URL` | Your Railway backend URL from Step 2, e.g. `https://divya-foods-api-production-9380.up.railway.app` |
| `VITE_RAZORPAY_KEY_ID` | Same test-mode Key ID used for `RAZORPAY_KEY_ID` above |

5. Click **Deploy**
6. Note your frontend URL: `https://divya-foods.vercel.app`

---

## Step 4 — Wire CORS (critical)

1. Go back to **Railway → your backend service → Variables**
2. Update `ALLOWED_ORIGINS` with the real Vercel URL:
   ```
   ["https://divya-foods.vercel.app","https://www.divyafoods.com"]
   ```
3. Save → Railway redeploys automatically

---

## Step 5 — Custom domain (www.divyafoods.com)

### Vercel
1. Vercel Dashboard → Settings → Domains → Add `www.divyafoods.com`
2. Vercel shows a CNAME record to add
3. Log in to your domain registrar and add:
   ```
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```
4. DNS propagates in 5–30 minutes

### Root domain redirect (optional)
In your registrar, also add an A record for `@` (bare domain) pointing to `76.76.21.21` (Vercel's IP).

---

## Step 6 — Confirm database backups are actually on

This app moves real money through real orders — an unrecoverable database
loss isn't just an inconvenience, it's lost customer orders and payment
history. Atlas's **M0 free tier has no continuous backup at all**; only paid
tiers (M10+) include Cloud Backup with point-in-time recovery.

1. Atlas Dashboard → your cluster → confirm the tier. If it's M0, upgrade
   before taking real payments — an M0 cluster losing data has no way back.
2. On a paid tier: **Backup** tab → confirm Cloud Backup is enabled and note
   the retention window.
3. Do one manual restore drill (Atlas → Backup → restore a snapshot to a
   temporary cluster) before launch — an untested backup is not a backup.

---

## Step 7 — Verify everything works

- [ ] `https://www.divyafoods.com` loads the shop
- [ ] `https://YOUR-RAILWAY-URL/health` returns `{"status":"healthy"}`
- [ ] User can register, login, add to cart
- [ ] Test order with Razorpay test card: `4111 1111 1111 1111`, any future date, CVV `123`
- [ ] Order confirmation email arrives at customer's inbox

---

## Going live with Razorpay

When you're ready to accept real payments:
1. Login to Razorpay Dashboard → switch to **Live Mode**
2. Copy your live Key ID and Key Secret
3. Update on **Railway**: `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
4. Update on **Vercel**: `VITE_RAZORPAY_KEY_ID`
5. Redeploy both (Railway redeploys on env var change; Vercel needs a manual redeploy or new commit)

No code changes needed — keys are purely environment-driven.

---

## Continuous deployment

After initial setup, every `git push origin main` automatically rebuilds and
redeploys the **backend on Railway** — Railway's GitHub integration handles
this with no extra step.

The **frontend on Vercel does NOT auto-deploy on push** — this project's
Vercel project has no GitHub integration wired up. After pushing frontend
changes, deploy manually from the repo root:

```bash
vercel --prod
```

(If you set up Vercel's GitHub integration yourself, this section no longer
applies — check your Vercel project's Settings → Git to confirm one way or
the other before assuming either behavior.)

---

## Local development (unchanged)

```bash
# Terminal 1 — backend
cd backend && uvicorn app.main:app --reload

# Terminal 2 — frontend
npm run dev
```
