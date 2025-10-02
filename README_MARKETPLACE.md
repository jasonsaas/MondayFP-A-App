# FP&A Variance Analyzer - Monday.com Marketplace App

> **Automated variance analysis between QuickBooks actuals and Monday budgets**

[![Next.js 15](https://img.shields.io/badge/Next.js-15.5.0-black)](https://nextjs.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-0.44.5-green)](https://orm.drizzle.team/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 What This Does

This Monday.com marketplace app connects your **QuickBooks P&L data** with **Monday.com boards** to automatically:

- 📊 Calculate budget vs actual variances in real-time
- 🔔 Alert you when spending exceeds thresholds
- 📈 Display beautiful variance dashboards
- 🔄 Sync data automatically between QuickBooks and Monday
- 📱 Embed directly into Monday boards and dashboards

## ✨ Features

### 🔐 Dual OAuth Integration
- **Monday.com OAuth** - Seamless authentication via Monday marketplace
- **QuickBooks OAuth** - Secure connection to QuickBooks Online
- Session management with JWT tokens

### 📊 Variance Analysis Engine
- Real-time budget vs actual calculations
- Category-level variance tracking
- Percentage and dollar-based variance metrics
- Status indicators (Good/Warning/Critical)
- Historical trend analysis

### 🎨 Beautiful UI Components
- **Board View** - Full variance table embedded in Monday boards
- **Dashboard Widget** - Compact variance summary for dashboards
- **Web Dashboard** - Standalone dashboard with charts and graphs
- Built with **shadcn/ui** components

### 💾 Robust Data Layer
- **PostgreSQL** database with Drizzle ORM
- Optimized schema for multi-tenant architecture
- Variance snapshot storage
- Session and user management

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Monday.com developer account
- QuickBooks developer account

### 1. Installation

```bash
# Clone repository
git clone <your-repo-url>
cd MondayFP-A-App

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
```

### 2. Configure Environment

Edit `.env.local`:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/mondayfp"

# JWT Session
JWT_SECRET="your-strong-random-secret-key"

# Monday.com OAuth
MONDAY_CLIENT_ID="your-monday-client-id"
MONDAY_CLIENT_SECRET="your-monday-client-secret"

# QuickBooks OAuth
QUICKBOOKS_CLIENT_ID="your-quickbooks-client-id"
QUICKBOOKS_CLIENT_SECRET="your-quickbooks-client-secret"

# Application
NEXT_PUBLIC_URL="http://localhost:3000"
NODE_ENV="development"
```

### 3. Setup Database

```bash
# Start PostgreSQL (Docker)
npm run db:dev

# Push schema to database
npm run db:push

# (Optional) Open Drizzle Studio to view data
npm run db:studio
```

### 4. Verify Setup

```bash
# Run verification script
npm run verify
```

### 5. Start Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## 📁 Project Structure

```
MondayFP-A-App/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── monday/           # Monday OAuth endpoints
│   │   │   └── quickbooks/       # QuickBooks OAuth endpoints
│   │   ├── variance/             # Variance calculation APIs
│   │   ├── quickbooks/           # QB data sync APIs
│   │   └── monday/               # Monday board APIs
│   ├── dashboard/                # Main dashboard UI
│   ├── monday-view/              # Embedded board view
│   └── monday-widget/            # Dashboard widget
├── lib/
│   ├── db/
│   │   └── schema.ts             # Drizzle schema
│   └── auth/
│       ├── index.ts              # Session management
│       └── monday-session.ts     # Monday SDK auth
├── components/
│   └── ui/                       # shadcn/ui components
├── monday-code.json              # Monday marketplace manifest
└── MARKETPLACE_SETUP.md          # Detailed setup guide
```

## 🔧 Configuration

### Monday.com App Setup

1. Go to https://monday.com/developers/apps
2. Create new app
3. Configure OAuth:
   - Redirect URI: `http://localhost:3000/api/auth/monday/callback`
   - Scopes: `me:read`, `boards:read`, `boards:write`, `workspaces:read`, `account:read`
4. Configure Features:
   - Board View: `http://localhost:3000/monday-view`
   - Dashboard Widget: `http://localhost:3000/monday-widget`

### QuickBooks App Setup

1. Go to https://developer.intuit.com
2. Create new app
3. Select "QuickBooks Online and Payments"
4. Add redirect URI: `http://localhost:3000/api/auth/quickbooks/callback`
5. Enable Sandbox mode for testing

## 🎯 Usage

### 1. Authenticate with Monday

```
Navigate to: http://localhost:3000/api/auth/monday
```

### 2. Connect QuickBooks

```
Dashboard → Settings → Connect QuickBooks
```

### 3. Create Budget Board in Monday

Create a board with these columns:
- **Category** (Text) - Expense category name
- **Budget** (Number) - Budget amount
- **Period** (Date) - Budget period

### 4. Sync QuickBooks Data

```
Dashboard → Variance → Sync QuickBooks
```

### 5. View Variances

Variances automatically calculate and display:
- Green = Under budget
- Yellow = Warning threshold exceeded
- Red = Critical threshold exceeded

## 🏗️ Architecture

```
┌──────────────────┐
│   Monday.com     │
│   Marketplace    │
└────────┬─────────┘
         │ OAuth 2.0
         ▼
┌──────────────────┐      ┌──────────────────┐
│   Next.js App    │◄────►│  PostgreSQL DB   │
│   (Edge Runtime) │      │  (Drizzle ORM)   │
└────────┬─────────┘      └──────────────────┘
         │ OAuth 2.0
         ▼
┌──────────────────┐
│   QuickBooks     │
│   Online API     │
└──────────────────┘
```

## 📊 API Endpoints

### Authentication
- `GET /api/auth/monday` - Initiate Monday OAuth
- `GET /api/auth/monday/callback` - Monday OAuth callback
- `GET /api/auth/quickbooks` - Initiate QuickBooks OAuth
- `GET /api/auth/quickbooks/callback` - QuickBooks OAuth callback
- `GET /api/auth/session` - Get current session
- `POST /api/auth/logout` - Logout

### Variance Analysis
- `GET /api/variance/analyze?boardId=123` - Calculate variances
- `GET /api/variance/summary?boardId=123` - Get variance summary

### QuickBooks Integration
- `POST /api/quickbooks/sync` - Sync P&L data
- `GET /api/quickbooks/reports/pl` - Get P&L report
- `GET /api/quickbooks/accounts` - Get chart of accounts

### Monday Boards
- `GET /api/monday/boards` - List boards
- `GET /api/monday/boards/:id` - Get board details
- `POST /api/monday/boards/:id/update` - Update board

## 🧪 Testing

### Run Verification Script
```bash
npm run verify
```

### Test OAuth Flows
```bash
# Monday OAuth
curl http://localhost:3000/api/auth/monday

# QuickBooks OAuth (requires session)
curl http://localhost:3000/api/auth/quickbooks \
  -H "Cookie: session=YOUR_SESSION_TOKEN"
```

### Test Variance Calculation
```bash
curl http://localhost:3000/api/variance/analyze?boardId=12345 \
  -H "Cookie: session=YOUR_SESSION_TOKEN"
```

## 🚢 Deployment

### Deploy to Vercel

```bash
vercel --prod
```

Update environment variables in Vercel dashboard.

### Deploy to Railway

```bash
railway up
```

### Update OAuth Redirect URIs

After deployment, update redirect URIs in:
1. Monday.com developer portal
2. QuickBooks developer portal

Update `monday-code.json` with production URLs.

## 🔒 Security

- JWT-based session management
- CSRF protection with state parameter
- Secure token storage
- Environment variable encryption
- SQL injection protection via Drizzle ORM
- XSS protection via Next.js

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add my feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit pull request

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details

## 🆘 Support

- 📚 [Documentation](MARKETPLACE_SETUP.md)
- 🐛 [Report Bug](https://github.com/your-repo/issues)
- 💡 [Request Feature](https://github.com/your-repo/issues)
- 💬 [Discussions](https://github.com/your-repo/discussions)

## 🙏 Acknowledgments

- [Monday.com Apps SDK](https://developer.monday.com/apps/docs)
- [QuickBooks API](https://developer.intuit.com/app/developer/qbo/docs/api)
- [Next.js](https://nextjs.org/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [shadcn/ui](https://ui.shadcn.com/)

---

**Built with ❤️ for FP&A teams everywhere**
