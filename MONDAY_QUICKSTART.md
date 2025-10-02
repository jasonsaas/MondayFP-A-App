# Monday.com Integration - Quick Start

## 🚀 **Get Started in 5 Minutes**

### Step 1: Setup (1 minute)

```env
# .env.local
MONDAY_API_KEY=your_monday_api_key
MONDAY_WEBHOOK_SECRET=your_webhook_secret
NEXT_PUBLIC_APP_URL=https://your-app.com
```

### Step 2: Create Test Board (2 minutes)

In Monday.com, create a board with these columns:

| Column Name | Type | Example |
|-------------|------|---------|
| Item Name | text | "Salaries", "Rent", "Revenue" |
| Budget | numbers | 10000, 5000, 50000 |
| Actual | numbers | 12000, 4500, 48000 |
| Account Type | dropdown | "Expense", "Revenue" |

### Step 3: Run Integration (2 minutes)

```typescript
import { runMondayVarianceIntegration } from '@/lib/monday';

const result = await runMondayVarianceIntegration({
  mondayApiKey: process.env.MONDAY_API_KEY!,
  organizationId: 'org-123',
  boardId: '123456789', // Your board ID
  period: '2024-01',
  autoDetectColumns: true,
  createMissingColumns: true,
  writeBackResults: true,
});

console.log(`Total Variance: $${result.totalVariance}`);
console.log(`Critical Issues: ${result.summary.criticalCount}`);
```

**Done!** The integration will:
1. ✅ Auto-detect your budget/actual columns
2. ✅ Create variance columns (if missing)
3. ✅ Calculate variances
4. ✅ Write results back to your board

---

## 📋 **Common Use Cases**

### Use Case 1: Read Board Data

```typescript
import { MondayClient } from '@/lib/monday';

const client = new MondayClient({
  apiKey: process.env.MONDAY_API_KEY!,
});

const board = await client.getBoard('123456789');

console.log(`Board: ${board.name}`);
console.log(`Items: ${board.items_page?.items.length}`);
```

### Use Case 2: Auto-Detect Columns

```typescript
import { ColumnMapper } from '@/lib/monday';

const mapper = new ColumnMapper(board.columns);
const mapping = mapper.detectColumns();

console.log('Budget Column:', mapping.budgetColumn);
console.log('Actual Column:', mapping.actualColumn);

// Get confidence scores
const detailed = mapper.getDetailedDetection();
detailed.forEach(d => {
  console.log(`${d.purpose}: "${d.title}" (${d.confidence})`);
});
```

### Use Case 3: Update Board Items

```typescript
// Single item update
await client.updateItemColumns('item-id', 'board-id', {
  variance_dollar: '5000',
  variance_percent: '20',
  severity: JSON.stringify({ label: '0' }), // Critical
});

// Batch update (rate limit safe)
const updates = [
  { itemId: '111', columnValues: { variance_dollar: '2000' } },
  { itemId: '222', columnValues: { variance_dollar: '-500' } },
];

await client.batchUpdateItems('board-id', updates);
```

### Use Case 4: Setup Webhook

```typescript
// Create webhook for auto-recalculation
const webhook = await client.createWebhook(
  'board-id',
  'https://your-app.com/api/webhooks/monday',
  'change_column_value'
);

console.log('Webhook ID:', webhook.id);
```

---

## 🔑 **Key Methods**

### MondayClient

```typescript
// Board operations
client.getBoard(boardId, options?)
client.getAllBoardItems(boardId)

// Column operations
client.createColumn(boardId, title, type, settings?)
client.createVarianceColumns(boardId, existingColumns)

// Item operations
client.updateItemColumns(itemId, boardId, columnValues)
client.batchUpdateItems(boardId, updates)

// Webhook operations
client.createWebhook(boardId, url, event, config?)
client.deleteWebhook(webhookId)
```

### ColumnMapper

```typescript
// Detection
mapper.detectColumns()
mapper.getDetailedDetection()

// Validation
mapper.validateMapping(mapping)

// Utilities
mapper.getNumericColumns()
mapper.getStatusColumns()
mapper.suggestMapping()
```

### Integration

```typescript
// Complete workflow
runMondayVarianceIntegration(options)

// Or step-by-step
const integration = new MondayVarianceIntegration(options);
await integration.performVarianceAnalysis();
await integration.setupWebhook();
```

---

## ⚙️ **Configuration Options**

### Client Options

```typescript
{
  apiKey: string,              // Required
  apiVersion: '2024-01',       // Default
  retryAttempts: 3,            // Default
  retryDelay: 1000,            // Default (ms)
  timeout: 30000,              // Default (ms)
}
```

### Integration Options

```typescript
{
  mondayApiKey: string,        // Required
  organizationId: string,      // Required
  boardId: string,             // Required
  period: string,              // Required (e.g., '2024-01')
  columnMapping?: {...},       // Optional (auto-detected if not provided)
  autoDetectColumns: true,     // Default
  createMissingColumns: true,  // Default
  writeBackResults: true,      // Default
}
```

