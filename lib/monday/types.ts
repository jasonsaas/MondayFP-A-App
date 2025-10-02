/**
 * Monday.com Integration Types
 *
 * Type definitions for Monday.com API v2024-01
 */

export type MondayColumnType =
  | 'text'
  | 'long_text'
  | 'numbers'
  | 'status'
  | 'dropdown'
  | 'date'
  | 'people'
  | 'timeline'
  | 'tags'
  | 'email'
  | 'phone'
  | 'link'
  | 'rating'
  | 'formula'
  | 'dependency'
  | 'world_clock'
  | 'location'
  | 'creation_log'
  | 'last_updated';

export interface MondayColumn {
  id: string;
  title: string;
  type: MondayColumnType;
  settings_str?: string;
  archived?: boolean;
}

export interface MondayColumnValue {
  id: string;
  value: string | null;
  text?: string;
  type: MondayColumnType;
}

export interface MondayItem {
  id: string;
  name: string;
  column_values: MondayColumnValue[];
  group?: {
    id: string;
    title: string;
  };
}

export interface MondayBoard {
  id: string;
  name: string;
  description?: string;
  columns: MondayColumn[];
  items_page?: {
    items: MondayItem[];
    cursor?: string;
  };
  groups?: Array<{
    id: string;
    title: string;
    color: string;
  }>;
}

export interface MondayWebhookPayload {
  event: {
    type: string;
    userId: number;
    triggerTime: string;
    subscriptionId: number;
    triggerUuid: string;
  };
  challenge?: string;
  boardId?: number;
  itemId?: number;
  columnId?: string;
  value?: any;
  previousValue?: any;
}

export interface ColumnMapping {
  budgetColumn?: string;
  actualColumn?: string;
  varianceColumn?: string;
  variancePercentColumn?: string;
  severityColumn?: string;
  accountTypeColumn?: string;
  periodColumn?: string;
  accountCodeColumn?: string;
  notesColumn?: string;
}

export interface DetectedColumn {
  id: string;
  title: string;
  type: MondayColumnType;
  confidence: 'high' | 'medium' | 'low';
  purpose: keyof ColumnMapping;
}

export interface MondayRateLimit {
  complexity: number;
  resetAt: Date;
  remaining: number;
}

export interface MondayApiOptions {
  apiKey?: string;
  apiVersion?: string;
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
}

export interface BatchUpdateItem {
  itemId: string;
  columnValues: Record<string, any>;
}

export interface MondayApiError extends Error {
  statusCode?: number;
  errorCode?: string;
  errorData?: any;
  retryable?: boolean;
}

// Status column settings for variance severity
export interface StatusColumnSettings {
  labels: {
    [key: string]: string; // key is index, value is label
  };
  labels_colors: {
    [key: string]: {
      color: string;
      border: string;
    };
  };
}

// Variance status labels
export const VARIANCE_STATUS_LABELS = {
  critical: { label: 'Critical', color: '#e2445c', index: 0 },
  warning: { label: 'Warning', color: '#fdab3d', index: 1 },
  normal: { label: 'Normal', color: '#00c875', index: 2 },
  favorable: { label: 'Favorable', color: '#0086c0', index: 3 },
};

// Webhook event types
export type MondayWebhookEvent =
  | 'create_item'
  | 'change_column_value'
  | 'change_status_column_value'
  | 'create_update'
  | 'delete_update'
  | 'item_deleted'
  | 'item_archived';

export interface WebhookSubscription {
  id: string;
  boardId: string;
  event: MondayWebhookEvent;
  url: string;
  config?: string;
}

// GraphQL query complexity costs
export const QUERY_COMPLEXITY_COSTS = {
  board: 1,
  items: 1,
  column: 1,
  column_values: 1,
  group: 1,
  updates: 5,
  subscribers: 5,
  assets: 5,
  create_item: 10,
  change_column_values: 10,
  create_column: 10,
};

// Rate limit constants
export const RATE_LIMIT = {
  MAX_COMPLEXITY_PER_MINUTE: 10000000, // 10M complexity points
  BATCH_SIZE: 25, // Max items per batch update
  RETRY_DELAY_MS: 1000, // Initial retry delay
  MAX_RETRIES: 3,
};
