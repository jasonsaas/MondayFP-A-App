# Monday FP&A App - Database Schema Documentation

## Overview
This document describes the complete database schema for the Monday FP&A platform, including authentication, organizations, users, and FP&A-specific tables.

---

## Authentication & Organization Tables

### `organization`
Stores Monday.com account-level information and subscription details.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (UUID) | Primary key |
| `name` | text | Organization name from Monday.com |
| `mondayAccountId` | text | Monday.com account ID (unique) |
| `mondayWorkspaceId` | text | Monday.com workspace ID |
| `slug` | text | Unique URL slug |
| `subscription` | text | Subscription tier: 'trial', 'basic', 'pro', 'enterprise' |
| `trialEndsAt` | timestamp | When trial period expires (14 days from signup) |
| `subscriptionStatus` | text | Status: 'active', 'cancelled', 'expired' |
| `settings` | jsonb | Organization-wide settings (see below) |
| `active` | boolean | Whether organization is active |
| `createdAt` | timestamp | When organization was created |
| `updatedAt` | timestamp | Last update timestamp |

**Settings Structure (JSONB):**
```typescript
{
  syncFrequency?: 'realtime' | '15min' | 'hourly' | 'daily';
  defaultBoardId?: string;
  defaultCurrency?: 'USD' | 'EUR' | 'GBP';
  thresholds?: {
    warning: number;   // Default: 5%
    critical: number;  // Default: 10%
  };
  n8nWebhookUrl?: string;
}
```

**Default Settings:**
```json
{
  "syncFrequency": "hourly",
  "defaultCurrency": "USD",
  "thresholds": {
    "warning": 5,
    "critical": 10
  }
}
```

---

### `user`
Stores individual user information linked to organizations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (UUID) | Primary key |
| `name` | text | User's full name |
| `email` | text | Email address (unique) |
| `emailVerified` | boolean | Whether email is verified |
| `image` | text | Profile photo URL from Monday.com |
| `organizationId` | text | Foreign key to organization |
| `mondayUserId` | text | Monday.com user ID |
| `role` | text | User role: 'owner', 'admin', 'member', 'viewer' |
| `lastLogin` | timestamp | **NEW** Last login timestamp |
| `createdAt` | timestamp | When user was created |
| `updatedAt` | timestamp | Last update timestamp |

**Role Hierarchy:**
- `owner` - First user, full access including billing
- `admin` - Can manage users and settings
- `member` - Can create/edit analyses
- `viewer` - Read-only access

---

### `session`
JWT session management for authentication.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (UUID) | Primary key |
| `userId` | text | Foreign key to user |
| `token` | text | JWT token (unique) |
| `expiresAt` | timestamp | Token expiration (30 days) |
| `ipAddress` | text | IP address for security |
| `userAgent` | text | Browser/device info |
| `createdAt` | timestamp | Session creation time |
| `updatedAt` | timestamp | Last activity timestamp |

---

### `account`
OAuth provider accounts (Monday.com, QuickBooks).

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (UUID) | Primary key |
| `userId` | text | Foreign key to user |
| `providerId` | text | Provider: 'monday', 'quickbooks' |
| `accountId` | text | Provider's account ID |
| `accessToken` | text | OAuth access token |
| `refreshToken` | text | OAuth refresh token |
| `idToken` | text | OpenID Connect ID token |
| `accessTokenExpiresAt` | timestamp | Access token expiration |
| `refreshTokenExpiresAt` | timestamp | Refresh token expiration |
| `scope` | text | OAuth scopes granted |
| `password` | text | Legacy field (not used) |
| `createdAt` | timestamp | Account link timestamp |
| `updatedAt` | timestamp | Last token refresh |

**Provider Examples:**
- Monday.com: `providerId = 'monday'`, stores Monday OAuth tokens
- QuickBooks: `providerId = 'quickbooks'`, stores QB OAuth tokens

---

### `verification`
Email verification tokens and password reset tokens.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (UUID) | Primary key |
| `identifier` | text | Email or user ID |
| `value` | text | Verification token |
| `expiresAt` | timestamp | Token expiration |
| `createdAt` | timestamp | Token creation time |
| `updatedAt` | timestamp | Last update timestamp |

---

## FP&A Specific Tables

### `monday_boards`
Tracks Monday.com boards being used for budgets.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (UUID) | Primary key |
| `userId` | text | Foreign key to user |
| `name` | text | Board name |
| `description` | text | Board description |
| `mondayBoardId` | text | Monday.com board ID |
| `workspaceId` | text | Monday.com workspace ID |
| `isActive` | boolean | Whether board is active |
| `lastSyncAt` | timestamp | Last data sync time |
| `createdAt` | timestamp | Board link timestamp |
| `updatedAt` | timestamp | Last update timestamp |

---

