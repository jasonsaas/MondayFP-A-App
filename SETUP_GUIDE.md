# FP&A Platform Setup Guide

## ✅ Completed Implementation

### Authentication & Authorization
- ✅ Monday OAuth 2.0 integration
- ✅ JWT-based session management
- ✅ Multi-tenant architecture with organizations
- ✅ Protected routes via middleware
- ✅ Secure callback handlers

### Database & ORM
- ✅ PostgreSQL schema with Drizzle ORM
- ✅ Organization and user tables
- ✅ Integration settings storage
- ✅ Variance analysis data models
- ✅ Migrations generated

### API Routes
- ✅ `/api/auth/monday/login` - Initiate OAuth flow
- ✅ `/api/auth/monday/callback` - Handle OAuth callback
- ✅ `/api/auth/logout` - Session termination
- ✅ `/api/variance/analyze` - Run variance analysis
- ✅ `/api/webhooks/n8n` - n8n automation webhooks

### Integrations
- ✅ Monday.com GraphQL API client
- ✅ QuickBooks REST API client
- ✅ n8n webhook handlers
- ✅ Variance calculation engine

## 🚀 Quick Start

### 1. Create Monday.com OAuth App

1. Go to https://auth.monday.com/developers
2. Click "Create App"
3. Set these values:
   - **Name**: FP&A Variance Analyzer
   - **Redirect URLs**: `http://localhost:3000/api/auth/monday/callback`
   - **Scopes**: `me:read`, `boards:read`, `workspaces:read`
4. Copy your **Client ID** and **Client Secret**

### 2. Create QuickBooks OAuth App

1. Go to https://developer.intuit.com/
2. Create a new app
3. Get OAuth credentials:
   - **Client ID**
   - **Client Secret**
4. Set redirect URI: `http://localhost:3000/api/auth/quickbooks/callback`

### 3. Set Up Environment Variables

Create `.env.local`:

```bash
# Database (use Neon, Supabase, or local PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/fpa_platform"

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET="your-secure-random-secret-here"

# Monday OAuth
MONDAY_CLIENT_ID="your-monday-client-id"
MONDAY_CLIENT_SECRET="your-monday-client-secret"
MONDAY_REDIRECT_URI="http://localhost:3000/api/auth/monday/callback"

# QuickBooks OAuth
QUICKBOOKS_CLIENT_ID="your-qb-client-id"
QUICKBOOKS_CLIENT_SECRET="your-qb-client-secret"
QUICKBOOKS_REDIRECT_URI="http://localhost:3000/api/auth/quickbooks/callback"

# n8n Webhooks (generate with: openssl rand -hex 32)
N8N_WEBHOOK_SECRET="your-n8n-webhook-secret"
N8N_WEBHOOK_URL="https://your-n8n-instance.com/webhook/fpa"

# App Config
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Initialize Database

```bash
# Install dependencies
npm install

# Generate and run migrations
npm run db:generate
npm run db:push

# Verify schema
npm run db:studio
```

### 5. Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000 and sign in with Monday.com!

## 🔧 n8n Workflow Setup

### Create n8n Workflow

1. Install n8n: `npm install -g n8n`
2. Run n8n: `n8n start`
3. Create a new workflow with these nodes:

**Node 1: Webhook Trigger**
- URL: `/webhook/fpa-trigger`
- Method: POST

**Node 2: HTTP Request to FP&A API**
```json
{
  "url": "https://your-app.vercel.app/api/webhooks/n8n",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer YOUR_N8N_WEBHOOK_SECRET",
    "Content-Type": "application/json"
  },
  "body": {
    "action": "run_analysis",
    "data": {
      "userId": "{{$json.userId}}",
      "boardId": "{{$json.boardId}}",
      "startDate": "{{$json.startDate}}",
      "endDate": "{{$json.endDate}}"
    }
  }
}
```

**Node 3: Send Notification (Slack/Email)**
- Configure based on your preference

### Example: Scheduled Weekly Analysis

```json
{
  "nodes": [
    {
      "name": "Weekly Schedule",
      "type": "n8n-nodes-base.cron",
      "parameters": {
        "triggerTimes": {
          "item": [
            {
              "mode": "everyWeek",
              "weekday": 1,
              "hour": 9
            }
          ]
        }
      }
    },
    {
      "name": "Run Variance Analysis",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://your-app.vercel.app/api/webhooks/n8n",
        "method": "POST",
        "authentication": "headerAuth",
        "headerAuth": {
          "name": "Authorization",
          "value": "=Bearer {{$env.N8N_WEBHOOK_SECRET}}"
        },
        "bodyParametersJson": "{\n  \"action\": \"run_analysis\",\n  \"data\": {\n    \"userId\": \"user-id\",\n    \"boardId\": \"board-id\",\n    \"startDate\": \"2024-01-01\",\n    \"endDate\": \"2024-12-31\"\n  }\n}"
      }
    }
  ]
}
```

## 📊 Usage Examples

### Run Variance Analysis via API

```bash
curl -X POST https://your-app.vercel.app/api/variance/analyze \
  -H "Cookie: session=YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "boardId": "1234567890",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "analysisName": "Q4 2024 Variance Analysis"
  }'
```

### Trigger via n8n Webhook

```bash
curl -X POST https://your-app.vercel.app/api/webhooks/n8n \
  -H "Authorization: Bearer YOUR_N8N_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "run_analysis",
    "data": {
      "userId": "user-id",
      "boardId": "board-id",
      "startDate": "2024-01-01",
      "endDate": "2024-12-31"
    }
  }'
```

## 🚢 Deployment

### Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
vercel env add DATABASE_URL
vercel env add JWT_SECRET
# ... add all other env vars
```

### Railway (for n8n)

```bash
# Deploy n8n to Railway
railway login
railway init
railway up
```

### Neon (Database)

1. Create account at https://neon.tech
2. Create a new project
3. Copy connection string to `DATABASE_URL`

## 🔐 Security Checklist

- [ ] Set strong `JWT_SECRET` (32+ characters)
- [ ] Use HTTPS in production
- [ ] Enable CORS only for trusted domains
- [ ] Rotate OAuth secrets regularly
- [ ] Set up rate limiting on API routes
- [ ] Enable database SSL connections
- [ ] Use environment variables, never hardcode secrets
- [ ] Set up monitoring and logging
- [ ] Configure proper CSRF protection
- [ ] Review middleware security headers

## 📚 Next Steps

1. **Connect QuickBooks**: Implement QuickBooks OAuth flow
2. **Add Sage Intacct**: Build Sage Intacct integration
3. **Create Dashboards**: Build analytics dashboard
4. **Set up Notifications**: Email/Slack alerts for critical variances
5. **Add Export Features**: CSV/PDF report generation
6. **Implement Caching**: Redis for API response caching
7. **Set up CI/CD**: GitHub Actions for automated deployment

## 🐛 Troubleshooting

### OAuth Callback Issues
- Verify redirect URLs match exactly in OAuth app settings
- Check that `MONDAY_REDIRECT_URI` in `.env` matches callback URL
- Ensure app is running on the correct port

### Database Connection Errors
- Verify `DATABASE_URL` format is correct
- Check database is accessible from your network
- Run migrations: `npm run db:push`

### Middleware Authentication Failures
- Clear browser cookies
- Verify `JWT_SECRET` is set
- Check session cookie is being sent with requests

## 💡 Support

- Documentation: `/docs` (coming soon)
- Issues: https://github.com/jasonsaas/MondayFP-A-App/issues
- Monday.com Developer Docs: https://developer.monday.com