# n8n Integration Guide

Complete guide for integrating n8n workflows with your FP&A application.

## 🎯 Overview

This guide covers the complete setup of n8n automation workflows that connect QuickBooks, Monday.com, and your FP&A application.

## 📋 Prerequisites

Before starting, ensure you have:

1. ✅ **Application deployed** with all environment variables configured
2. ✅ **Database migrated** with all tables created
3. ✅ **Monday.com OAuth** configured and working
4. ✅ **QuickBooks OAuth** configured and working
5. ✅ **n8n instance** running (cloud or self-hosted)
6. ✅ **API key** generated for n8n authentication

## 🔑 Authentication Setup

### Step 1: Generate API Key

The API key for n8n has been provided:

```bash
N8N_API_KEY=7YCV0vazDSwvro4HuR7rKQQ67lImK2H5rfQ9jRCnUps=
```

Add this to your application's `.env.local`:

```bash
# .env.local
N8N_API_KEY=7YCV0vazDSwvro4HuR7rKQQ67lImK2H5rfQ9jRCnUps=
```

### Step 2: Configure n8n Environment Variables

In your n8n instance, set these environment variables:

```bash
# Application Connection
APP_URL=https://your-app.vercel.app
APP_API_KEY=7YCV0vazDSwvro4HuR7rKQQ67lImK2H5rfQ9jRCnUps=

# Slack Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# n8n Configuration
WEBHOOK_URL=https://your-n8n-instance.com
N8N_URL=https://your-n8n-instance.com

# Optional: PagerDuty for Critical Alerts
PAGERDUTY_WEBHOOK_URL=https://events.pagerduty.com/v2/enqueue
PAGERDUTY_ROUTING_KEY=your-integration-key
```

### Step 3: Create n8n Credentials

1. Open n8n UI
2. Go to **Credentials** → **New**
3. Select **Header Auth**
4. Configure:
   - **Name**: `FP&A App API Key`
   - **Header Name**: `X-API-Key`
   - **Value**: `7YCV0vazDSwvro4HuR7rKQQ67lImK2H5rfQ9jRCnUps=`
5. Save

## 📡 API Endpoints Reference

Your application now exposes these endpoints for n8n:

### Organization Management

```
GET /api/organizations/active
Headers: X-API-Key: <your-key>

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Organization Name",
      "mondayAccountId": 12345,
      "quickbooksRealmId": "67890",
      "isActive": true,
      "syncFrequency": "hourly"
    }
  ],
  "count": 1,
  "timestamp": "2025-10-02T..."
}
```

### QuickBooks Sync

```
POST /api/sync/quickbooks
Headers: X-API-Key: <your-key>
Content-Type: application/json

Body:
{
  "organizationId": "uuid",
  "options": {
    "syncAccounts": true,
    "syncPL": true,
    "syncBalanceSheet": false,
    "forceRefresh": false
  }
}

Response:
{
  "success": true,
  "syncId": "uuid",
  "status": "completed",
  "itemsSynced": 45,
  "message": "Sync completed successfully"
}
```

### Variance Calculation

```
POST /api/variance/calculate
Headers: X-API-Key: <your-key>
Content-Type: application/json

Body:
{
  "organizationId": "uuid",
  "boardId": 123456,
  "period": "2025-10",
  "budgetItems": [...],
  "actualItems": [...],
  "options": {
    "generateInsights": true,
    "syncToMonday": true,
    "notifyCritical": true
  }
}

Response:
{
  "variances": [...],
  "insights": [...],
  "summary": {
    "totalVariance": 12345.67,
    "criticalCount": 3,
    "warningCount": 5
  },
  "fromCache": false
}
```

### Monday.com Boards

```
GET /api/monday/boards?organizationId=uuid
Headers: X-API-Key: <your-key>

Response:
{
  "success": true,
  "boards": [
    {
      "id": "123456",
      "name": "Q1 2025 Budget",
      "state": "active",
      "workspace_id": 789
    }
  ],
  "count": 1,
  "organizationId": "uuid"
}
```

### Webhook Verification

```
POST /api/webhooks/monday/verify
Headers: X-API-Key: <your-key>
Content-Type: application/json

Body:
{
  "signature": "sha256=abc123...",
  "body": "{\"event\": {...}}"
}

Response:
{
  "valid": true,
  "algorithm": "sha256"
}
```

