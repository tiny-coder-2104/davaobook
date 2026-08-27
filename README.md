# DavaoBook

Tour booking PWA for Davao City & Samal Island.

## Deploy

```bash
# Local dev
npm install
npm run dev

# Production build
npm run build
```

Vercel auto-deploys from the monorepo. Region: `hnd1` (closest to PH).

## Environment Variables

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase key (bypasses RLS) |
| `SEMAPHORE_API_KEY` | Semaphore SMS API key |
| `SEMAPHORE_SENDER_NAME` | SMS sender ID (default: DavaoBook) |
| `CRON_SECRET` | Shared secret for cron endpoints (generate a random 32-char string) |

## Cron Setup

Two endpoints keep the system running without manual intervention:

### Expiry Sweep (`/api/cron/expiry`)

Hourly job that:
1. Expires PENDING_PAYMENT bookings older than 24h → frees slot + sends apology SMS
2. Auto-declines PENDING_CONFIRMATION bookings older than 48h (silent)
3. Sends reminder SMS to CONFIRMED bookings whose tour is tomorrow

### Keep-Alive (`/api/cron/keepalive`)

Weekly ping to Supabase to prevent free-tier project pause.

### Setting Up with cron-job.org

1. Go to [cron-job.org](https://cron-job.org) and create an account
2. Create two jobs:

**Expiry sweep (hourly):**
- URL: `https://your-domain.vercel.app/api/cron/expiry`
- Schedule: `0 * * * *` (every hour)
- HTTP Method: GET
- Headers: `Authorization: Bearer {CRON_SECRET}`

**Keep-alive (weekly):**
- URL: `https://your-domain.vercel.app/api/cron/keepalive`
- Schedule: `0 0 * * 0` (every Sunday midnight)
- HTTP Method: GET
- Headers: `Authorization: Bearer {CRON_SECRET}`

Both endpoints also accept POST. The `CRON_SECRET` must match the env var in Vercel.

## Tech Stack

- Next.js 14 (App Router)
- TypeScript (strict)
- Tailwind CSS with custom design tokens
- Manrope (headings) + Inter (body) via next/font
