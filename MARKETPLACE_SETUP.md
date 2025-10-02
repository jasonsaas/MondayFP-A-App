# Monday.com Marketplace App - Complete Setup Guide

## 🚀 Quick Start (4-Hour MVP Timeline)

### Hour 1: Environment Setup & Database (60 min)

1. **Clone and Install Dependencies** (10 min)
```bash
npm install
```

2. **Set up PostgreSQL** (15 min)
```bash
# Start development database
npm run db:dev

# Push schema to database
npm run db:push
```

3. **Configure Environment Variables** (15 min)

Create `.env.local`:
```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/mondayfp"

# JWT Session
JWT_SECRET="your-strong-random-secret-key-here"

# Monday.com OAuth (Get from Monday Developers Portal)
MONDAY_CLIENT_ID="your-monday-client-id"
MONDAY_CLIENT_SECRET="your-monday-client-secret"
NEXT_PUBLIC_URL="http://localhost:3000"

# QuickBooks OAuth (Get from Intuit Developer Portal)
QUICKBOOKS_CLIENT_ID="your-quickbooks-client-id"
QUICKBOOKS_CLIENT_SECRET="your-quickbooks-client-secret"
QUICKBOOKS_REDIRECT_URI="http://localhost:3000/api/auth/quickbooks/callback"

# Application
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

4. **Test Local Server** (20 min)
```bash
npm run dev
# Visit http://localhost:3000
```

---

### Hour 2: Monday.com Developer Setup (60 min)

1. **Create Monday App** (20 min)
   - Go to https://monday.com/developers/apps
   - Click "Create App"
   - Fill in basic details:
     - App Name: "FP&A Variance Analyzer"
     - Description: "Automated variance analysis between QuickBooks and Monday budgets"

2. **Configure OAuth** (15 min)
   - Navigate to "OAuth" section
   - Add redirect URI: `http://localhost:3000/api/auth/monday/callback`
   - Copy Client ID and Client Secret to `.env.local`
   - Set permissions:
     - `me:read`
     - `boards:read`
     - `boards:write`
     - `workspaces:read`
     - `account:read`

3. **Configure Features** (15 min)
   - **Board View**:
     - URL: `http://localhost:3000/monday-view`
     - Height: 600px
   - **Dashboard Widget**:
     - URL: `http://localhost:3000/monday-widget`
     - Size: 4x4

4. **Test OAuth Flow** (10 min)
   - Navigate to http://localhost:3000/api/auth/monday
   - Complete OAuth flow
   - Verify redirect to dashboard

---

### Hour 3: QuickBooks Integration (60 min)

1. **Create QuickBooks App** (25 min)
   - Go to https://developer.intuit.com/app/developer/dashboard
   - Create new app
   - Select "QuickBooks Online and Payments"
   - Add redirect URI: `http://localhost:3000/api/auth/quickbooks/callback`
   - Copy Client ID and Client Secret to `.env.local`
   - Set to Sandbox mode for testing

2. **Test QuickBooks OAuth** (15 min)
   - Login to app via Monday OAuth first
   - Navigate to Settings → QuickBooks Integration
   - Click "Connect QuickBooks"
   - Complete OAuth flow with test company

3. **Verify P&L Data Sync** (20 min)
   - Create test data in QuickBooks Sandbox
   - Test sync endpoint: `/api/quickbooks/sync`
   - Verify data appears in variance analyzer

---

### Hour 4: Testing & Demo Prep (60 min)

1. **Create Test Monday Board** (15 min)
   - Create new board with budget columns:
     - Category (Text)
     - Budget Amount (Number)
     - Period (Date)
   - Add sample budget data

2. **Test Variance Analysis** (15 min)
   - Navigate to `/dashboard/variance`
   - Select test board
   - Trigger variance calculation
   - Verify results display correctly

3. **Test Embedded Views** (15 min)
   - Add Board View to test board
   - Add Widget to dashboard
   - Verify SDK integration works
   - Test sync button

4. **Demo Preparation** (15 min)
   - Prepare sample data with clear variances
   - Test full flow: OAuth → Connect QB → Sync → View Results
   - Screenshot key features
   - Prepare talking points

---

## 📦 Current Features

✅ **Dual OAuth Flow**
- Monday.com OAuth 2.0 complete
- QuickBooks OAuth 2.0 complete
- Session management with JWT

✅ **Database Schema (Drizzle ORM)**
- Organizations (Monday accounts)
- Users (Monday users)
- Sessions (JWT tokens)
- Variance Snapshots

✅ **API Routes**
- `/api/auth/monday` - Monday OAuth
- `/api/auth/quickbooks` - QuickBooks OAuth
- `/api/variance/analyze` - Calculate variances
- `/api/variance/summary` - Widget data
- `/api/quickbooks/sync` - Sync P&L data
- `/api/monday/boards` - Get boards