### `budget_items`
Individual budget line items from Monday.com boards.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (UUID) | Primary key |
| `boardId` | text | Foreign key to monday_boards |
| `itemId` | text | Monday.com item ID |
| `name` | text | Item name |
| `category` | text | Budget category |
| `subcategory` | text | Budget subcategory |
| `budgetAmount` | numeric(12,2) | Budgeted amount |
| `period` | text | Budget period: 'monthly', 'quarterly', 'yearly' |
| `periodStartDate` | timestamp | Period start date |
| `periodEndDate` | timestamp | Period end date |
| `department` | text | Department name |
| `costCenter` | text | Cost center code |
| `tags` | text[] | Array of tags |
| `metadata` | jsonb | Additional Monday.com data |
| `createdAt` | timestamp | Item creation time |
| `updatedAt` | timestamp | Last update timestamp |

---

### `quickbooks_accounts`
Synced QuickBooks chart of accounts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (UUID) | Primary key |
| `userId` | text | Foreign key to user |
| `qbAccountId` | text | QuickBooks account ID |
| `name` | text | Account name |
| `accountType` | text | Account type (Asset, Expense, etc.) |
| `accountSubType` | text | Account sub-type |
| `classification` | text | Asset, Liability, Equity, Revenue, Expense |
| `isActive` | boolean | Whether account is active |
| `balance` | numeric(12,2) | Current balance |
| `createdAt` | timestamp | Account sync time |
| `updatedAt` | timestamp | Last update timestamp |

---

### `actual_transactions`
Actual transactions from QuickBooks.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (UUID) | Primary key |
| `accountId` | text | Foreign key to quickbooks_accounts |
| `qbTransactionId` | text | QuickBooks transaction ID |
| `transactionType` | text | Type: 'expense', 'income', 'transfer' |
| `amount` | numeric(12,2) | Transaction amount |
| `description` | text | Transaction description |
| `transactionDate` | timestamp | Transaction date |
| `vendor` | text | Vendor name |
| `customer` | text | Customer name |
| `department` | text | Department |
| `class` | text | QuickBooks class |
| `location` | text | Location |
| `memo` | text | Transaction memo |
| `metadata` | jsonb | Additional QuickBooks data |
| `createdAt` | timestamp | Sync timestamp |
| `updatedAt` | timestamp | Last update timestamp |

---

### `variance_analyses`
Variance analysis runs.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (UUID) | Primary key |
| `userId` | text | Foreign key to user |
| `boardId` | text | Foreign key to monday_boards |
| `name` | text | Analysis name |
| `description` | text | Analysis description |
| `analysisType` | text | Type: 'budget_vs_actual', 'forecast_vs_actual' |
| `periodStartDate` | timestamp | Analysis period start |
| `periodEndDate` | timestamp | Analysis period end |
| `status` | text | Status: 'draft', 'running', 'completed', 'failed' |
| `totalBudget` | numeric(12,2) | Total budgeted amount |
| `totalActual` | numeric(12,2) | Total actual amount |
| `totalVariance` | numeric(12,2) | Total variance |
| `variancePercentage` | numeric(5,2) | Variance percentage |
| `settings` | jsonb | Analysis configuration |
| `lastRunAt` | timestamp | Last run timestamp |
| `createdAt` | timestamp | Analysis creation time |
| `updatedAt` | timestamp | Last update timestamp |

---

### `variance_results`
Individual variance results by category.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (UUID) | Primary key |
| `analysisId` | text | Foreign key to variance_analyses |
| `budgetItemId` | text | Foreign key to budget_items (nullable) |
| `category` | text | Category name |
| `subcategory` | text | Subcategory name |
| `budgetAmount` | numeric(12,2) | Budgeted amount |
| `actualAmount` | numeric(12,2) | Actual amount |
| `variance` | numeric(12,2) | Variance amount |
| `variancePercentage` | numeric(5,2) | Variance percentage |
| `varianceType` | text | Type: 'favorable', 'unfavorable' |
| `severity` | text | Severity: 'low', 'medium', 'high', 'critical' |
| `notes` | text | Analysis notes |
| `actionItems` | jsonb | Recommended actions |
| `createdAt` | timestamp | Result creation time |

---

### `variance_snapshots` **✨ NEW**
Period-based variance snapshots for historical tracking.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (UUID) | Primary key |
| `organizationId` | text | Foreign key to organization |
| `boardId` | text | Monday.com board ID |
| `period` | text | Period identifier (e.g., '2025-01', '2025-Q1') |
| `data` | jsonb | Array of variance items |
| `summary` | jsonb | Aggregated summary data |
| `createdAt` | timestamp | Snapshot creation time |

**Data Structure (JSONB):**
```typescript
{
  itemId: string;
  itemName: string;
  category: string;
  budgetAmount: number;
  actualAmount: number;
  variance: number;
  variancePercentage: number;
  severity: 'normal' | 'warning' | 'critical';
}[]
```

