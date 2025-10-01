/**
 * n8n Client Library
 *
 * Provides a typed interface for interacting with n8n workflows
 * Supports webhook triggers, status checks, and workflow management
 */

export interface N8nWorkflowTrigger {
  workflowId?: string;
  webhookPath?: string;
  data: Record<string, any>;
  headers?: Record<string, string>;
}

export interface N8nWorkflowResponse {
  success: boolean;
  executionId?: string;
  data?: any;
  error?: string;
  timestamp: string;
}

export interface N8nSyncJob {
  id: string;
  workflowId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export class N8nClient {
  private baseUrl: string;
  private webhookSecret: string;
  private apiKey?: string;

  constructor(config?: {
    baseUrl?: string;
    webhookSecret?: string;
    apiKey?: string;
  }) {
    this.baseUrl = config?.baseUrl || process.env.N8N_WEBHOOK_URL || 'http://localhost:5678';
    this.webhookSecret = config?.webhookSecret || process.env.N8N_WEBHOOK_SECRET || '';
    this.apiKey = config?.apiKey || process.env.N8N_API_KEY;
  }

  /**
   * Trigger an n8n workflow via webhook
   */
  async triggerWorkflow(params: N8nWorkflowTrigger): Promise<N8nWorkflowResponse> {
    try {
      const url = params.webhookPath
        ? `${this.baseUrl}${params.webhookPath}`
        : `${this.baseUrl}/webhook/fpa-platform`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...params.headers,
      };

      // Add authentication if available
      if (this.webhookSecret) {
        headers['Authorization'] = `Bearer ${this.webhookSecret}`;
      }

      if (this.apiKey) {
        headers['X-N8N-API-KEY'] = this.apiKey;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(params.data),
      });

      if (!response.ok) {
        throw new Error(`n8n workflow trigger failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        executionId: data.executionId || data.id,
        data: data,
        timestamp: new Date().toISOString(),
      };

    } catch (error: any) {
      console.error('n8n trigger error:', error);
      return {
        success: false,
        error: error.message || 'Failed to trigger n8n workflow',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Trigger variance analysis workflow
   */
  async triggerVarianceAnalysis(params: {
    userId: string;
    organizationId: string;
    boardId: string;
    startDate: string;
    endDate: string;
    analysisName?: string;
  }): Promise<N8nWorkflowResponse> {
    return this.triggerWorkflow({
      webhookPath: '/webhook/variance-analysis',
      data: {
        action: 'run_analysis',
        userId: params.userId,
        organizationId: params.organizationId,
        data: {
          boardId: params.boardId,
          startDate: params.startDate,
          endDate: params.endDate,
          analysisName: params.analysisName || `Analysis ${new Date().toLocaleDateString()}`,
        },
      },
    });
  }

  /**
   * Trigger data sync workflow (Monday.com ↔ QuickBooks)
   */
  async triggerDataSync(params: {
    userId: string;
    organizationId: string;
    source: 'monday' | 'quickbooks';
    destination: 'monday' | 'quickbooks';
    syncType: 'full' | 'incremental' | 'variance_update';
    entityType?: 'boards' | 'items' | 'accounts' | 'transactions';
    entityIds?: string[];
  }): Promise<N8nWorkflowResponse> {
    return this.triggerWorkflow({
      webhookPath: '/webhook/data-sync',
      data: {
        action: 'sync_data',
        userId: params.userId,
        organizationId: params.organizationId,
        data: {
          source: params.source,
          destination: params.destination,
          syncType: params.syncType,
          entityType: params.entityType,
          entityIds: params.entityIds,
        },
      },
    });
  }

  /**
   * Trigger notification workflow
   */
  async triggerNotification(params: {
    userId: string;
    organizationId: string;
    analysisId: string;
    notificationType: 'email' | 'slack' | 'teams' | 'webhook';
    recipients?: string[];
    channels?: string[];
    severity?: 'info' | 'warning' | 'critical';
  }): Promise<N8nWorkflowResponse> {
    return this.triggerWorkflow({
      webhookPath: '/webhook/notifications',
      data: {
        action: 'notify_variances',
        userId: params.userId,
        organizationId: params.organizationId,
        data: {
          analysisId: params.analysisId,
          notificationType: params.notificationType,
          recipients: params.recipients,
          channels: params.channels,
          severity: params.severity || 'info',
        },
      },
    });
  }

  /**
   * Schedule recurring analysis
   */
  async scheduleRecurringAnalysis(params: {
    userId: string;
    organizationId: string;
    boardId: string;
    schedule: {
      frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
      dayOfWeek?: number; // 0-6 for weekly
      dayOfMonth?: number; // 1-31 for monthly
      time?: string; // HH:mm format
    };
    enabled: boolean;
  }): Promise<N8nWorkflowResponse> {
    return this.triggerWorkflow({
      webhookPath: '/webhook/schedule-analysis',
      data: {
        action: 'schedule_analysis',
        userId: params.userId,
        organizationId: params.organizationId,
        data: {
          boardId: params.boardId,
          schedule: params.schedule,
          enabled: params.enabled,
        },
      },
    });
  }

  /**
   * Get workflow execution status
   */
  async getExecutionStatus(executionId: string): Promise<{
    status: 'running' | 'success' | 'error' | 'waiting';
    data?: any;
    error?: string;
  }> {
    if (!this.apiKey) {
      throw new Error('API key required for status checks');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/executions/${executionId}`, {
        headers: {
          'X-N8N-API-KEY': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch execution status');
      }

      const execution = await response.json();

      return {
        status: execution.finished
          ? (execution.data?.resultData?.error ? 'error' : 'success')
          : execution.waitTill ? 'waiting' : 'running',
        data: execution.data,
        error: execution.data?.resultData?.error?.message,
      };

    } catch (error: any) {
      console.error('Status check error:', error);
      throw error;
    }
  }

  /**
   * Cancel a running workflow execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    if (!this.apiKey) {
      throw new Error('API key required to cancel executions');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/executions/${executionId}/stop`, {
        method: 'POST',
        headers: {
          'X-N8N-API-KEY': this.apiKey,
        },
      });

      return response.ok;

    } catch (error) {
      console.error('Cancel execution error:', error);
      return false;
    }
  }

  /**
   * Test n8n connectivity
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    version?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/healthz`, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return {
          healthy: true,
          version: data.version,
        };
      }

      return {
        healthy: false,
        error: `Health check failed: ${response.status}`,
      };

    } catch (error: any) {
      return {
        healthy: false,
        error: error.message || 'Connection failed',
      };
    }
  }

  /**
   * Validate webhook signature (for incoming webhooks)
   */
  validateWebhookSignature(
    payload: string,
    signature: string,
    secret?: string
  ): boolean {
    // Implement HMAC signature validation if needed
    // For now, simple bearer token comparison
    const expectedSecret = secret || this.webhookSecret;
    return signature === `Bearer ${expectedSecret}`;
  }

  /**
   * Format error for n8n response
   */
  static formatError(error: any): N8nWorkflowResponse {
    return {
      success: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Format success response
   */
  static formatSuccess(data?: any, executionId?: string): N8nWorkflowResponse {
    return {
      success: true,
      executionId,
      data,
      timestamp: new Date().toISOString(),
    };
  }
}

// Singleton instance
export const n8nClient = new N8nClient();

// Helper functions for common workflows
export const n8nWorkflows = {
  /**
   * Quick trigger for variance analysis
   */
  async runAnalysis(
    userId: string,
    organizationId: string,
    boardId: string,
    dateRange: { start: string; end: string }
  ) {
    return n8nClient.triggerVarianceAnalysis({
      userId,
      organizationId,
      boardId,
      startDate: dateRange.start,
      endDate: dateRange.end,
    });
  },

  /**
   * Quick trigger for board sync
   */
  async syncBoardToQuickBooks(
    userId: string,
    organizationId: string,
    boardId: string
  ) {
    return n8nClient.triggerDataSync({
      userId,
      organizationId,
      source: 'monday',
      destination: 'quickbooks',
      syncType: 'incremental',
      entityType: 'boards',
      entityIds: [boardId],
    });
  },

  /**
   * Quick trigger for critical variance notifications
   */
  async notifyCriticalVariances(
    userId: string,
    organizationId: string,
    analysisId: string,
    channels: string[]
  ) {
    return n8nClient.triggerNotification({
      userId,
      organizationId,
      analysisId,
      notificationType: 'slack',
      channels,
      severity: 'critical',
    });
  },
};