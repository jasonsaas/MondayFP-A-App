# Monday.com Integration

Complete integration for reading budget data from Monday.com boards and writing back variance analysis results.

## Features

✅ **GraphQL API Client** (Monday API v2024-01)
- Rate limit handling (10M complexity points/min)
- Automatic retries with exponential backoff
- Request timeout support
- Batch operations

✅ **Smart Column Detection**
- Auto-detect budget/actual columns
- Confidence scoring (high/medium/low)
- Column type validation
- Custom mapping support

✅ **Variance Column Management**
- Auto-create variance columns
- Status column for severity
- Number columns for dollar/percent
- Batch updates with rate limiting

✅ **Webhook Integration**
- Signature verification
- Event handling (change_column_value, create_item, item_deleted)
- Automatic recalculation triggers
- Challenge/response support

✅ **Complete Variance Integration**
- End-to-end workflow
- Read budget data
- Calculate variances
- Write results back
- Handle errors gracefully

---

## Quick Start

### 1. Setup Environment Variables

```env
MONDAY_API_KEY=your_monday_api_key
MONDAY_WEBHOOK_SECRET=your_webhook_secret
NEXT_PUBLIC_APP_URL=https://your-app.com
```

### 2. Basic Usage

```typescript
import { runMondayVarianceIntegration } from '@/lib/monday';

const result = await runMondayVarianceIntegration({
  mondayApiKey: process.env.MONDAY_API_KEY!,
  organizationId: 'org-123',
  boardId: '123456789',
  period: '2024-01',
  autoDetectColumns: true,
  createMissingColumns: true,
  writeBackResults: true,
});

console.log(`Total Variance: $${result.totalVariance}`);
console.log(`Critical Issues: ${result.summary.criticalCount}`);
```

---

## API Reference

### MondayClient

Production-ready GraphQL client for Monday.com API v2024-01.

#### Constructor

```typescript
const client = new MondayClient({
  apiKey: 'your_api_key',
  apiVersion: '2024-01',
  retryAttempts: 3,
  retryDelay: 1000,
  timeout: 30000,
});
```

#### Methods

**`getBoard(boardId: string, options?)`**

Get board with columns and items.

```typescript
const board = await client.getBoard('123456789', {
  limit: 500,
  cursor: null,
  includeArchived: false,
});

console.log(board.name);
console.log(board.columns.length);
console.log(board.items_page?.items.length);
```

**`getAllBoardItems(boardId: string)`**

Get all items (handles pagination automatically).

```typescript
const items = await client.getAllBoardItems('123456789');
console.log(`Retrieved ${items.length} items`);
```

**`createColumn(boardId, title, columnType, settings?)`**

Create a new column.

```typescript
const column = await client.createColumn(
  '123456789',
  'Budget Amount',
  'numbers',
  { unit: '$' }
);
```

**`createVarianceColumns(boardId, existingColumns)`**

Create all variance columns at once.

```typescript
const columns = await client.createVarianceColumns(
  '123456789',
  board.columns
);

console.log('Variance ($):', columns.varianceColumn.id);
console.log('Variance (%):', columns.variancePercentColumn.id);
console.log('Severity:', columns.severityColumn.id);
```

**`updateItemColumns(itemId, boardId, columnValues)`**

Update a single item's columns.

```typescript
await client.updateItemColumns('987654321', '123456789', {
  variance_dollar: '5000',
  variance_percent: '20',
  severity: JSON.stringify({ label: '0' }), // Critical
});
```

**`batchUpdateItems(boardId, updates)`**

Batch update multiple items with automatic rate limiting.

```typescript
const updates = [
  {
    itemId: '111',
    columnValues: {
      variance_dollar: '2000',
      variance_percent: '10',
    },
  },
  {
    itemId: '222',
    columnValues: {
      variance_dollar: '-500',
      variance_percent: '-5',
    },
  },
];

await client.batchUpdateItems('123456789', updates);
```

**`createWebhook(boardId, url, event, config?)`**

Create webhook subscription.

```typescript
const webhook = await client.createWebhook(
  '123456789',
  'https://your-app.com/api/webhooks/monday',
  'change_column_value'
);
```

**`deleteWebhook(webhookId)`**

Delete webhook subscription.

```typescript
await client.deleteWebhook('webhook-id');
```

---

### ColumnMapper

Smart column detection and mapping.

#### Constructor

```typescript
const mapper = new ColumnMapper(board.columns);
```

#### Methods

**`detectColumns()`**

Auto-detect all relevant columns.

```typescript
const mapping = mapper.detectColumns();

console.log('Budget:', mapping.budgetColumn);
console.log('Actual:', mapping.actualColumn);
console.log('Variance:', mapping.varianceColumn);
```

**`getDetailedDetection()`**

Get detection results with confidence scores.

```typescript
const detailed = mapper.getDetailedDetection();

detailed.forEach((d) => {
  console.log(`${d.purpose}: "${d.title}" (${d.confidence})`);
});
```

**`validateMapping(mapping)`**

Validate column mapping.

