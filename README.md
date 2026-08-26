# DavaoBook

A white-label tour booking PWA for Davao/Samal operators. Built with Next.js 14, Supabase, and Vercel.

## Features

- **Public booking flow**: Package grid → calendar picker → guest form → payment → voucher
- **Operator admin**: Today dashboard, bookings management, calendar with blocks, weather blast
- **PWA**: Offline support, installable, service worker with caching strategies
- **SMS**: Confirmation, expiry, reminder, weather cancel via Semaphore

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **SMS**: Semaphore API
- **Deployment**: Vercel

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Fill in your Supabase and Semaphore credentials

# Run development server
npm run dev

# Build for production
npm run build
```

## Environment Variables

See `.env.example` for required variables.

## Database Setup

1. Create a Supabase project
2. Run `supabase/migrations/001_init.sql` in the SQL Editor
3. Run `supabase/migrations/002_create_booking_fn.sql`

## Deployment

### Vercel

1. Push to GitHub
2. Import repository in Vercel
3. Set root directory to `/` (this is a standalone repo)
4. Add environment variables
5. Deploy

### Cron Jobs

Set up via [cron-job.org](https://cron-job.org):

- **Hourly**: `https://your-domain.vercel.app/api/cron/expiry` (Authorization: Bearer {CRON_SECRET})
- **Weekly**: `https://your-domain.vercel.app/api/cron/keepalive`

## License

MIT