---

## 🎯 **Column Detection**

The system auto-detects columns using keyword matching:

### Budget Column
- **High confidence**: budget, budgeted, planned
- **Medium confidence**: forecast, target, goal
- **Low confidence**: estimated, projected

### Actual Column
- **High confidence**: actual, actuals, spent, expense
- **Medium confidence**: real, current, ytd
- **Low confidence**: amount

### Override Auto-Detection

```typescript
const customMapping = {
  budgetColumn: 'numbers_1',
  actualColumn: 'numbers_2',
  varianceColumn: 'numbers_3',
  variancePercentColumn: 'numbers_4',
  severityColumn: 'status_1',
};
```

---

## 🔔 **Webhook Events**

### Supported Events

| Event | Trigger | Action |
|-------|---------|--------|
| `change_column_value` | Column updated | Recalculate variance |
| `create_item` | New row added | Invalidate cache |
| `item_deleted` | Row deleted | Recalculate variance |

### Setup

1. **Create webhook via API:**
```typescript
await client.createWebhook(
  boardId,
  'https://your-app.com/api/webhooks/monday',
  'change_column_value'
);
```

2. **Or via Monday UI:**
   - Board → Integrations → Webhooks → Add Webhook
   - URL: `https://your-app.com/api/webhooks/monday`
   - Event: `change_column_value`

3. **Set signature secret:**
```env
MONDAY_WEBHOOK_SECRET=your_secret_key
```

---

## 🚨 **Error Handling**

### Automatic Retries

The client automatically retries these errors:
- 429 Too Many Requests
- 500/502/503/504 Server Errors
- Network Timeouts

### Custom Error Handling

```typescript
try {
  const board = await client.getBoard('invalid-id');
} catch (error) {
  console.log('Status:', error.statusCode);
  console.log('Code:', error.errorCode);
  console.log('Retryable:', error.retryable);
}
```

---

## 📊 **Rate Limits**

### Monday.com Limits
- **Max Complexity**: 10M points per minute
- **Batch Size**: 25 items per batch (recommended)

### Automatic Handling
- ✅ Complexity tracking
- ✅ Request throttling
- ✅ Exponential backoff
- ✅ Automatic chunking

### Manual Control

```typescript
// Small batches for safety
await client.batchUpdateItems(boardId, updates.slice(0, 10));

// Custom delay
await new Promise(resolve => setTimeout(resolve, 1000));
```

---

## 🧪 **Testing**

### Quick Test

```bash
# Set environment
export MONDAY_API_KEY=your_test_key

# Run examples
npx tsx lib/monday/examples.ts
```

### Test Board Setup

Create board with:
- 10-20 items (rows)
- Budget & Actual columns
- Mix of revenue/expense accounts
- Include edge cases (zero budget, large numbers)

### Validate Results

Check that:
- ✅ Variance ($) column shows dollar differences
- ✅ Variance (%) column shows percentages
- ✅ Severity column shows correct status
- ✅ Critical items are flagged red
- ✅ Favorable items are flagged blue

---

## 📚 **Documentation**

- **Full API Reference**: `lib/monday/README.md`
- **Complete Examples**: `lib/monday/examples.ts`
- **Integration Guide**: `MONDAY_INTEGRATION_SUMMARY.md`
- **Webhook Endpoint**: `app/api/webhooks/monday/route.ts`

---

## 🔗 **Quick Links**

### API Endpoints

```
POST /api/webhooks/monday          # Webhook handler
GET  /api/webhooks/monday          # Webhook status
DELETE /api/webhooks/monday        # Delete webhook
```

### Code Examples

```typescript
// Import
import {
  MondayClient,
  ColumnMapper,
  runMondayVarianceIntegration
} from '@/lib/monday';

// One-liner integration
const result = await runMondayVarianceIntegration({...});

// Manual integration
const client = new MondayClient({...});
const board = await client.getBoard('123');
const mapper = new ColumnMapper(board.columns);
const mapping = mapper.detectColumns();
```

---

## ✅ **Checklist**

Before deploying:
- [ ] Environment variables configured
- [ ] Test board created in Monday
- [ ] API key has board access
- [ ] Webhook URL is HTTPS (if using webhooks)
- [ ] Signature secret configured (if using webhooks)
- [ ] Test integration runs successfully
- [ ] Variance columns appear on board
- [ ] Results are accurate

---

## 🆘 **Troubleshooting**

| Issue | Solution |
|-------|----------|
| Board not found | Check board ID and API key access |
| Columns not detected | Use custom mapping or rename columns |
| Rate limit exceeded | Client handles automatically with retries |
| Webhook not receiving | Verify HTTPS, check signature secret |
| Updates not appearing | Check column IDs, verify format |

---

**You're ready to integrate Monday.com with your variance analysis!** 🎉

Run `npx tsx lib/monday/examples.ts` to see it in action.