```typescript
const validation = mapper.validateMapping(mapping);

if (!validation.valid) {
  console.error('Errors:', validation.errors);
}

if (validation.warnings.length > 0) {
  console.warn('Warnings:', validation.warnings);
}
```

**`suggestMapping()`**

Get suggestions for manual mapping.

```typescript
const suggestions = mapper.suggestMapping();

console.log('Suggested:', suggestions.suggested);
console.log('Numeric Columns:', suggestions.numericColumns);
console.log('Status Columns:', suggestions.statusColumns);
```

---

### MondayVarianceIntegration

High-level integration orchestrator.

#### Constructor

```typescript
const integration = new MondayVarianceIntegration({
  mondayApiKey: process.env.MONDAY_API_KEY!,
  organizationId: 'org-123',
  boardId: '123456789',
  period: '2024-01',
  columnMapping: {
    budgetColumn: 'numbers_1',
    actualColumn: 'numbers_2',
  },
  autoDetectColumns: true,
  createMissingColumns: true,
  writeBackResults: true,
});
```

#### Methods

**`performVarianceAnalysis()`**

Execute complete variance workflow.

```typescript
const result = await integration.performVarianceAnalysis();

// Returns VarianceAnalysisResult with:
// - totalVariance
// - totalVariancePercent
// - variances[]
// - insights[]
// - summary (criticalCount, warningCount, etc.)
```

**`setupWebhook()`**

Create webhook for automatic recalculation.

```typescript
await integration.setupWebhook();
```

---

## Column Detection

The column mapper uses keyword matching with confidence scoring to automatically detect columns.

### Budget Column Detection

**High Confidence:**
- "budget"
- "budgeted"
- "planned"

**Medium Confidence:**
- "forecast"
- "target"
- "goal"

**Low Confidence:**
- "estimated"
- "projected"

### Actual Column Detection

**High Confidence:**
- "actual"
- "actuals"
- "spent"
- "expense"

**Medium Confidence:**
- "real"
- "current"
- "ytd"

**Low Confidence:**
- "amount"

### Variance Column Detection

**High Confidence:**
- "variance ($)"
- "variance"

**Medium Confidence:**
- "diff"
- "difference"
- "delta"

**Custom Mapping:**

```typescript
const mapping: ColumnMapping = {
  budgetColumn: 'numbers_1',
  actualColumn: 'numbers_2',
  varianceColumn: 'numbers_3',
  variancePercentColumn: 'numbers_4',
  severityColumn: 'status_1',
  accountTypeColumn: 'dropdown_1',
  periodColumn: 'date_1',
};
```

---

## Rate Limiting

The client automatically handles Monday's rate limits:

- **Max Complexity:** 10M points per minute
- **Batch Size:** 25 items per batch
- **Retry Delay:** Exponential backoff (1s, 2s, 4s)
- **Max Retries:** 3 attempts

### Rate Limit Headers

The client monitors these headers:
- `x-query-complexity` - Current query cost
- `x-rate-limit-remaining` - Remaining complexity points

### Automatic Handling

```typescript
// Automatically chunks large updates
const updates = [/* 100 items */];
await client.batchUpdateItems(boardId, updates);
// Splits into 4 batches of 25 items each
// Adds delays between batches
```

---

## Webhook Integration

### Setup Webhook

```typescript
// 1. Create webhook via API
const webhook = await client.createWebhook(
  boardId,
  'https://your-app.com/api/webhooks/monday',
  'change_column_value'
);

// 2. Or via Monday UI:
// Board → Integrations → Webhooks → Add Webhook
```

### Webhook Events

| Event | Description | Trigger |
|-------|-------------|---------|
| `change_column_value` | Column value updated | Budget/actual changed |
| `create_item` | New item created | New row added |
| `item_deleted` | Item removed | Row deleted |

### Webhook Payload

```json
{
  "event": {
    "type": "change_column_value",
    "userId": 12345,
    "triggerTime": "2024-01-15T10:30:00Z"
  },
  "boardId": 123456789,
  "itemId": 987654321,
  "columnId": "numbers_1",
  "value": "5000",
  "previousValue": "4500"
}
```

### Signature Verification

Webhooks are verified using HMAC-SHA256:

```typescript
// Set environment variable
MONDAY_WEBHOOK_SECRET=your_secret_key

// Signature is automatically verified in:
// /app/api/webhooks/monday/route.ts
```

### Challenge Response

Monday sends a challenge when setting up webhooks:

```json
{
  "challenge": "random_string_123"
}
```

Response:
```json
{
  "challenge": "random_string_123"
}
```

This is handled automatically by the webhook endpoint.

---

## Error Handling

### Retryable Errors

The client automatically retries these errors:

- **429 Too Many Requests** - Rate limit exceeded
- **500 Internal Server Error**
- **502 Bad Gateway**
- **503 Service Unavailable**
- **504 Gateway Timeout**
- **Network Timeout**

### Error Types

```typescript
interface MondayApiError extends Error {
  statusCode?: number;
  errorCode?: string;
  errorData?: any;
  retryable?: boolean;
}
```

### Example

