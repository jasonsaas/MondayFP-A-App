# API Documentation

## Authentication

All API routes require authentication via JWT session cookie. The middleware automatically injects user context into request headers:
- `x-user-id`: Current user ID
- `x-organization-id`: User's organization ID
- `x-user-role`: User's role (owner/admin/member)

## Monday.com Board Routes

### List All Boards

**GET** `/api/monday/boards`

Fetch all Monday.com boards accessible to the authenticated user.

**Response:**
```json
{
  "boards": [
    {
      "id": "1234567890",
      "name": "FY2024 Budget",
      "description": "Annual budget planning",
      "workspace_id": "987654321"
    }
  ],
  "count": 1,
  "organizationId": "org-uuid"
}
```

**Example:**
```bash
curl https://your-app.vercel.app/api/monday/boards \
  -H "Cookie: session=YOUR_SESSION_TOKEN"
```

---

### Get Board Details

**GET** `/api/monday/boards/[boardId]`

Get detailed information about a specific board including all items and columns.

**Response:**
```json
{
  "boardId": "1234567890",
  "items": [
    {
      "id": "item-123",
      "name": "Marketing Budget",
      "group": { "id": "group-1", "title": "Q1" },
      "column_values": [
        {
          "id": "numbers",
          "title": "Budget Amount",
          "text": "$10,000",
          "value": "10000",
          "type": "numbers"
        }
      ]
    }
  ],
  "columns": [
    {
      "id": "numbers",
      "title": "Budget Amount",
      "type": "numbers",
      "settings_str": "{}"
    }
  ],
  "itemCount": 15,
  "columnCount": 8,
  "isSaved": true,
  "savedBoard": { ... }
}
```

---

### Save/Link Board

**POST** `/api/monday/boards/[boardId]`

Save a Monday.com board for tracking and variance analysis.

**Request Body:**
```json
{
  "name": "FY2024 Budget",
  "description": "Annual budget tracking",
  "workspaceId": "987654321"
}
```