### Webhook Logging

```
POST /api/webhooks/log
Headers: X-API-Key: <your-key>
Content-Type: application/json

Body:
{
  "source": "monday_webhook",
  "event": "change_column_value",
  "boardId": 123456,
  "itemId": 789,
  "status": "success",
  "metadata": {...}
}

Response:
{
  "success": true,
  "logged": true,
  "timestamp": "2025-10-02T..."
}
```

### Error Logging

```
POST /api/errors/log
Headers: X-API-Key: <your-key>
Content-Type: application/json

Body:
{
  "source": "n8n",
  "workflowId": "workflow-123",
  "workflowName": "QuickBooks Sync",
  "executionId": "exec-456",
  "errorNode": "Trigger QuickBooks Sync",
  "errorMessage": "Connection timeout",
  "errorStack": "Error: timeout...",
  "severity": "critical",
  "timestamp": "2025-10-02T...",
  "metadata": {...}
}

Response:
{
  "success": true,
  "logged": true,
  "severity": "critical",
  "timestamp": "2025-10-02T..."
}
```

## 🔄 Workflow Import Instructions

### Import Workflows

1. Download workflow JSON files from `/n8n/workflows/`:
   - `1-quickbooks-sync.json`
   - `2-variance-calculation.json`
   - `3-monday-webhook.json`
   - `4-error-handler.json`

2. In n8n UI:
   - Click **Workflows** → **Import from File**
   - Select each JSON file
   - Click **Import**

3. For each imported workflow:
   - Open the workflow
   - Click **Settings**
   - Update the credential to `FP&A App API Key` (created earlier)
   - **Activate** the workflow (toggle switch)

### Configure Error Workflow

For workflows 1-3, set the error handler:

1. Open workflow
2. Click **Settings** (gear icon)
3. Under **Error Workflow**, select `Error Handler - Global`
4. Save

## 🔗 Monday.com Webhook Setup

### Step 1: Get Your n8n Webhook URL

After importing workflow `3-monday-webhook.json`:

1. Open the workflow in n8n
2. Click the **Webhook** trigger node
3. Copy the **Production URL** (e.g., `https://your-n8n.com/webhook/monday-webhook`)

### Step 2: Configure Monday.com Webhook

1. Go to Monday.com board
2. Click **Integrations** → **Webhooks**
3. Add new webhook:
   - **URL**: Your n8n webhook URL
   - **Events**: Select:
     - `change_column_value`
     - `create_pulse`
     - `update_pulse`
   - **Secret**: Your `MONDAY_SIGNING_SECRET` from `.env.local`
4. Save

### Step 3: Test the Webhook

```bash
# Test with curl
curl -X POST https://your-n8n.com/webhook/monday-webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: sha256=test-signature" \
  -d '{
    "event": {
      "type": "change_column_value",
      "boardId": 123456,
      "pulseId": 789,
      "columnId": "numbers",
      "value": "1000"
    }
  }'
```

## 🧪 Testing the Integration

### Test 1: Active Organizations

```bash
curl -X GET https://your-app.com/api/organizations/active \
  -H "X-API-Key: 7YCV0vazDSwvro4HuR7rKQQ67lImK2H5rfQ9jRCnUps="
```

**Expected**: JSON with list of active organizations

### Test 2: QuickBooks Sync

```bash
curl -X POST https://your-app.com/api/sync/quickbooks \
  -H "X-API-Key: 7YCV0vazDSwvro4HuR7rKQQ67lImK2H5rfQ9jRCnUps=" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "your-org-id",
    "options": {
      "syncAccounts": true,
      "syncPL": true
    }
  }'
```

**Expected**: JSON with sync status and items synced count

### Test 3: Monday Boards

```bash
curl -X GET "https://your-app.com/api/monday/boards?organizationId=your-org-id" \
  -H "X-API-Key: 7YCV0vazDSwvro4HuR7rKQQ67lImK2H5rfQ9jRCnUps="
```

**Expected**: JSON with list of Monday.com boards

### Test 4: Webhook Signature Verification

