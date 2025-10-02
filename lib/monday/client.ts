/**
 * Monday.com API Client
 *
 * Production-ready client for Monday.com API v2024-01
 * Handles rate limits, retries, and batch operations
 */

import {
  MondayBoard,
  MondayItem,
  MondayColumn,
  MondayApiOptions,
  MondayApiError,
  MondayRateLimit,
  BatchUpdateItem,
  RATE_LIMIT,
  VARIANCE_STATUS_LABELS,
} from './types';

export class MondayClient {
  private apiKey: string;
  private apiVersion: string;
  private apiUrl = 'https://api.monday.com/v2';
  private retryAttempts: number;
  private retryDelay: number;
  private timeout: number;
  private rateLimit: MondayRateLimit = {
    complexity: 0,
    resetAt: new Date(),
    remaining: RATE_LIMIT.MAX_COMPLEXITY_PER_MINUTE,
  };

  constructor(options: MondayApiOptions) {
    if (!options.apiKey && !process.env.MONDAY_API_KEY) {
      throw new Error('Monday API key is required');
    }

    this.apiKey = options.apiKey || process.env.MONDAY_API_KEY!;
    this.apiVersion = options.apiVersion || '2024-01';
    this.retryAttempts = options.retryAttempts || RATE_LIMIT.MAX_RETRIES;
    this.retryDelay = options.retryDelay || RATE_LIMIT.RETRY_DELAY_MS;
    this.timeout = options.timeout || 30000;
  }