**Response:**
```json
{
  "message": "Board saved successfully",
  "board": {
    "id": "uuid",
    "name": "FY2024 Budget",
    "mondayBoardId": "1234567890",
    "isActive": true,
    "lastSyncAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### Remove Board

**DELETE** `/api/monday/boards/[boardId]`

Remove a board from tracking (soft delete - sets isActive to false).

**Response:**
```json
{
  "message": "Board removed from tracking",
  "boardId": "1234567890"
}
```

---

### Update Board with Variance Data

**POST** `/api/monday/boards/[boardId]/update`

Write variance analysis results back to Monday.com board items.

**Request Body:**
```json
{
  "analysisId": "analysis-uuid",
  "columnMappings": {
    "actualColumn": "numbers2",
    "varianceColumn": "numbers3",
    "variancePercentColumn": "numbers4",
    "statusColumn": "status"
  },
  "updates": [
    {
      "itemId": "item-123",
      "columnValues": {
        "numbers2": 8500,
        "numbers3": -1500,
        "numbers4": -15.0,
        "status": { "label": "On Track" }
      }
    }
  ]
}
```

**Response:**
```json
{
  "message": "Board update completed",
  "summary": {
    "total": 15,
    "successful": 14,
    "failed": 1,
    "successRate": "93.3%"
  },
  "analysisId": "analysis-uuid",
  "boardId": "1234567890",
  "errors": ["Item item-xyz not found"]
}
```

**Column Value Types:**

Numbers:
```json
{ "columnId": 12345 }
```

Status:
```json
{ "label": "On Track" }
```

Date:
```json
{ "date": "2024-01-15" }
```

Text:
```json
"Your text here"
```

---

### Get Update History

**GET** `/api/monday/boards/[boardId]/update`

Retrieve the history of variance analyses for a specific board.

**Response:**
```json
{
  "boardId": "1234567890",
  "analyses": [
    {
      "id": "analysis-uuid",
      "name": "Q4 2024 Variance",
      "status": "completed",
      "lastRunAt": "2024-12-31T23:59:00Z",
      "totalVariance": "-25000.50",
      "variancePercentage": "-5.2"
    }
  ],
  "count": 5
}
```

---

## Variance Analysis Routes

### Run Variance Analysis

**POST** `/api/variance/analyze`

Execute a variance analysis comparing Monday.com budget data with QuickBooks actuals.

**Request Body:**
```json
{
  "boardId": "1234567890",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "analysisName": "FY2024 Variance Analysis"
}
```

**Response:**
```json
{
  "analysis": {
    "id": "analysis-uuid",
    "name": "FY2024 Variance Analysis",
    "totalBudget": 500000,
    "totalActual": 475000,
    "totalVariance": -25000,
    "totalVariancePercentage": -5.0,
    "results": [
      {
        "id": "result-uuid",
        "category": "Marketing",
        "budgetAmount": 50000,
        "actualAmount": 48000,
        "variance": -2000,
        "variancePercentage": -4.0,
        "varianceType": "favorable",
        "severity": "low",
        "actionItems": []
      }
    ],
    "summary": {
      "favorableCount": 8,
      "unfavorableCount": 4,
      "criticalCount": 1,
      "topVariances": [...]
    }
  }
}
```

---

## n8n Webhook Routes

### Trigger Actions via Webhook

**POST** `/api/webhooks/n8n`

**Headers:**
```
Authorization: Bearer YOUR_N8N_WEBHOOK_SECRET
Content-Type: application/json
```

**Request Body:**
```json
{
  "action": "run_analysis",
  "organizationId": "org-uuid",
  "userId": "user-uuid",
  "data": {
    "boardId": "1234567890",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "analysisName": "Automated Weekly Analysis"
  }
}
```

**Supported Actions:**
- `run_analysis` - Trigger variance analysis
- `sync_data` - Sync Monday/QuickBooks data
- `notify_variances` - Send notifications

---

### Webhook Health Check

**GET** `/api/webhooks/n8n`

**Headers:**
```
Authorization: Bearer YOUR_N8N_WEBHOOK_SECRET
```

**Response:**
```json
{
  "status": "active",
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00Z",
  "supportedActions": ["run_analysis", "sync_data", "notify_variances"]
}
```

---

## Error Responses

All endpoints return consistent error responses:

**401 Unauthorized:**
```json
{
  "error": "Unauthorized"
}
```

**400 Bad Request:**
```json
{
  "error": "Board ID is required"
}
```

**404 Not Found:**
```json
{
  "error": "Board not found or access denied"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to fetch board data",
  "details": "Specific error message"
}
```

---

## Usage Examples

### Complete Workflow: Run Analysis & Update Board

```javascript
// 1. List boards
const boardsResponse = await fetch('/api/monday/boards');
const { boards } = await boardsResponse.json();

// 2. Get board details
const boardData = await fetch(`/api/monday/boards/${boards[0].id}`);
const { items, columns } = await boardData.json();

// 3. Run variance analysis
const analysisResponse = await fetch('/api/variance/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    boardId: boards[0].id,
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    analysisName: 'Q4 2024 Analysis'
  })
});
const { analysis } = await analysisResponse.json();

// 4. Update board with results
const updateResponse = await fetch(`/api/monday/boards/${boards[0].id}/update`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    analysisId: analysis.id,
    columnMappings: {
      actualColumn: 'numbers2',
      varianceColumn: 'numbers3',
      statusColumn: 'status'
    },
    updates: items.map(item => ({
      itemId: item.id,
      columnValues: {} // Populated from analysis results
    }))
  })
});
```

---

## Rate Limits

- **Monday.com API**: 10,000 requests per minute per account
- **n8n Webhooks**: No built-in limits (configure in n8n)
- **Internal APIs**: No limits (add rate limiting in production)

---

## Best Practices

1. **Batch Operations**: Use bulk update endpoints instead of individual updates
2. **Error Handling**: Always check response status and handle errors gracefully
3. **Column IDs**: Cache column IDs instead of fetching on every update
4. **Webhooks**: Use idempotency keys for webhook retries
5. **Performance**: Paginate large board queries (use Monday's pagination)

---

## Support

- GitHub Issues: https://github.com/jasonsaas/MondayFP-A-App/issues
- Monday.com API Docs: https://developer.monday.com/api-reference
- QuickBooks API Docs: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account