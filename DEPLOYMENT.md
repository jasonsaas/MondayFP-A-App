# FP&A Platform - Production Deployment Guide

Complete guide for deploying the Monday.com FP&A marketplace application to production.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Database Setup](#database-setup)
- [Vercel Deployment](#vercel-deployment)
- [GitHub Actions CI/CD](#github-actions-cicd)
- [Monitoring Setup](#monitoring-setup)
- [Post-Deployment Checklist](#post-deployment-checklist)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts

1. **Vercel Account** - For hosting the Next.js application
2. **Neon/Supabase** - For PostgreSQL database
3. **Upstash** - For Redis cache (optional but recommended)
4. **Sentry** - For error tracking and monitoring
5. **Monday.com Developer** - For marketplace app credentials
6. **QuickBooks Developer** - For OAuth credentials

### Local Development Tools

- Node.js 20+
- npm or pnpm
- Docker & Docker Compose (for local development)
- Git

---

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/fpna-platform.git
cd fpna-platform
```

### 2. Copy Environment Template

```bash
cp .env.example .env.local
```

### 3. Configure Environment Variables

Edit `.env.local` and fill in all required values:

#### **Critical Variables** (Must configure before deployment)

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/database

# Redis
REDIS_URL=redis://user:pass@host:6379

# Monday.com OAuth
MONDAY_CLIENT_ID=your_client_id
MONDAY_CLIENT_SECRET=your_client_secret
MONDAY_REDIRECT_URI=https://yourapp.com/api/auth/monday/callback
MONDAY_SIGNING_SECRET=your_signing_secret

# QuickBooks OAuth
QUICKBOOKS_CLIENT_ID=your_client_id
QUICKBOOKS_CLIENT_SECRET=your_client_secret
QUICKBOOKS_REDIRECT_URI=https://yourapp.com/api/auth/quickbooks/callback

# Security
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://xxx@o0.ingest.sentry.io/xxx
```

---

## Database Setup

### Option 1: Neon (Recommended)

1. **Create Account**: https://neon.tech
2. **Create Project**: FP&A Platform
3. **Get Connection String**:
   ```
   postgresql://user:pass@ep-cool-name.us-east-2.aws.neon.tech/neondb
   ```
4. **Run Migrations**:
   ```bash
   psql $DATABASE_URL -f db/migrations/001_initial.sql
   ```

### Option 2: Supabase

1. **Create Project**: https://supabase.com
2. **Get Connection String** from Settings → Database
3. **Run Migrations**:
   ```bash
   psql $DATABASE_URL -f db/migrations/001_initial.sql
   ```

### Option 3: Railway

1. **Create Account**: https://railway.app
2. **Add PostgreSQL Plugin**
3. **Copy DATABASE_URL** from Variables tab
4. **Run Migrations**

### Verify Database

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# List tables
psql $DATABASE_URL -c "\dt"

# Seed demo data (optional)
npm run seed:demo
```

---

## Vercel Deployment

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Login to Vercel

```bash
vercel login
```

### 3. Link Project

```bash
vercel link
```

### 4. Configure Environment Variables in Vercel

```bash
# Set production environment variables
vercel env add DATABASE_URL production
vercel env add REDIS_URL production
vercel env add MONDAY_CLIENT_ID production
vercel env add MONDAY_CLIENT_SECRET production
vercel env add QUICKBOOKS_CLIENT_ID production
vercel env add QUICKBOOKS_CLIENT_SECRET production
vercel env add JWT_SECRET production
vercel env add ENCRYPTION_KEY production
vercel env add NEXT_PUBLIC_SENTRY_DSN production
```

Or use the Vercel Dashboard:
1. Go to Project Settings → Environment Variables
2. Add all variables from `.env.example`
3. Set values for production

### 5. Deploy to Production

```bash
# Deploy manually
vercel --prod

# Or push to main branch (GitHub Actions will auto-deploy)
git push origin main
```

### 6. Configure Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your custom domain
3. Update DNS records
4. Update environment variables:
   ```bash
   NEXT_PUBLIC_APP_URL=https://yourapp.com
   MONDAY_REDIRECT_URI=https://yourapp.com/api/auth/monday/callback
   QUICKBOOKS_REDIRECT_URI=https://yourapp.com/api/auth/quickbooks/callback
   ```

---

## GitHub Actions CI/CD

### 1. Configure GitHub Secrets

Go to Repository Settings → Secrets and add:

```
VERCEL_TOKEN - Get from https://vercel.com/account/tokens
VERCEL_ORG_ID - From .vercel/project.json
VERCEL_PROJECT_ID - From .vercel/project.json
SENTRY_AUTH_TOKEN - Get from Sentry settings
SENTRY_ORG - Your Sentry organization slug
SENTRY_PROJECT - Your Sentry project slug
SLACK_WEBHOOK_URL - (Optional) For deployment notifications
SNYK_TOKEN - (Optional) For security scanning
```

### 2. Workflow Triggers

The CI/CD pipeline automatically runs on:

- **Pull Requests** → Deploy preview
- **Push to `main`** → Deploy production
- **Push to `develop`** → Deploy staging

### 3. Manual Deployment

```bash
# Trigger workflow manually
gh workflow run deploy.yml
```

---

## Monitoring Setup

### 1. Sentry Error Tracking

1. **Create Project**: https://sentry.io/organizations/your-org/projects/
2. **Get DSN**: Settings → Client Keys (DSN)
3. **Add to Environment**:
   ```bash
   NEXT_PUBLIC_SENTRY_DSN=https://xxx@o0.ingest.sentry.io/xxx
   SENTRY_ORG=your-org
   SENTRY_PROJECT=fpna-platform
   SENTRY_AUTH_TOKEN=your-token
   ```
4. **Deploy**: Sentry will automatically capture errors

### 2. Health Checks

Configure uptime monitoring (e.g., UptimeRobot, Pingdom):

- **Endpoint**: `https://yourapp.com/api/health`
- **Method**: GET
- **Interval**: 5 minutes
- **Expected Status**: 200
- **Alert**: On status ≠ 200

### 3. Performance Monitoring

Sentry automatically tracks:
- API route performance
- Database query times
- External API calls (Monday, QuickBooks)
- Frontend Core Web Vitals

---

## Post-Deployment Checklist

### Security

- [ ] All secrets rotated from defaults
- [ ] HTTPS enforced (automatic on Vercel)
- [ ] Security headers configured (via middleware.ts)
- [ ] Rate limiting enabled
- [ ] CORS configured for Monday.com and QuickBooks
- [ ] OAuth callback URLs whitelisted

### OAuth Configuration

- [ ] Monday.com app published to marketplace
- [ ] QuickBooks app configured with correct redirect URIs
- [ ] OAuth scopes match application needs
- [ ] Test OAuth flow with `npm run test:oauth`

### Database

- [ ] Migrations applied
- [ ] Indexes created
- [ ] Backups configured
- [ ] Connection pooling optimized

### Monitoring

- [ ] Sentry receiving errors
- [ ] Health check endpoint responding
- [ ] Uptime monitor configured
- [ ] Logs accessible via Vercel dashboard

### Performance

- [ ] Redis cache connected
- [ ] CDN enabled for static assets
- [ ] Response times < 500ms for API routes
- [ ] Database queries optimized

### Testing

- [ ] Run end-to-end OAuth flow
- [ ] Test Monday.com board sync
- [ ] Test QuickBooks data sync
- [ ] Test variance calculation
- [ ] Verify webhook endpoints

---

## Troubleshooting

### Database Connection Issues

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check pool settings
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
```

### OAuth Redirect Errors

1. Verify redirect URIs match exactly in:
   - Monday.com app settings
   - QuickBooks app settings
   - Environment variables (`MONDAY_REDIRECT_URI`, `QUICKBOOKS_REDIRECT_URI`)

2. Check URL encoding
3. Ensure HTTPS in production

### Rate Limiting Issues

Adjust limits in `middleware.ts`:

```typescript
const allowed = rateLimit(ip, 200, 60000); // 200 req/min
```

### Sentry Not Capturing Errors

1. Check DSN is correct
2. Verify `NODE_ENV=production`
3. Check sample rate: `SENTRY_TRACES_SAMPLE_RATE=0.1`

### Performance Issues

1. **Check Database Queries**:
   ```sql
   SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;
   ```

2. **Enable Redis**:
   ```bash
   REDIS_URL=redis://...
   ```

3. **Optimize Indexes**:
   ```sql
   CREATE INDEX CONCURRENTLY idx_name ON table(column);
   ```

---

## Rollback Procedure

### Quick Rollback (Vercel)

```bash
# List deployments
vercel ls

# Promote previous deployment
vercel promote <deployment-url>
```

### Database Rollback

```bash
# Backup current state
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore previous backup
psql $DATABASE_URL < backup_20250101_120000.sql
```

---

## Support

- **Documentation**: https://docs.yourapp.com
- **Status Page**: https://status.yourapp.com
- **GitHub Issues**: https://github.com/your-org/fpna-platform/issues
- **Support Email**: support@yourapp.com

---

## Additional Resources

- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Vercel Documentation](https://vercel.com/docs)
- [Monday.com Apps SDK](https://developer.monday.com/apps)
- [QuickBooks API](https://developer.intuit.com/app/developer/qbo/docs/get-started)
- [Sentry for Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
