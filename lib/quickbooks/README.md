# QuickBooks Online Integration

Production-ready QuickBooks Online API v3 integration with OAuth token management, rate limiting, caching, and data transformation.

## Features

✅ **OAuth Token Management**
- Automatic token refresh
- Token expiration detection
- Secure credential storage

✅ **Data Fetching**
- Chart of Accounts with pagination
- Profit & Loss reports
- Balance Sheet reports
- Company information

✅ **Sync Management**
- Full sync with caching
- Incremental sync support
- Rate limit handling (500 req/min)
- Redis caching (with in-memory fallback)
- Error recovery

✅ **Data Transformation**
- QB → Standard format conversion
- Hierarchical account structures
- Revenue/Expense classification

✅ **Error Handling**
- Token expiration
- Rate limits
- Missing permissions
- Network failures
- Automatic retries

---

## Quick Start

### 1. Environment Setup

```env
QUICKBOOKS_CLIENT_ID=your_client_id
QUICKBOOKS_CLIENT_SECRET=your_client_secret
NODE_ENV=production  # or 'sandbox' for testing
```

### 2. Basic Usage

```typescript
import { createQuickBooksClient } from '@/lib/quickbooks';

const client = createQuickBooksClient();

// Refresh token
const token = await client.refreshToken(refreshToken);

// Fetch accounts
const accounts = await client.getAllAccounts(
  token.access_token,
  realmId
);

// Fetch P&L
const plReport = await client.getProfitLossReport(
  token.access_token,
  realmId,
  '2024-01-01',
  '2024-01-31'
);
```

### 3. Sync Manager

```typescript
import { getSyncManager } from '@/lib/quickbooks';

const syncManager = getSyncManager();

// Full sync
const status = await syncManager.syncAll('org-123', {
  syncAccounts: true,
  syncPL: true,
  startDate: '2024-01-01',
  endDate: '2024-01-31',
});
```

---

## API Reference

### QuickBooksClient

#### `refreshToken(refreshToken: string)`

Refresh OAuth access token.

**Returns:** `QBOAuthToken`

**Errors:**
- `token_expired` - Refresh token expired
- `token_refresh_error` - Failed to refresh

```typescript
const newToken = await client.refreshToken(refreshToken);
// { access_token, refresh_token, expires_in, ... }
```

#### `getAllAccounts(token, realmId, activeOnly?)`

Fetch all accounts with automatic pagination.

**Returns:** `QBAccount[]`

```typescript
const accounts = await client.getAllAccounts(token, realmId, true);
// Returns all active accounts
```

#### `getProfitLossReport(token, realmId, startDate, endDate, options?)`

Fetch Profit & Loss report.

**Options:**
- `accountingMethod`: 'Accrual' | 'Cash'
- `summarizeBy`: 'Month' | 'Quarter' | 'Year' | 'Total'

**Returns:** `QBProfitLossReport`

```typescript
const pl = await client.getProfitLossReport(
  token,
  realmId,
  '2024-01-01',
  '2024-01-31',
  { accountingMethod: 'Accrual' }
);
```

#### `getBalanceSheet(token, realmId, date, options?)`

Fetch Balance Sheet.

**Returns:** `QBBalanceSheetReport`

```typescript
const bs = await client.getBalanceSheet(
  token,
  realmId,
  '2024-01-31'
);
```

#### `transformAccounts(qbAccounts)`

Transform QB accounts to standard format.

**Returns:** `StandardAccount[]`

```typescript
const standard = client.transformAccounts(qbAccounts);
// { id, name, type, balance, ... }
```

#### `transformProfitLoss(report)`

Transform P&L report to standard format.

**Returns:** `StandardPLReport`

```typescript
const standardPL = client.transformProfitLoss(plReport);
// {
//   totalRevenue,
//   totalExpenses,
//   netIncome,
//   lineItems: [...]
// }
```

---

### QuickBooksSyncManager

#### `syncAll(organizationId, options?)`

Perform full sync of QuickBooks data.

**Options:**
- `syncAccounts`: boolean (default: true)
- `syncPL`: boolean (default: true)
- `syncBalanceSheet`: boolean (default: false)
- `startDate`: string (ISO date)
- `endDate`: string (ISO date)
- `forceRefresh`: boolean (default: false)

**Returns:** `QBSyncStatus`

```typescript
const status = await syncManager.syncAll('org-123', {
  syncAccounts: true,
  syncPL: true,
  startDate: '2024-01-01',
  endDate: '2024-01-31',
});
```

#### `incrementalSync(organizationId, lastSyncedAt)`

Sync only changed data since last sync.

**Returns:** `QBSyncStatus`

```typescript
const lastSync = new Date('2024-01-15');
const status = await syncManager.incrementalSync('org-123', lastSync);
```

#### `healthCheck(organizationId)`

Verify QuickBooks connection.

**Returns:** `{ connected, realmId?, error? }`

