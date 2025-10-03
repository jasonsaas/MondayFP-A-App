# 🚀 Deployment Guide - MVP

## Quick Deploy (5 Minutes)

### Step 1: Push to GitHub
```bash
# Remove workflow files (they need special permissions)
rm -rf .github/workflows

# Stage and commit
git add -A
git commit -m "Complete MVP: Working variance analyzer"
git push origin main
```

### Step 2: Vercel (Auto-deploys)
Vercel is already connected to your GitHub repo. It will auto-deploy when you push.

### Step 3: Set Environment Variables in Vercel

Go to: https://vercel.com/YOUR_PROJECT/settings/environment-variables

Add these:

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Monday.com OAuth
MONDAY_CLIENT_ID=your-monday-client-id
MONDAY_CLIENT_SECRET=your-monday-client-secret
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# QuickBooks OAuth
QUICKBOOKS_CLIENT_ID=your-qb-client-id
QUICKBOOKS_CLIENT_SECRET=your-qb-client-secret
QUICKBOOKS_ENVIRONMENT=production

# Security
JWT_SECRET=your-random-64-char-string
ENCRYPTION_KEY=your-random-64-char-string
CRON_SECRET=your-random-secret-for-cron

# Optional (for production)
REDIS_URL=redis://your-redis-url (optional - has fallback)
SENTRY_DSN=your-sentry-dsn (optional)
```

### Step 4: Run Database Migrations

```bash
# From your local machine (with DATABASE_URL set)
npm run db:push

# This creates the tables if they don't exist
```

### Step 5: Test It!

1. Visit: `https://your-app.vercel.app/setup`
2. Connect Monday.com
3. Connect QuickBooks
4. Click "Run First Sync"
5. View dashboard at `/dashboard/variance`

## Environment Variables Explained

### Required

**DATABASE_URL**
- Your PostgreSQL connection string
- Get from: Vercel Postgres, Supabase, or Neon
- Format: `postgresql://user:pass@host:5432/dbname`

**MONDAY_CLIENT_ID** & **MONDAY_CLIENT_SECRET**
- From Monday Apps dashboard
- https://monday.com/developers/apps

**QUICKBOOKS_CLIENT_ID** & **QUICKBOOKS_CLIENT_SECRET**
- From Intuit Developer Portal
- https://developer.intuit.com/

**NEXT_PUBLIC_APP_URL**
- Your production URL
- Example: `https://fpna-analyzer.vercel.app`

**JWT_SECRET**
- Random 64-character string
- Generate: `openssl rand -base64 48`

**ENCRYPTION_KEY**
- Random 64-character string
- Generate: `openssl rand -base64 48`

**CRON_SECRET**
- Secret for cron endpoint authentication
- Generate: `openssl rand -hex 32`

### Optional

**REDIS_URL**
- For caching (has in-memory fallback)
- Get from: Upstash Redis (free tier)

**SENTRY_DSN**
- For error tracking
- Get from: sentry.io

## Vercel Cron Jobs

Already configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "0 */4 * * *"
    }
  ]
}
```

This runs `/api/cron/sync` every 4 hours automatically.

**Verify it's working:**
1. Go to Vercel dashboard → Cron tab
2. See job listed
3. Check logs after first run

## Database Setup

### Option 1: Vercel Postgres (Easiest)
```bash
# In Vercel dashboard
1. Go to Storage tab
2. Create Postgres database
3. Copy DATABASE_URL
4. Add to environment variables
```

### Option 2: Supabase (Free tier)
```bash
1. Go to supabase.com
2. Create new project
3. Go to Settings → Database
4. Copy connection string (pooler)
5. Add to environment variables
```

### Option 3: Neon (Serverless)
```bash
1. Go to neon.tech
2. Create new project
3. Copy connection string
4. Add to environment variables
```

### Run Migrations

```bash
# Make sure DATABASE_URL is set in .env.local
npm run db:push

# You should see:
# ✓ Tables created
# ✓ Migrations applied
```

## OAuth Setup

### Monday.com

1. Go to: https://monday.com/developers/apps
2. Create new app
3. Add OAuth redirect URL:
   ```
   https://your-app.vercel.app/api/auth/monday/callback
   ```
4. Copy Client ID and Secret
5. Add to Vercel environment variables

### QuickBooks

1. Go to: https://developer.intuit.com/
2. Create new app
3. Add Redirect URI:
   ```
   https://your-app.vercel.app/api/auth/quickbooks/callback
   ```
4. Copy Client ID and Client Secret
5. Add to Vercel environment variables
6. Set QUICKBOOKS_ENVIRONMENT=production

## Troubleshooting

### Deployment Fails

**Issue:** Build errors
**Fix:** Check build logs in Vercel, likely missing env vars

### Cron Not Running

**Issue:** No syncs happening
**Fix:**
1. Check Vercel → Cron tab
2. Verify `CRON_SECRET` is set
3. Check function logs

### Database Connection Issues

**Issue:** Can't connect to database
**Fix:**
1. Verify DATABASE_URL format
2. Check firewall allows Vercel IPs
3. Try connection pooling URL

### OAuth Redirect Issues

**Issue:** OAuth fails
**Fix:**
1. Verify redirect URLs match exactly
2. Check NEXT_PUBLIC_APP_URL is correct
3. Verify client ID/secret

## Testing Locally

```bash
# Install dependencies
npm install

# Set up .env.local with all variables
cp .env.example .env.local
# Edit .env.local with your values

# Run database setup
npm run db:push

# Start dev server
npm run dev

# Visit http://localhost:3000/setup
```

## Production Checklist

Before going live:

- [ ] All environment variables set in Vercel
- [ ] Database migrations run
- [ ] OAuth apps configured (Monday + QuickBooks)
- [ ] Redirect URLs point to production domain
- [ ] Cron job enabled in Vercel
- [ ] Test /setup flow end-to-end
- [ ] Test /dashboard/variance shows data
- [ ] Test manual sync button works
- [ ] Check cron runs (wait 4 hours or trigger manually)

## Monitoring

### Check Sync Status

```bash
# View cron job logs
vercel logs --app=your-app

# Check last sync
# Visit: /api/variance/current
# Look at lastSync timestamp
```

### Check Database

```bash
# Connect to database
psql $DATABASE_URL

# Check variance snapshots
SELECT id, period, created_at
FROM variance_snapshots
ORDER BY created_at DESC
LIMIT 5;

# Check organizations
SELECT id, monday_account_name,
       monday_access_token IS NOT NULL as has_monday,
       quickbooks_access_token IS NOT NULL as has_qb
FROM organizations;
```

## Going Live

1. ✅ Push code to GitHub
2. ✅ Vercel auto-deploys
3. ✅ Set environment variables
4. ✅ Run database migrations
5. ✅ Test OAuth flows
6. ✅ Verify cron jobs working
7. 🎉 Share with first customer!

## Support

If you run into issues:
1. Check Vercel function logs
2. Check database connection
3. Verify environment variables
4. Test OAuth redirect URLs
5. Check cron job configuration

---

**Total deploy time:** ~5 minutes
**Prerequisites:** GitHub + Vercel account
**Cost:** Free tier covers first customers
