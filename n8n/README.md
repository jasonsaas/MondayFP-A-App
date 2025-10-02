# n8n Workflow Automation for FP&A Platform

This directory contains n8n workflow configurations for automating QuickBooks synchronization, variance calculations, and Monday.com integrations.

## 📋 Table of Contents

- [Overview](#overview)
- [Workflows](#workflows)
- [Prerequisites](#prerequisites)
- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [Workflow Import](#workflow-import)
- [Credentials Configuration](#credentials-configuration)
- [Testing](#testing)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Production Deployment](#production-deployment)

## Overview

The n8n automation workflows handle:

- **Scheduled Data Sync**: Automatic QuickBooks data synchronization every 4 hours
- **Variance Calculations**: Hourly variance analysis across all active organizations
- **Real-time Updates**: Webhook-based processing for Monday.com board changes
- **Error Handling**: Centralized error tracking and alerting

## Workflows

### 1. QuickBooks Sync - Scheduled (`1-quickbooks-sync.json`)

**Trigger**: Every 4 hours
**Purpose**: Sync QuickBooks financial data for all active organizations

**Flow**:
1. Fetch active organizations from `/api/organizations/active`
2. Trigger QuickBooks sync for each organization via `/api/sync/quickbooks`
3. Log success/failure for each organization
4. Send Slack notifications if any errors occur

**Key Features**:
- Parallel processing for multiple organizations
- Error handling with continuation (one failure doesn't stop others)
- Consolidated error reporting
- Detailed execution logging

### 2. Variance Calculation - Auto Trigger (`2-variance-calculation.json`)

**Trigger**: Every 1 hour
**Purpose**: Calculate budget vs. actual variances and generate AI insights

**Flow**:
1. Fetch organizations with variance analysis enabled
2. Get all Monday boards for each organization
3. Calculate variance for each board via `/api/variance/calculate`
4. Check for critical variances (threshold breaches)
5. Send Slack alerts for critical budget issues
6. Generate execution summary

**Key Features**:
- Filters organizations by `syncFrequency` setting (realtime/hourly)
- Generates AI-powered insights
- Syncs results back to Monday.com
- Critical variance alerting with detailed insights

### 3. Monday.com Webhook - Real-time Updates (`3-monday-webhook.json`)

**Trigger**: Webhook (POST)
**Purpose**: Process real-time Monday.com board changes

**Flow**:
1. Receive webhook from Monday.com
2. Verify HMAC signature for security
3. Extract event data (board ID, item ID, column changes)
4. Filter relevant events (change_column_value, create_pulse, update_pulse)
5. Trigger variance recalculation for affected board
6. Log webhook event

**Key Features**:
- HMAC signature verification for security
- Event filtering to process only relevant changes
- Fast response times (< 3 seconds)
- Comprehensive event logging
- Proper webhook response handling

**Setup**: Configure webhook URL in Monday.com board integrations:
```
https://your-n8n-instance.com/webhook/monday-webhook
```

### 4. Error Handler - Global (`4-error-handler.json`)

**Trigger**: Called by other workflows on error
**Purpose**: Centralized error tracking, logging, and alerting

**Flow**:
1. Extract error details (workflow, node, message, stack trace)
2. Determine error severity (critical vs. warning)
3. Format notification with error context
4. Send Slack alert with execution link
5. Log error to application database
6. Send PagerDuty alert for critical errors (optional)

**Key Features**:
- Severity classification (critical vs. warning)
- Multi-channel notifications (Slack, PagerDuty, Email)
- Error aggregation and deduplication
- Stack trace capture
- Integration with application error logging

**Critical Error Triggers**:
- Connection refused (ECONNREFUSED)
- Timeout errors
- Authentication failures
- Rate limit exceeded
- Database connection issues

## Prerequisites

### Software Requirements

- **n8n**: Version 1.0+ (self-hosted or cloud)
- **Node.js**: 18.x or higher
- **PostgreSQL**: For n8n database (optional but recommended for production)
- **Redis**: For n8n queue mode (optional, recommended for scaling)

### Hosting Options

1. **Self-hosted**: Docker, Railway, DigitalOcean, AWS
2. **n8n Cloud**: https://n8n.io/cloud/ (managed hosting)
3. **Local Development**: Docker Compose (included in main app)

## Setup Instructions

### Option 1: Using Docker Compose (Recommended for Development)

The main application's `docker-compose.yml` already includes n8n:

```bash
# Start all services including n8n
docker-compose up -d

# Access n8n at http://localhost:5678
```

### Option 2: Self-hosted n8n with Docker

```bash
# Create n8n volume for data persistence
docker volume create n8n_data

# Run n8n container
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=your-secure-password \
  -e WEBHOOK_URL=https://your-n8n-instance.com \
  docker.n8n.io/n8nio/n8n
```

### Option 3: n8n Cloud

1. Sign up at https://n8n.io/cloud/
2. Create a new workspace
3. Import workflows (see below)

## Environment Variables

Add these environment variables to your n8n instance:

### Required

```bash
# FP&A Application
APP_URL=https://your-fpna-app.com
APP_API_KEY=your-secure-api-key-here

# Slack Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX

# n8n Configuration
WEBHOOK_URL=https://your-n8n-instance.com
N8N_URL=https://your-n8n-instance.com
```

### Optional

```bash
# PagerDuty (for critical alerts)
PAGERDUTY_WEBHOOK_URL=https://events.pagerduty.com/v2/enqueue
PAGERDUTY_ROUTING_KEY=your-pagerduty-integration-key

# Email Notifications (alternative to Slack)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@yourapp.com
```

### Setting Environment Variables

**In n8n UI**:
1. Go to Settings → Environments
2. Add each variable with name and value
3. Save changes

**In Docker**:
```bash
docker run -d \
  -e APP_URL=https://your-app.com \
  -e APP_API_KEY=your-key \
  -e SLACK_WEBHOOK_URL=https://hooks.slack.com/... \
  docker.n8n.io/n8nio/n8n
```

**In Docker Compose**:
```yaml
services:
  n8n:
    environment:
      - APP_URL=https://your-app.com
      - APP_API_KEY=${N8N_API_KEY}
      - SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL}
```

## Workflow Import

### Import All Workflows

1. Open n8n UI (http://localhost:5678 or your n8n URL)
2. Click **Workflows** in the left sidebar
3. Click **Import from File** button
4. Select each workflow JSON file:
   - `1-quickbooks-sync.json`
   - `2-variance-calculation.json`
   - `3-monday-webhook.json`
   - `4-error-handler.json`
5. Click **Import**

### Via n8n CLI

```bash
# Navigate to n8n workflows directory
cd n8n/workflows

# Import using n8n CLI
n8n import:workflow --input=1-quickbooks-sync.json
n8n import:workflow --input=2-variance-calculation.json
n8n import:workflow --input=3-monday-webhook.json
n8n import:workflow --input=4-error-handler.json
```

## Credentials Configuration

### 1. FP&A App API Key

1. In n8n, go to **Credentials** → **New**
2. Select **Header Auth**
3. Configure:
   - **Name**: `FP&A App API Key`
   - **Header Name**: `X-API-Key`
   - **Value**: Your API key from `.env` file (`N8N_WEBHOOK_SECRET`)
4. Save

### 2. Slack Webhook (if using Slack nodes)

1. Create webhook in Slack: https://api.slack.com/messaging/webhooks
2. In n8n, no credential needed (uses environment variable)

### 3. PagerDuty (optional)

1. Get integration key from PagerDuty service
2. Set `PAGERDUTY_ROUTING_KEY` environment variable

## Testing

### Test Individual Workflows

1. **QuickBooks Sync**:
   ```bash
   # Trigger manually in n8n UI
   # Or use n8n CLI
   n8n execute --id=<workflow-id>
   ```

2. **Variance Calculation**:
   ```bash
   # Execute manually or wait for hourly trigger
   # Check Slack for notifications
   ```

3. **Monday Webhook**:
   ```bash
   # Test with curl
   curl -X POST https://your-n8n-instance.com/webhook/monday-webhook \
     -H "Content-Type: application/json" \
     -H "Authorization: your-monday-signature" \
     -d '{"event": {"type": "change_column_value", "boardId": 123, "pulseId": 456}}'
   ```

4. **Error Handler**:
   ```bash
   # Trigger an error in another workflow to test
   # Check Slack and PagerDuty for alerts
   ```

### Monitoring Test Results

- **n8n Executions**: View in n8n UI under **Executions**
- **Slack**: Check configured Slack channel for notifications
- **Application Logs**: Check `/api/webhooks/log` for webhook events
- **Database**: Query `sync_logs` table for sync results

## Monitoring

### Key Metrics to Track

1. **Execution Success Rate**: % of successful workflow runs
2. **Average Execution Time**: Track workflow performance
3. **Error Rate**: Monitor failures and retries
4. **Data Volume**: Number of organizations/boards processed

### n8n Built-in Monitoring

1. **Executions View**: See all workflow runs with status
2. **Execution Details**: Inspect each node's input/output
3. **Error Logs**: View error messages and stack traces

### External Monitoring

**Application Health Check**:
```bash
curl https://your-app.com/api/health?deep
```

**n8n Health Check**:
```bash
curl https://your-n8n-instance.com/healthz
```

### Alerts Configuration

Set up alerts for:
- Workflow execution failures (> 3 consecutive)
- QuickBooks API rate limits
- Monday.com webhook signature failures
- Database connection issues
- High execution times (> 60 seconds)

## Troubleshooting

### Common Issues

#### 1. Workflow Not Triggering

**Symptoms**: Scheduled workflow doesn't run

**Solutions**:
- Check workflow is activated (toggle in n8n UI)
- Verify trigger schedule configuration
- Check n8n server time zone
- Review n8n logs: `docker logs n8n`

#### 2. API Authentication Failures

**Symptoms**: `401 Unauthorized` or `403 Forbidden` errors

**Solutions**:
- Verify `APP_API_KEY` environment variable
- Check credential configuration in n8n
- Ensure API key matches `.env.local` in main app
- Test API endpoint manually with curl

#### 3. Webhook Not Receiving Events

**Symptoms**: Monday.com changes don't trigger workflow

**Solutions**:
- Verify webhook URL is publicly accessible
- Check Monday.com webhook configuration
- Test webhook with curl (see Testing section)
- Verify HMAC signature verification
- Check n8n firewall/network settings

#### 4. Slack Notifications Not Sending

**Symptoms**: No Slack messages despite errors

**Solutions**:
- Verify `SLACK_WEBHOOK_URL` environment variable
- Test webhook URL with curl
- Check Slack app permissions
- Review n8n execution logs for HTTP errors

#### 5. High Memory Usage / Performance

**Symptoms**: n8n crashes or slows down

**Solutions**:
- Enable queue mode with Redis
- Increase Docker memory limit
- Reduce workflow execution concurrency
- Archive old executions
- Use PostgreSQL for n8n database (instead of SQLite)

### Debug Mode

Enable debug logging in n8n:

```bash
# Docker
docker run -e N8N_LOG_LEVEL=debug docker.n8n.io/n8nio/n8n

# Docker Compose
environment:
  - N8N_LOG_LEVEL=debug
```

### Logs Location

- **Docker**: `docker logs n8n`
- **Self-hosted**: `~/.n8n/logs/`
- **Application logs**: Check main app at `/api/errors/log`

## Production Deployment

### Best Practices

1. **Use PostgreSQL**: Replace SQLite with PostgreSQL for reliability
   ```bash
   docker run \
     -e DB_TYPE=postgresdb \
     -e DB_POSTGRESDB_HOST=postgres \
     -e DB_POSTGRESDB_PORT=5432 \
     -e DB_POSTGRESDB_DATABASE=n8n \
     -e DB_POSTGRESDB_USER=n8n \
     -e DB_POSTGRESDB_PASSWORD=secure-password \
     docker.n8n.io/n8nio/n8n
   ```

2. **Enable Queue Mode**: Use Redis for horizontal scaling
   ```bash
   docker run \
     -e EXECUTIONS_MODE=queue \
     -e QUEUE_BULL_REDIS_HOST=redis \
     -e QUEUE_BULL_REDIS_PORT=6379 \
     docker.n8n.io/n8nio/n8n
   ```

3. **Set Up SSL**: Use reverse proxy (nginx, Caddy) for HTTPS
   ```nginx
   server {
     listen 443 ssl;
     server_name n8n.yourapp.com;

     ssl_certificate /path/to/cert.pem;
     ssl_certificate_key /path/to/key.pem;

     location / {
       proxy_pass http://localhost:5678;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
     }
   }
   ```

4. **Configure Backups**: Backup n8n database and workflows
   ```bash
   # PostgreSQL backup
   pg_dump -U n8n n8n > n8n_backup_$(date +%F).sql

   # Workflow export
   n8n export:workflow --all --output=./workflows-backup/
   ```

5. **Set Resource Limits**: Configure memory/CPU limits
   ```yaml
   services:
     n8n:
       deploy:
         resources:
           limits:
             cpus: '2'
             memory: 2G
   ```

6. **Enable Monitoring**: Use Prometheus + Grafana
   ```bash
   docker run \
     -e N8N_METRICS=true \
     -e N8N_METRICS_PREFIX=n8n_ \
     docker.n8n.io/n8nio/n8n
   ```

### Deployment Platforms

#### Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init

# Add PostgreSQL
railway add postgresql

# Deploy n8n
railway up
```

#### DigitalOcean

Use DigitalOcean App Platform or Droplet:

```bash
# 1-Click n8n Droplet available in marketplace
# Or use Docker Compose setup
```

#### AWS ECS

```bash
# Use AWS Fargate with n8n Docker image
# Configure ALB for HTTPS
# Use RDS PostgreSQL for database
# Use ElastiCache Redis for queue
```

### Security Considerations

1. **Enable Basic Auth**:
   ```bash
   -e N8N_BASIC_AUTH_ACTIVE=true \
   -e N8N_BASIC_AUTH_USER=admin \
   -e N8N_BASIC_AUTH_PASSWORD=strong-password
   ```

2. **Restrict Webhook Access**: Use firewall rules or API gateway

3. **Rotate API Keys**: Regularly update `APP_API_KEY`

4. **Use Secrets Management**: AWS Secrets Manager, HashiCorp Vault

5. **Enable Audit Logging**: Track all workflow changes

### Scaling

**Horizontal Scaling** (multiple n8n instances):
```yaml
services:
  n8n:
    image: docker.n8n.io/n8nio/n8n
    deploy:
      replicas: 3
    environment:
      - EXECUTIONS_MODE=queue
      - QUEUE_BULL_REDIS_HOST=redis
```

**Vertical Scaling** (increase resources):
```yaml
services:
  n8n:
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G
```

## Support

### Resources

- **n8n Documentation**: https://docs.n8n.io/
- **n8n Community**: https://community.n8n.io/
- **FP&A App Documentation**: `../docs/`
- **API Reference**: `../docs/API.md`

### Getting Help

1. Check n8n execution logs for detailed error messages
2. Review application logs at `/api/errors/log`
3. Test API endpoints independently with curl/Postman
4. Consult workflow-specific documentation above
5. Open issue on GitHub repository

### Workflow Versions

- **Version**: 1.0.0
- **Last Updated**: 2025-10-02
- **Compatible n8n Version**: 1.0+
- **Compatible App Version**: 1.0.0+

---

## Quick Start Checklist

- [ ] Install n8n (Docker or Cloud)
- [ ] Set environment variables (APP_URL, APP_API_KEY, SLACK_WEBHOOK_URL)
- [ ] Import all 4 workflows
- [ ] Configure credentials (FP&A App API Key)
- [ ] Activate workflows (toggle switch in n8n UI)
- [ ] Test QuickBooks sync manually
- [ ] Test variance calculation manually
- [ ] Configure Monday.com webhook URL
- [ ] Test webhook with sample event
- [ ] Trigger error handler with test error
- [ ] Monitor Slack for notifications
- [ ] Check execution history for success
- [ ] Set up production monitoring (optional)
- [ ] Configure backups (production only)

**You're all set!** 🎉 Your n8n workflows are now automating QuickBooks sync, variance calculations, and Monday.com integrations.