```typescript
const health = await syncManager.healthCheck('org-123');
// { connected: true, realmId: '123456789' }
```

#### `clearCache(realmId)`

Clear cached QuickBooks data.

```typescript
await syncManager.clearCache('123456789');
```

---

## API Endpoints

### POST /api/sync/quickbooks

Trigger manual sync.

**Request:**
```json
{
  "organizationId": "org-123",
  "options": {
    "syncAccounts": true,
    "syncPL": true,
    "startDate": "2024-01-01",
    "endDate": "2024-01-31",
    "forceRefresh": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "syncId": "sync_1234567890_abc123",
  "status": "completed",
  "itemsSynced": {
    "accounts": 50,
    "plReports": 1,
    "balanceSheet": 0
  }
}
```

### GET /api/sync/quickbooks

Check sync status or connection health.

**Query Params:**
- `organizationId`: string (required)
- `syncId`: string (optional)
- `action`: 'status' | 'health' (optional)

**Examples:**
```bash
# Get sync status
GET /api/sync/quickbooks?organizationId=org-123&syncId=sync_123

# Health check
GET /api/sync/quickbooks?organizationId=org-123&action=health
```

### DELETE /api/sync/quickbooks

Clear QuickBooks cache.

**Query Params:**
- `organizationId`: string (required)

### PATCH /api/sync/quickbooks

Incremental sync.

**Request:**
```json
{
  "organizationId": "org-123",
  "lastSyncedAt": "2024-01-15T10:00:00Z"
}
```

---

## Error Handling

### Common Errors

**Token Expired (401)**
```typescript
try {
  await client.getAccounts(token, realmId);
} catch (error) {
  if (error.code === 'token_expired') {
    // Refresh token
    const newToken = await client.refreshToken(refreshToken);
  }
}
```

**Rate Limit (429)**
```typescript
// Handled automatically with exponential backoff
// Max 3 retries with delays: 1s, 2s, 4s
```

**Missing Permissions**
```typescript
// Error code: 'api_error'
// Detail: User doesn't have permission
```

---

## Rate Limiting

**QuickBooks Limits:**
- 500 requests per minute per company
- 10 concurrent requests

**Automatic Handling:**
- Request counting
- Automatic throttling
- Wait when limit reached
- Exponential backoff on errors

---

## Caching

**Cache Strategy:**
- Accounts: 1 hour TTL
- Reports: 30 minutes TTL
- Tokens: 50 minutes TTL

**Cache Keys:**
```typescript
qb:accounts:{realmId}
qb:pl:{realmId}:{startDate}:{endDate}
qb:bs:{realmId}:{date}
qb:token:{realmId}
```

**Usage:**
```typescript
// Force refresh (bypass cache)
await syncManager.syncAll(orgId, {
  forceRefresh: true
});

// Use cache
await syncManager.syncAll(orgId, {
  forceRefresh: false  // default
});
```

---

## Data Transformation

### Account Types

| QuickBooks Type | Standard Type |
|-----------------|---------------|
| Income | revenue |
| Expense | expense |
| Cost of Goods Sold | expense |
| Asset | asset |
| Liability | liability |
| Equity | equity |

### P&L Structure

```typescript
{
  period: { startDate, endDate },
  currency: 'USD',
  totalRevenue: 100000,
  totalExpenses: 75000,
  totalCOGS: 20000,
  netIncome: 5000,
  lineItems: [
    {
      accountName: 'Product Sales',
      accountType: 'revenue',
      amount: 100000,
      level: 1
    },
    ...
  ]
}
```

---

## Examples

See `lib/quickbooks/examples.ts` for complete examples:

1. OAuth Token Refresh
2. Fetch Chart of Accounts
3. Fetch P&L Report
4. Fetch Balance Sheet
5. Transform QB Data
6. Full Sync
7. Incremental Sync
8. Error Handling
9. Rate Limit Handling
10. Health Check

---

## Testing

```bash
# Run examples
npx tsx lib/quickbooks/examples.ts

# Test API endpoints
curl -X POST http://localhost:3000/api/sync/quickbooks \
  -H "Content-Type: application/json" \
  -d '{"organizationId":"org-123"}'
```

---

## Production Deployment

### 1. Environment Variables

```env
QUICKBOOKS_CLIENT_ID=production_client_id
QUICKBOOKS_CLIENT_SECRET=production_secret
NODE_ENV=production
```

### 2. Redis Setup (Optional)

Replace in-memory cache with Redis:

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
```

### 3. Monitoring

Monitor these metrics:
- Token refresh rate
- API error rate
- Sync success rate
- Cache hit rate

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Token expired | Call `refreshToken()` |
| Rate limit exceeded | Wait 60 seconds, retry |
| Missing permissions | Check QB user permissions |
| Connection failed | Verify credentials |
| Sync timeout | Reduce date range |

---

## License

MIT