  /**
   * Execute GraphQL query with rate limiting and retry logic
   */
  private async executeQuery<T = any>(
    query: string,
    variables?: Record<string, any>,
    attemptCount = 0
  ): Promise<T> {
    // Check rate limit
    await this.checkRateLimit();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json',
          'API-Version': this.apiVersion,
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Update rate limit from headers
      this.updateRateLimitFromHeaders(response.headers);

      if (!response.ok) {
        throw await this.createApiError(response);
      }

      const data = await response.json();

      // Check for GraphQL errors
      if (data.errors && data.errors.length > 0) {
        throw this.createGraphQLError(data.errors);
      }

      // Check for rate limit in response
      if (data.error_code === 'ComplexityException') {
        throw this.createRateLimitError(data);
      }

      return data.data as T;
    } catch (error: any) {
      // Handle retryable errors
      if (this.isRetryable(error) && attemptCount < this.retryAttempts) {
        const delay = this.calculateRetryDelay(attemptCount);
        console.log(`Retrying query after ${delay}ms (attempt ${attemptCount + 1}/${this.retryAttempts})`);
        await this.sleep(delay);
        return this.executeQuery<T>(query, variables, attemptCount + 1);
      }

      throw error;
    }
  }

  /**
   * Get board with all columns and items
   */
  async getBoard(
    boardId: string,
    options?: {
      limit?: number;
      cursor?: string;
      includeArchived?: boolean;
    }
  ): Promise<MondayBoard> {
    const limit = options?.limit || 500;
    const cursor = options?.cursor || null;

    const query = `
      query GetBoard($boardId: ID!, $limit: Int, $cursor: String) {
        boards(ids: [$boardId]) {
          id
          name
          description
          columns {
            id
            title
            type
            settings_str
            archived
          }
          groups {
            id
            title
            color
          }
          items_page(limit: $limit, cursor: $cursor) {
            cursor
            items {
              id
              name
              group {
                id
                title
              }
              column_values {
                id
                value
                text
                type
              }
            }
          }
        }
      }
    `;

    const variables = {
      boardId: parseInt(boardId),
      limit,
      cursor,
    };

    const result = await this.executeQuery<{ boards: MondayBoard[] }>(
      query,
      variables
    );

    if (!result.boards || result.boards.length === 0) {
      throw new Error(`Board ${boardId} not found`);
    }

    return result.boards[0];
  }

  /**
   * Get all items from a board (handles pagination)
   */
  async getAllBoardItems(boardId: string): Promise<MondayItem[]> {
    const allItems: MondayItem[] = [];
    let cursor: string | undefined = undefined;

    while (true) {
      const board = await this.getBoard(boardId, { cursor });

      if (board.items_page?.items) {
        allItems.push(...board.items_page.items);
      }

      // Check if there are more pages
      if (!board.items_page?.cursor) {
        break;
      }

      cursor = board.items_page.cursor;
    }

    return allItems;
  }

  /**
   * Create a new column on a board
   */
  async createColumn(
    boardId: string,
    title: string,
    columnType: string,
    settings?: Record<string, any>
  ): Promise<MondayColumn> {
    const query = `
      mutation CreateColumn($boardId: ID!, $title: String!, $columnType: ColumnType!, $defaults: JSON) {
        create_column(
          board_id: $boardId
          title: $title
          column_type: $columnType
          defaults: $defaults
        ) {
          id
          title
          type
          settings_str
        }
      }
    `;

    const variables = {
      boardId: parseInt(boardId),
      title,
      columnType,
      defaults: settings ? JSON.stringify(settings) : null,
    };

    const result = await this.executeQuery<{ create_column: MondayColumn }>(
      query,
      variables
    );

    return result.create_column;
  }

  /**
   * Create variance columns if they don't exist
   */
  async createVarianceColumns(
    boardId: string,
    existingColumns: MondayColumn[]
  ): Promise<{
    varianceColumn: MondayColumn;
    variancePercentColumn: MondayColumn;
    severityColumn: MondayColumn;
  }> {
    const existingIds = new Set(existingColumns.map((c) => c.id));

    // Create Variance (Dollar) column
    let varianceColumn = existingColumns.find((c) => c.title === 'Variance ($)');
    if (!varianceColumn) {
      console.log('Creating Variance ($) column...');
      varianceColumn = await this.createColumn(boardId, 'Variance ($)', 'numbers', {
        unit: '$',
      });
    }

    // Create Variance (%) column
    let variancePercentColumn = existingColumns.find(
      (c) => c.title === 'Variance (%)'
    );
    if (!variancePercentColumn) {
      console.log('Creating Variance (%) column...');
      variancePercentColumn = await this.createColumn(
        boardId,
        'Variance (%)',
        'numbers',
        {
          unit: '%',
        }
      );
    }

    // Create Severity Status column
    let severityColumn = existingColumns.find((c) => c.title === 'Severity');
    if (!severityColumn) {
      console.log('Creating Severity column...');

      const statusSettings = {
        labels: {
          0: VARIANCE_STATUS_LABELS.critical.label,
          1: VARIANCE_STATUS_LABELS.warning.label,
          2: VARIANCE_STATUS_LABELS.normal.label,
          3: VARIANCE_STATUS_LABELS.favorable.label,
        },
        labels_colors: {
          0: {
            color: VARIANCE_STATUS_LABELS.critical.color,
            border: VARIANCE_STATUS_LABELS.critical.color,
          },
          1: {
            color: VARIANCE_STATUS_LABELS.warning.color,
            border: VARIANCE_STATUS_LABELS.warning.color,
          },
          2: {
            color: VARIANCE_STATUS_LABELS.normal.color,
            border: VARIANCE_STATUS_LABELS.normal.color,
          },
          3: {
            color: VARIANCE_STATUS_LABELS.favorable.color,
            border: VARIANCE_STATUS_LABELS.favorable.color,
          },
        },
      };

      severityColumn = await this.createColumn(
        boardId,
        'Severity',
        'status',
        statusSettings
      );
    }

    return {
      varianceColumn,
      variancePercentColumn,
      severityColumn,
    };
  }

  /**
   * Update a single item's column values
   */
  async updateItemColumns(
    itemId: string,
    boardId: string,
    columnValues: Record<string, any>
  ): Promise<MondayItem> {
    const query = `
      mutation UpdateItem($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
        change_multiple_column_values(
          board_id: $boardId
          item_id: $itemId
          column_values: $columnValues
        ) {
          id
          name
          column_values {
            id
            value
            text
            type
          }
        }
      }
    `;

    const variables = {
      boardId: parseInt(boardId),
      itemId: parseInt(itemId),
      columnValues: JSON.stringify(columnValues),
    };

    const result = await this.executeQuery<{
      change_multiple_column_values: MondayItem;
    }>(query, variables);

    return result.change_multiple_column_values;
  }

  /**
   * Batch update multiple items
   * Handles rate limiting by splitting into chunks
   */
  async batchUpdateItems(
    boardId: string,
    updates: BatchUpdateItem[]
  ): Promise<void> {
    const chunks = this.chunkArray(updates, RATE_LIMIT.BATCH_SIZE);

    console.log(
      `Batch updating ${updates.length} items in ${chunks.length} chunks...`
    );

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Processing chunk ${i + 1}/${chunks.length} (${chunk.length} items)...`);

      // Process chunk items sequentially to avoid rate limits
      for (const update of chunk) {
        await this.updateItemColumns(update.itemId, boardId, update.columnValues);
      }

      // Add delay between chunks to avoid rate limits
      if (i < chunks.length - 1) {
        await this.sleep(500);
      }
    }

    console.log('Batch update complete!');
  }

  /**
   * Create a dashboard widget
   */
  async createDashboardWidget(
    boardId: string,
    widgetType: string,
    title: string,
    settings?: Record<string, any>
  ): Promise<any> {
    // Note: Widget creation requires workspace context
    // This is a simplified version - actual implementation may vary
    const query = `
      mutation CreateWidget($boardId: ID!, $kind: WidgetKind!, $title: String!, $settings: JSON) {
        create_board_view(
          board_id: $boardId
          kind: $kind
          title: $title
          settings: $settings
        ) {
          id
          name
          type
        }
      }
    `;

    const variables = {
      boardId: parseInt(boardId),
      kind: widgetType,
      title,
      settings: settings ? JSON.stringify(settings) : null,
    };

    const result = await this.executeQuery(query, variables);
    return result;
  }

  /**
   * Subscribe to board webhooks
   */
  async createWebhook(
    boardId: string,
    url: string,
    event: string,
    config?: Record<string, any>
  ): Promise<any> {
    const query = `
      mutation CreateWebhook($boardId: ID!, $url: String!, $event: WebhookEventType!, $config: JSON) {
        create_webhook(
          board_id: $boardId
          url: $url
          event: $event
          config: $config
        ) {
          id
          board_id
          url
        }
      }
    `;

    const variables = {
      boardId: parseInt(boardId),
      url,
      event,
      config: config ? JSON.stringify(config) : null,
    };

    const result = await this.executeQuery<{ create_webhook: any }>(
      query,
      variables
    );

    return result.create_webhook;
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    const query = `
      mutation DeleteWebhook($webhookId: ID!) {
        delete_webhook(id: $webhookId) {
          id
        }
      }
    `;

    await this.executeQuery(query, { webhookId: parseInt(webhookId) });
  }

  /**
   * Check rate limit and wait if necessary
   */
  private async checkRateLimit(): Promise<void> {
    const now = new Date();

    // Reset counter if minute has passed
    if (now >= this.rateLimit.resetAt) {
      this.rateLimit.complexity = 0;
      this.rateLimit.remaining = RATE_LIMIT.MAX_COMPLEXITY_PER_MINUTE;
      this.rateLimit.resetAt = new Date(now.getTime() + 60000); // +1 minute
    }

    // Wait if we're close to the limit
    if (this.rateLimit.remaining < 1000) {
      const waitTime = this.rateLimit.resetAt.getTime() - now.getTime();
      console.log(`Rate limit approaching, waiting ${waitTime}ms...`);
      await this.sleep(waitTime);

      // Reset after waiting
      this.rateLimit.complexity = 0;
      this.rateLimit.remaining = RATE_LIMIT.MAX_COMPLEXITY_PER_MINUTE;
      this.rateLimit.resetAt = new Date(Date.now() + 60000);
    }
  }

  /**
   * Update rate limit from response headers
   */
  private updateRateLimitFromHeaders(headers: Headers): void {
    const complexity = headers.get('x-query-complexity');
    const remaining = headers.get('x-rate-limit-remaining');

    if (complexity) {
      this.rateLimit.complexity += parseInt(complexity);
      this.rateLimit.remaining -= parseInt(complexity);
    }
  }

  /**
   * Create API error from response
   */
  private async createApiError(response: Response): Promise<MondayApiError> {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }

    const error = new Error(
      errorData.error_message || errorData.message || 'Monday API error'
    ) as MondayApiError;

    error.statusCode = response.status;
    error.errorCode = errorData.error_code;
    error.errorData = errorData;
    error.retryable = this.isRetryableStatusCode(response.status);

    return error;
  }

  /**
   * Create error from GraphQL errors
   */
  private createGraphQLError(errors: any[]): MondayApiError {
    const firstError = errors[0];
    const error = new Error(
      firstError.message || 'GraphQL error'
    ) as MondayApiError;

    error.errorCode = firstError.extensions?.code;
    error.errorData = errors;
    error.retryable = false;

    return error;
  }

  /**
   * Create rate limit error
   */
  private createRateLimitError(data: any): MondayApiError {
    const error = new Error(
      'Rate limit exceeded - too many complexity points'
    ) as MondayApiError;

    error.errorCode = 'ComplexityException';
    error.errorData = data;
    error.retryable = true;

    return error;
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: any): boolean {
    if (error.retryable === true) return true;
    if (error.name === 'AbortError') return true;
    if (this.isRetryableStatusCode(error.statusCode)) return true;
    if (error.errorCode === 'ComplexityException') return true;

    return false;
  }

  /**
   * Check if status code is retryable
   */
  private isRetryableStatusCode(statusCode?: number): boolean {
    if (!statusCode) return false;

    // Retry on server errors and rate limits
    return (
      statusCode === 429 || // Too Many Requests
      statusCode === 500 || // Internal Server Error
      statusCode === 502 || // Bad Gateway
      statusCode === 503 || // Service Unavailable
      statusCode === 504 // Gateway Timeout
    );
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attemptCount: number): number {
    return this.retryDelay * Math.pow(2, attemptCount);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Export singleton instance
let clientInstance: MondayClient | null = null;

export function getMondayClient(options?: MondayApiOptions): MondayClient {
  if (!clientInstance) {
    clientInstance = new MondayClient(options || {});
  }
  return clientInstance;
}

export function createMondayClient(options: MondayApiOptions): MondayClient {
  return new MondayClient(options);
}