✅ **UI Components**
- Dashboard with variance table
- Settings page for QuickBooks connection
- Embedded Monday board view
- Dashboard widget

✅ **Monday Marketplace**
- `monday-code.json` manifest
- Board view component
- Dashboard widget component
- SDK integration

---

## 🏗️ Architecture Overview

```
┌─────────────────┐
│  Monday.com     │
│  (User Login)   │
└────────┬────────┘
         │ OAuth
         ▼
┌─────────────────┐      ┌──────────────────┐
│  Next.js App    │◄────►│  PostgreSQL DB   │
│  (Middleware)   │      │  (Drizzle ORM)   │
└────────┬────────┘      └──────────────────┘
         │ OAuth
         ▼
┌─────────────────┐
│  QuickBooks     │
│  (P&L Data)     │
└─────────────────┘
```

---

## 🎯 Critical Paths for Demo

### 1. **OAuth Authentication**
```bash
# Test Monday OAuth
curl http://localhost:3000/api/auth/monday

# Test QuickBooks OAuth (requires active session)
curl http://localhost:3000/api/auth/quickbooks
```

### 2. **Data Sync**
```bash
# Sync QuickBooks P&L
curl -X POST http://localhost:3000/api/quickbooks/sync \
  -H "Cookie: session=YOUR_SESSION_TOKEN"
```

### 3. **Variance Analysis**
```bash
# Calculate variances
curl http://localhost:3000/api/variance/analyze?boardId=12345 \
  -H "Cookie: session=YOUR_SESSION_TOKEN"
```

---

## 🔧 Troubleshooting

### OAuth Issues
- **Monday OAuth fails**: Verify redirect URI matches exactly
- **QuickBooks OAuth fails**: Check sandbox mode is enabled
- **Session not persisting**: Check JWT_SECRET is set

### Database Issues
- **Connection failed**: Ensure PostgreSQL is running (`npm run db:dev`)
- **Schema errors**: Run `npm run db:push` to sync schema
- **Missing data**: Check seeding with Drizzle Studio (`npm run db:studio`)

### API Issues
- **401 Unauthorized**: Session expired, re-authenticate via Monday
- **500 Internal Error**: Check logs for specific error details
- **CORS issues**: Ensure NEXT_PUBLIC_URL matches your domain

---

## 📊 Demo Script

**Goal**: Show working MVP in 10 minutes

1. **Login Flow** (2 min)
   - Open app in Monday.com
   - Show OAuth consent screen
   - Redirect to dashboard

2. **QuickBooks Connection** (2 min)
   - Navigate to Settings
   - Connect QuickBooks
   - Show successful connection

3. **Data Sync** (2 min)
   - Click "Sync QuickBooks"
   - Show loading state
   - Display synced P&L data

4. **Variance Analysis** (2 min)
   - Navigate to Variance page
   - Select budget board
   - Show variance calculations
   - Highlight over/under budget items

5. **Embedded Views** (2 min)
   - Show board view in Monday
   - Show dashboard widget
   - Demonstrate real-time updates

---

## 🚢 Production Deployment

### 1. Deploy to Vercel/Railway
```bash
# Vercel
vercel --prod

# Railway
railway up
```

### 2. Update Environment Variables
- Set production DATABASE_URL
- Update NEXT_PUBLIC_URL to production domain
- Update OAuth redirect URIs in both Monday and QuickBooks

### 3. Update Monday App
- Change Board View URL to production
- Change Widget URL to production
- Update redirect URI to production callback

### 4. QuickBooks Production Access
- Complete Intuit security review
- Switch from Sandbox to Production
- Update OAuth credentials

---

## 📝 Next Steps (Post-MVP)

1. **Enhanced Variance Features**
   - Historical trend analysis
   - Automated alerts for threshold breaches
   - Custom variance formulas

2. **Advanced Integrations**
   - n8n automation workflows
   - Slack notifications
   - Email reports

3. **Performance Optimizations**
   - Caching layer (Redis)
   - Background job processing
   - Optimistic UI updates

4. **Enterprise Features**
   - Multi-currency support
   - Role-based permissions
   - Audit logging

---

## 🆘 Support Resources

- **Monday SDK Docs**: https://developer.monday.com/apps/docs
- **QuickBooks API Docs**: https://developer.intuit.com/app/developer/qbo/docs/api
- **Next.js Docs**: https://nextjs.org/docs
- **Drizzle ORM Docs**: https://orm.drizzle.team/

---

## ✅ Pre-Demo Checklist

- [ ] PostgreSQL running
- [ ] Environment variables configured
- [ ] Monday OAuth working
- [ ] QuickBooks OAuth working
- [ ] Test board with sample data
- [ ] Variance calculations working
- [ ] Board view rendering
- [ ] Dashboard widget displaying
- [ ] Demo script practiced
- [ ] Screenshots captured

---

## 🎉 You're Ready!

Your Monday.com marketplace app is set up and ready for demo. Good luck with your beta customers!