**Summary Structure (JSONB):**
```typescript
{
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  variancePercentage: number;
  itemCount: number;
}
```

---

### `integration_settings`
Integration settings for Monday.com and QuickBooks.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (UUID) | Primary key |
| `userId` | text | Foreign key to user |
| `provider` | text | Provider: 'monday', 'quickbooks' |
| `isConnected` | boolean | Connection status |
| `accessToken` | text | Provider access token |
| `refreshToken` | text | Provider refresh token |
| `tokenExpiresAt` | timestamp | Token expiration |
| `companyId` | text | QuickBooks company ID |
| `realmId` | text | QuickBooks realm ID |
| `settings` | jsonb | Provider-specific settings |
| `lastSyncAt` | timestamp | Last sync timestamp |
| `createdAt` | timestamp | Settings creation time |
| `updatedAt` | timestamp | Last update timestamp |

---

## Indexes & Performance

**Recommended Indexes:**
```sql
-- Organization lookup
CREATE INDEX idx_org_monday_account ON organization(monday_account_id);

-- User lookup
CREATE INDEX idx_user_monday_id ON user(monday_user_id);
CREATE INDEX idx_user_org ON user(organization_id);
CREATE INDEX idx_user_email ON user(email);

-- Session lookup
CREATE INDEX idx_session_token ON session(token);
CREATE INDEX idx_session_user ON session(user_id);

-- Variance snapshots
CREATE INDEX idx_snapshot_org_period ON variance_snapshots(organization_id, period);
CREATE INDEX idx_snapshot_board ON variance_snapshots(board_id);

-- Board lookup
CREATE INDEX idx_board_monday_id ON monday_boards(monday_board_id);
CREATE INDEX idx_board_user ON monday_boards(user_id);
```

---

## Foreign Key Relationships

```
organization
  └─> user (one-to-many)
       ├─> session (one-to-many)
       ├─> account (one-to-many)
       ├─> monday_boards (one-to-many)
       │    └─> budget_items (one-to-many)
       ├─> quickbooks_accounts (one-to-many)
       │    └─> actual_transactions (one-to-many)
       └─> variance_analyses (one-to-many)
            └─> variance_results (one-to-many)
  └─> variance_snapshots (one-to-many)
```

---

## Migrations

**Current Migration:** `0003_flowery_hex.sql`

**Changes:**
- ✅ Added `variance_snapshots` table
- ✅ Added `subscription` to organization
- ✅ Added `trialEndsAt` to organization
- ✅ Added `subscriptionStatus` to organization
- ✅ Added `active` to organization
- ✅ Added `lastLogin` to user
- ✅ Updated `settings` default values

**To apply migration:**
```bash
npm run db:push
```

---

## Environment Variables Required

```env
# Database connection
DATABASE_URL="postgresql://user:password@host:port/database"

# JWT for sessions
JWT_SECRET="<random-secure-string>"

# Monday.com OAuth
MONDAY_CLIENT_ID="<your-client-id>"
MONDAY_CLIENT_SECRET="<your-client-secret>"
MONDAY_REDIRECT_URI="http://localhost:3000/api/auth/monday/callback"

# QuickBooks OAuth
QUICKBOOKS_CLIENT_ID="<your-client-id>"
QUICKBOOKS_CLIENT_SECRET="<your-client-secret>"
QUICKBOOKS_REDIRECT_URI="http://localhost:3000/api/auth/quickbooks/callback"
```

---

## Security Notes

1. **Tokens**: All OAuth tokens are stored encrypted in the database
2. **Sessions**: JWT tokens expire after 30 days
3. **CSRF Protection**: OAuth state parameter prevents CSRF attacks
4. **Password**: Not used (OAuth only)
5. **Cascade Deletes**: Deleting an organization deletes all related data

---

## Subscription & Trial Logic

**New Organization:**
- Automatically gets `subscription: 'trial'`
- Trial period: 14 days from signup
- `trialEndsAt` is set automatically
- `subscriptionStatus: 'active'`

**Trial Expiration:**
- Check `trialEndsAt < NOW()` to detect expired trials
- Update `subscriptionStatus: 'expired'`
- Restrict feature access based on status

**Upgrading:**
- Update `subscription` to: 'basic', 'pro', or 'enterprise'
- Clear `trialEndsAt` or set to null
- Set `subscriptionStatus: 'active'`

---

## Data Retention

**Active Organizations:**
- Keep all data indefinitely

**Expired Trials:**
- Grace period: 7 days after trial expiration
- Archive after 30 days
- Delete after 90 days (if no upgrade)

**User Deletion:**
- Soft delete: Set `active: false`
- Hard delete: CASCADE removes all related data

---

## Schema Version

**Version:** 3 (Migration 0003_flowery_hex.sql)
**Last Updated:** 2025-09-30
**Next Review:** 2025-10-30
