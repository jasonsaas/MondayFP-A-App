import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { syncLogs, organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Webhook endpoint for n8n to trigger variance alerts
 *
 * Security: Uses HMAC-SHA256 signature validation
 *
 * @example n8n workflow
 * POST /api/webhooks/n8n/variance-alert
 * Headers:
 *   X-N8N-Signature: sha256=<hmac>
 * Body:
 *   {
 *     "organizationId": "uuid",
 *     "severity": "critical",
 *     "variances": [...],
 *     "period": "2025-10",
 *     "boardId": 123456
 *   }
 */

interface VarianceAlertPayload {
  organizationId: string;
  severity: 'critical' | 'warning' | 'info';
  variances: Array<{
    accountName: string;
    accountCode?: string;
    budgetAmount: number;
    actualAmount: number;
    variance: number;
    variancePercent: number;
    direction: 'favorable' | 'unfavorable' | 'neutral';
  }>;
  period: string;
  boardId?: number;
  metadata?: Record<string, any>;
}

interface EmailNotification {
  organizationId: string;
  to: string[];
  subject: string;
  severity: 'critical' | 'warning' | 'info';
  variances: any[];
  period: string;
  queuedAt: Date;
}

// In-memory notification queue (in production, use Redis queue or message broker)
const notificationQueue: EmailNotification[] = [];

/**
 * Verify webhook signature using HMAC-SHA256
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const providedSignature = signature.startsWith('sha256=')
      ? signature.slice(7)
      : signature;

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(providedSignature)
    );
  } catch (error) {
    console.error('❌ Webhook signature verification error:', error);
    return false;
  }
}

/**
 * Queue email notification for processing
 */
function queueEmailNotification(notification: EmailNotification): void {
  notificationQueue.push(notification);
  console.log(`📧 Queued ${notification.severity} alert for ${notification.to.length} recipient(s)`);

  // TODO: In production, push to Redis queue or message broker (e.g., Bull, BullMQ)
  // Example: await emailQueue.add('variance-alert', notification);
}

/**
 * POST /api/webhooks/n8n/variance-alert
 *
 * Receives variance alerts from n8n and queues notifications
 */
export async function POST(request: NextRequest) {
  try {
    // Get webhook secret from environment
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('❌ N8N_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { success: false, error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('x-n8n-signature');

    // Verify webhook signature
    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      console.error('❌ Invalid webhook signature');
      return NextResponse.json(
        { success: false, error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    // Parse payload
    let payload: VarianceAlertPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const { organizationId, severity, variances, period, boardId, metadata } = payload;

    // Validate required fields
    if (!organizationId || !severity || !variances || !period) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: organizationId, severity, variances, period'
        },
        { status: 400 }
      );
    }

    // Validate severity
    if (!['critical', 'warning', 'info'].includes(severity)) {
      return NextResponse.json(
        { success: false, error: 'Invalid severity. Must be: critical, warning, or info' },
        { status: 400 }
      );
    }

    // Get organization
    const [org] = await db
      .select({
        id: organizations.id,
        name: organizations.mondayAccountName,
        billingEmail: organizations.billingEmail,
        settings: organizations.settings,
        active: organizations.active,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    if (!org.active) {
      return NextResponse.json(
        { success: false, error: 'Organization is not active' },
        { status: 403 }
      );
    }

    // Log alert for each variance
    const alertLogs = [];
    for (const variance of variances) {
      const [log] = await db
        .insert(syncLogs)
        .values({
          organizationId,
          syncType: 'alert',
          status: 'completed',
          source: 'n8n_webhook',
          metadata: {
            severity,
            accountName: variance.accountName,
            accountCode: variance.accountCode,
            budgetAmount: variance.budgetAmount,
            actualAmount: variance.actualAmount,
            variance: variance.variance,
            variancePercent: variance.variancePercent,
            direction: variance.direction,
            period,
            boardId,
            webhookMetadata: metadata,
          },
        })
        .returning();

      alertLogs.push(log);

      // Console log based on severity
      const emoji = severity === 'critical' ? '🚨' : severity === 'warning' ? '⚠️' : 'ℹ️';
      console.log(
        `${emoji} [${severity.toUpperCase()}] ${org.name} - ${variance.accountName}: ` +
        `${variance.variancePercent.toFixed(1)}% variance (${variance.direction})`
      );
    }

    // Queue email notification if billing email exists
    const recipients: string[] = [];

    if (org.billingEmail) {
      recipients.push(org.billingEmail);
    }

    // Add additional recipients from settings
    if (org.settings?.notifications?.alertEmails) {
      const additionalEmails = org.settings.notifications.alertEmails;
      if (Array.isArray(additionalEmails)) {
        recipients.push(...additionalEmails);
      }
    }

    if (recipients.length > 0) {
      const notification: EmailNotification = {
        organizationId,
        to: [...new Set(recipients)], // Remove duplicates
        subject: `${severity === 'critical' ? '🚨 Critical' : severity === 'warning' ? '⚠️ Warning' : 'ℹ️'} Variance Alert - ${org.name} (${period})`,
        severity,
        variances,
        period,
        queuedAt: new Date(),
      };

      queueEmailNotification(notification);
    }

    // Return success response
    return NextResponse.json({
      success: true,
      organizationId,
      organizationName: org.name,
      severity,
      alertsLogged: alertLogs.length,
      period,
      notificationsQueued: recipients.length,
      recipients: recipients.length > 0 ? recipients : undefined,
      metadata: {
        alertLogIds: alertLogs.map((log) => log.id),
        boardId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('❌ Variance alert webhook error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/n8n/variance-alert
 *
 * Get notification queue status (for monitoring)
 */
export async function GET(request: NextRequest) {
  try {
    // Simple API key check for monitoring
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== process.env.N8N_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      queue: {
        pending: notificationQueue.length,
        items: notificationQueue.map((n) => ({
          organizationId: n.organizationId,
          severity: n.severity,
          recipients: n.to.length,
          period: n.period,
          queuedAt: n.queuedAt,
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Queue status error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