```bash
curl -X POST https://your-app.com/api/webhooks/monday/verify \
  -H "X-API-Key: 7YCV0vazDSwvro4HuR7rKQQ67lImK2H5rfQ9jRCnUps=" \
  -H "Content-Type: application/json" \
  -d '{
    "signature": "test-signature",
    "body": "{\"test\": true}"
  }'
```

**Expected**: JSON with `valid: true/false`

### Test 5: Manual Workflow Execution

In n8n:

1. Open **QuickBooks Sync** workflow
2. Click **Execute Workflow**
3. Check execution log for:
   - ✅ Organizations fetched
   - ✅ Sync triggered
   - ✅ Status logged
4. Verify in Slack for notifications (if errors occur)

## 📊 Monitoring & Logs

### n8n Execution Logs

- Go to **Executions** tab in n8n
- Filter by workflow name
- Click execution to see detailed node outputs
- Check for errors (red indicators)

### Application Logs

Check your application logs for:

```
[Webhook Log] monday_webhook:change_column_value - success
🚨 [CRITICAL] n8n Error: QuickBooks Sync - Scheduled
✅ Variance recalculated successfully for board 123456
```

### Slack Notifications

Critical alerts will appear in your configured Slack channel:

```
🚨 Critical Budget Variances Detected

Board: Q1 2025 Budget
Critical Items: 3
Total Variance: $45,234.12

Issues:
• Marketing spend 17.5% over budget ($12,500)
```

## 🐛 Troubleshooting

### Issue: "Unauthorized - Invalid API Key"

**Solution**:
1. Verify `N8N_API_KEY` in app `.env.local`
2. Verify `APP_API_KEY` in n8n environment variables
3. Ensure they match exactly
4. Restart both services

### Issue: "Organization not found"

**Solution**:
1. Check organization exists: `SELECT * FROM organizations WHERE is_active = true`
2. Verify `organizationId` in request matches database
3. Ensure organization has `is_active = true`

### Issue: "QuickBooks not connected"

**Solution**:
1. Check organization has `quickbooks_realm_id`
2. Verify QuickBooks OAuth flow completed
3. Check token expiration: `SELECT quickbooks_token_expires_at FROM organizations`
4. Re-authenticate if expired

### Issue: Webhook not receiving events

**Solution**:
1. Verify webhook URL is publicly accessible
2. Check Monday.com webhook configuration
3. Test with curl command above
4. Check n8n execution logs
5. Verify HMAC signature verification

### Issue: No Slack notifications

**Solution**:
1. Test Slack webhook: `curl -X POST $SLACK_WEBHOOK_URL -d '{"text": "test"}'`
2. Verify `SLACK_WEBHOOK_URL` in n8n
3. Check n8n node execution for errors
4. Ensure Slack app has proper permissions

## 🚀 Production Checklist

Before going live:

- [ ] All environment variables configured
- [ ] API key matches between app and n8n
- [ ] All 4 workflows imported and activated
- [ ] Error handler workflow linked to other workflows
- [ ] Monday.com webhook configured and tested
- [ ] Slack notifications working
- [ ] Test manual execution of each workflow
- [ ] Verify QuickBooks sync completes successfully
- [ ] Confirm variance calculations generate insights
- [ ] Check webhook processes Monday.com events
- [ ] Monitor for first 24 hours
- [ ] Set up alerting for critical errors

## 📚 Additional Resources

- **n8n Workflows Documentation**: `/n8n/README.md`
- **Workflow Summary**: `/n8n/WORKFLOWS_SUMMARY.md`
- **API Documentation**: Check each route file in `/app/api/`
- **Database Schema**: `/db/schema.ts`
- **Deployment Guide**: `/DEPLOYMENT.md`

## 🆘 Support

If you encounter issues:

1. Check n8n execution logs for detailed error messages
2. Review application logs for API errors
3. Test API endpoints independently with curl
4. Verify all environment variables are set
5. Consult workflow-specific documentation in `WORKFLOWS_SUMMARY.md`

---

**Setup Complete!** 🎉

Your n8n automation workflows are now integrated with your FP&A application. The system will:

- ✅ Sync QuickBooks data every 4 hours
- ✅ Calculate variances every hour
- ✅ Process Monday.com changes in real-time
- ✅ Alert you to critical budget issues
- ✅ Log all errors centrally

**Next Step**: Monitor the first few automated runs to ensure everything works smoothly!
