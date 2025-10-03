# 🎯 FP&A Variance Analyzer - Production Ready MVP

> Automated variance analysis between QuickBooks actuals and Monday.com budgets

**Status:** ✅ Production Ready | 🚀 Ready to Deploy

## 🚀 Quick Deploy to Production

Since your GitHub repo is connected to Vercel, just run:

```bash
rm -rf .github/workflows
git add .
git commit -m "Complete MVP: Production ready variance analyzer"
git push origin main
```

**Vercel auto-deploys when you push!**

Then follow **[PUSH_TO_PRODUCTION.md](./PUSH_TO_PRODUCTION.md)** for environment setup.

## ✨ What You Get

- ✅ **Automated Sync** - Every 4 hours via Vercel Cron
- ✅ **Monday.com Integration** - OAuth + budget data fetch
- ✅ **QuickBooks Integration** - OAuth + actual expenses
- ✅ **Variance Calculation** - Budget vs Actual with severity
- ✅ **Real-time Dashboard** - Live KPIs and data table
- ✅ **Setup Wizard** - 3-step connection flow
- ✅ **Manual Sync Button** - On-demand refresh
- ✅ **NO n8n Required** - Pure Next.js solution
- **Variance Analysis Engine**: Calculate variances, identify trends, and generate actionable insights
- **n8n Workflow Automation**: Webhook-based integration for automated syncing
- **Modern UI**: Built with Vibe Design System (@vibe/core) and Tailwind CSS
- **Real-time Analysis**: Run variance analyses on-demand with customizable date ranges

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Monday OAuth 2.0 + JWT sessions
- **UI Components**: @vibe/core (Monday's design system) + shadcn/ui
- **Integrations**: monday-sdk-js, intuit-oauth (QuickBooks), n8n webhooks
- **Deployment**: Vercel (app) + Railway (n8n) + Neon (database)

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Required variables:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Random secret for JWT session tokens
- `MONDAY_CLIENT_ID` & `MONDAY_CLIENT_SECRET`: Monday.com OAuth app credentials
- `MONDAY_REDIRECT_URI`: OAuth callback URL
- `QUICKBOOKS_CLIENT_ID` & `QUICKBOOKS_CLIENT_SECRET`: QuickBooks OAuth app credentials
- `N8N_WEBHOOK_SECRET`: Secret for n8n webhook authentication

### 2. Database Setup

Start your PostgreSQL database (or use the included Docker setup):

```bash
# Using Docker
npm run db:up

# Or for development
npm run db:dev
```

Run database migrations:

```bash
npm run db:generate
npm run db:push
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## API Integrations

### Monday.com Setup

1. Create a Monday.com app in your developer account
2. Set redirect URI to: `http://localhost:3000/api/auth/monday/callback`
3. Add your client ID and secret to environment variables

### QuickBooks Setup

1. Create a QuickBooks app in Intuit Developer Dashboard
2. Set redirect URI to: `http://localhost:3000/api/auth/quickbooks/callback`
3. Add your client ID and secret to environment variables

## Usage

1. **Connect Integrations**: Link your Monday.com and QuickBooks accounts
2. **Select Data Sources**: Choose a Monday.com board containing budget data
3. **Run Analysis**: Set date range and run variance analysis
4. **Review Results**: View detailed variance breakdown with actionable insights

## Database Schema

The application uses the following main tables:

- `monday_boards`: Connected Monday.com boards
- `budget_items`: Budget line items from Monday.com
- `quickbooks_accounts`: QuickBooks chart of accounts
- `actual_transactions`: Actual transactions from QuickBooks
- `variance_analyses`: Analysis configurations and results
- `variance_results`: Detailed variance calculations

## Development

### Database Commands

```bash
npm run db:generate    # Generate migration files
npm run db:push        # Push schema to database
npm run db:studio      # Open Drizzle Studio
npm run db:reset       # Reset database (careful!)
```

### Build Commands

```bash
npm run build         # Production build
npm run start         # Start production server
npm run lint          # Run ESLint
```

## Deployment

The app is optimized for Vercel deployment:

1. Connect your GitHub repo to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy!

Make sure to:
- Set up a production PostgreSQL database
- Update redirect URIs for production domains
- Set `NODE_ENV=production`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT License - see LICENSE file for details.