# SkeduAI

AI school schedule assistant. Upload a photo of your class schedule, AI reads it into structured data, you review it, and it syncs into **Google Calendar** as weekly recurring events — plus a nightly 9:00 PM push reminder to double-check your classes, tasks, and due dates.

Everything runs on **free tiers**: Google Gemini (free API key), Vercel (free hosting + free cron), Neon (free Postgres) or local SQLite, browser Web Push (free). No OpenAI, no paid services.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- NextAuth v5 (Auth.js) with Google OAuth — login also grants Calendar access
- Prisma ORM — SQLite locally, Postgres (Neon) in production, same schema
- Google Gemini 2.0 Flash — free-tier vision/text model for extraction
- Google Calendar API — weekly recurring events (RRULE)
- Web Push + Vercel Cron — the 9:00 PM nightly reminder
- Blackboard: no official student API, so "Paste from BBL" lets the AI parse pasted assignment text into tasks with due dates

## Setup (local)

### 1. Install and configure env

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to get it |
| --- | --- |
| `GEMINI_API_KEY` | Free key at [Google AI Studio](https://aistudio.google.com/apikey) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) — see below |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys --json` |
| `VAPID_SUBJECT` | `mailto:you@example.com` |
| `CRON_SECRET` | Any long random string |

`DATABASE_URL` already points to a local SQLite file — nothing to install.

### 2. Google OAuth (one-time)

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. Create a project, then enable the **Google Calendar API** (APIs & Services → Library).
3. Configure the **OAuth consent screen**: External, Testing, add your own email as a test user. (Testing status is fine for a personal app — you'll just see a warning screen when logging in.)
4. Create an **OAuth Client ID** of type Web Application.
5. Add Authorized JavaScript origins: `http://localhost:3000` and later your production domain (e.g. `https://your-app.vercel.app`).
6. Add Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` (and the same for your production domain).
7. Put the client ID and secret in `.env.local`.

### 3. Database

```bash
npx prisma db push   # creates dev.db and the tables
```

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000, sign in with Google, and you're in.

## Usage

1. **Upload your schedule** — drag a photo/screenshot of your timetable. Review what the AI read, edit if needed, then "Add to Google Calendar" (creates weekly recurring events).
2. **Paste from BBL** — copy assignments from Blackboard, paste, extract due dates, save.
3. **Reminder** — toggle it on (browser will ask for notification permission) and press "Test reminder" to verify. Every night at 9:00 PM Asia/Manila you'll get a push notification summarizing today's classes, due-today tasks, and overdue items.

## Testing the cron locally

The nightly reminder is a cron endpoint. Locally, trigger it manually:

```bash
curl -H "x-cron-secret: <your CRON_SECRET>" http://localhost:3000/api/cron
```

It returns JSON like `{ "ok": true, "users": 1, "totalSent": 1 }`.

## Deploying for free (Vercel + Neon)

1. Push this repo to GitHub.
2. Create a free account at [vercel.com](https://vercel.com) and import the repo — it deploys automatically (the included `vercel.json` registers the cron job; free plan allows it).
3. Create a free database at [neon.tech](https://neon.tech), copy the connection string.
4. In Vercel → Project → Settings → Environment Variables, add every variable from `.env.example`:
   - `DATABASE_URL` = your **Neon** Postgres connection string (for Postgres, first push the schema with `npx prisma migrate deploy` using a local `DATABASE_URL` env override pointing at Neon).
   - `NEXTAUTH_URL` = `https://<your-project>.vercel.app`
   - Add your Vercel domain as an authorized origin + redirect URI in Google Cloud (step 2 above).
5. Redeploy. That's it — no paid services.

## Notes

- Reminder time and timezone are stored per-user in the database (defaults: 21:00, Asia/Manila).
- Classes sync back: editing or deleting a schedule updates/deletes the Google Calendar event.
- No API keys ever leave the server — the browser only sees the VAPID public key.
