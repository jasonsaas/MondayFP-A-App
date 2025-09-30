# Monday.com FP&A Variance Analyzer

A Next.js application that integrates with Monday.com and QuickBooks to perform financial variance analysis, comparing budgets with actuals.

## Features

- **Monday.com Integration**: Fetch budget data from Monday.com boards
- **QuickBooks Integration**: Pull actual transaction data from QuickBooks
- **Variance Analysis Engine**: Calculate variances, identify trends, and generate actionable insights
- **Modern UI**: Built with Vibe Design System (@vibe/core) and Tailwind CSS
- **Real-time Analysis**: Run variance analyses on-demand with customizable date ranges

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better Auth
- **UI Components**: @vibe/core (Monday's design system) + shadcn/ui
- **Integrations**: monday-sdk-js, intuit-oauth (QuickBooks)
- **Deployment**: Vercel-ready

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Required variables:
- `DATABASE_URL`: PostgreSQL connection string
- `BETTER_AUTH_SECRET`: Random secret for authentication
- `MONDAY_CLIENT_ID` & `MONDAY_CLIENT_SECRET`: Monday.com app credentials
- `QUICKBOOKS_CLIENT_ID` & `QUICKBOOKS_CLIENT_SECRET`: QuickBooks app credentials

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