```typescript
try {
  await client.getBoard('invalid-id');
} catch (error: MondayApiError) {
  console.log('Status:', error.statusCode);
  console.log('Code:', error.errorCode);
  console.log('Retryable:', error.retryable);

  if (error.retryable) {
    // Will be retried automatically
  }
}
```

---

## Board Structure Requirements

### Minimum Required Columns

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| Item Name | text | Yes | Account name (built-in) |
| Budget | numbers | Yes | Budget amount |
| Actual | numbers | No | Actual amount (optional) |

### Optional Columns

| Column | Type | Description |
|--------|------|-------------|
| Account Type | dropdown/status | Revenue or Expense |
| Account Code | text | GL account code |
| Period | date/text | Budget period |
| Variance ($) | numbers | Auto-created |
| Variance (%) | numbers | Auto-created |
| Severity | status | Auto-created |

### Example Board Setup

```
Board: "2024 Budget vs Actuals"

Columns:
├── Item Name (text) - "Salaries", "Rent", etc.
├── Account Type (dropdown) - "Expense", "Revenue"
├── Budget (numbers) - 10000, 5000, etc.
├── Actual (numbers) - 12000, 4500, etc.
├── Variance ($) (numbers) - Auto-populated
├── Variance (%) (numbers) - Auto-populated
└── Severity (status) - Auto-populated
```

---

## Integration Workflow

### Step-by-Step Process

```
1. Get Board Data
   ↓
2. Auto-Detect Columns
   ↓
3. Validate Column Mapping
   ↓
4. Create Missing Variance Columns
   ↓
5. Extract Budget & Actual Data
   ↓
6. Calculate Variances
   ↓
7. Write Results Back to Board
   ↓
8. Setup Webhook (optional)
```

### Code Example

```typescript
import { runMondayVarianceIntegration } from '@/lib/monday';

// Complete workflow in one call
const result = await runMondayVarianceIntegration({
  mondayApiKey: process.env.MONDAY_API_KEY!,
  organizationId: 'org-123',
  boardId: '123456789',
  period: '2024-01',
  autoDetectColumns: true,
  createMissingColumns: true,
  writeBackResults: true,
});

console.log('=== Results ===');
console.log(`Total Variance: $${result.totalVariance.toLocaleString()}`);
console.log(`Critical: ${result.summary.criticalCount}`);
console.log(`Warnings: ${result.summary.warningCount}`);
console.log(`Insights: ${result.insights.length}`);
```

---

## Performance

### Benchmarks

| Operation | Time | Notes |
|-----------|------|-------|
| Get board (500 items) | ~2s | Includes columns & values |
| Auto-detect columns | ~10ms | Local processing |
| Create 3 columns | ~3s | 1s per column |
| Update 1 item | ~500ms | Network latency |
| Batch update 25 items | ~15s | Rate limit safe |
| Batch update 100 items | ~60s | 4 chunks of 25 |

### Optimization Tips

1. **Use Pagination**: Don't fetch all items if you don't need them
2. **Batch Updates**: Group updates to reduce API calls
3. **Cache Board Data**: Reuse board structure across calculations
4. **Webhook Triggers**: Use webhooks instead of polling

---

## Examples

See `lib/monday/examples.ts` for complete working examples:

1. **Basic Board Reading** - Get board data
2. **Auto-Detect Columns** - Smart column detection
3. **Create Variance Columns** - Add new columns
4. **Update Items** - Single item update
5. **Batch Update** - Multiple items with rate limiting
6. **Complete Integration** - End-to-end workflow
7. **Setup Webhook** - Automatic recalculation
8. **Rate Limiting** - Handle large updates
9. **Custom Mapping** - Manual column mapping
10. **Error Handling** - Handle failures gracefully

---

## Testing

### Test Board Setup

Create a test board with:
- 10-20 budget items
- Mix of revenue and expense accounts
- Some items with actuals, some without
- Include edge cases (zero budget, very large numbers)

### Run Integration Test

```bash
# Set environment variables
export MONDAY_API_KEY=your_test_api_key
export MONDAY_BOARD_ID=your_test_board_id

# Run integration
npx tsx lib/monday/examples.ts
```

---

## Troubleshooting

### Common Issues

**Issue: "Board not found"**
- Check board ID is correct
- Verify API key has access to board
- Ensure board is not archived

**Issue: "Column detection failed"**
- Column names don't match expected keywords
- Use custom mapping instead
- Check column types (budget must be 'numbers')

**Issue: "Rate limit exceeded"**
- Reduce batch size
- Add delays between operations
- Client handles this automatically with retries

**Issue: "Webhook not receiving events"**
- Verify webhook URL is publicly accessible
- Check signature secret is configured
- Ensure HTTPS (Monday requires HTTPS)

**Issue: "Updates not appearing on board"**
- Check column IDs are correct
- Verify column values format
- Look for GraphQL errors in logs

---

## License

MIT

---

## Support

For issues or questions:
1. Check this README
2. Review examples in `lib/monday/examples.ts`
3. Check Monday.com API docs: https://developer.monday.com
4. Review webhook endpoint: `app/api/webhooks/monday/route.ts`
