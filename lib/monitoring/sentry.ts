/**
 * Sentry Error Tracking & Performance Monitoring
 *
 * Centralized error tracking and performance monitoring configuration.
 * Captures errors, traces, and user context for debugging production issues.
 */

import * as Sentry from '@sentry/nextjs';

interface SentryConfig {
  dsn?: string;
  environment: string;
  tracesSampleRate: number;
  enabled: boolean;
}

/**
 * Get Sentry configuration from environment
 */
function getSentryConfig(): SentryConfig {
  return {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === 'production',
  };
}

/**
 * Initialize Sentry for client-side
 */
export function initSentryClient() {
  const config = getSentryConfig();

  if (!config.enabled) {
    console.log('Sentry disabled (no DSN or not in production)');
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    tracesSampleRate: config.tracesSampleRate,

    // Integrations
    integrations: [
      new Sentry.BrowserTracing({
        tracePropagationTargets: [
          'localhost',
          /^https:\/\/.*\.vercel\.app/,
          /^https:\/\/.*\.yourapp\.com/,
        ],
      }),
      new Sentry.Replay({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Don't send PII
    beforeSend(event, hint) {
      // Remove sensitive data
      if (event.request?.headers) {
        delete event.request.headers['Authorization'];
        delete event.request.headers['Cookie'];
      }

      // Filter out specific errors
      if (event.exception) {
        const error = hint.originalException;

        // Ignore network errors from ad blockers
        if (error instanceof Error && error.message.includes('adsbygoogle')) {
          return null;
        }

        // Ignore 404s
        if (error instanceof Error && error.message.includes('404')) {
          return null;
        }
      }

      return event;
    },

    // Ignore specific errors
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'chrome-extension://',
      'moz-extension://',
      // Network errors
      'NetworkError',
      'Failed to fetch',
      'Load failed',
      // Common third-party errors
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
    ],

    // Performance monitoring
    beforeSendTransaction(event) {
      // Don't send health check transactions
      if (event.transaction?.includes('/api/health')) {
        return null;
      }
      return event;
    },
  });

  console.log('Sentry initialized for client');
}

/**
 * Initialize Sentry for server-side
 */
export function initSentryServer() {
  const config = getSentryConfig();

  if (!config.enabled) {
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    tracesSampleRate: config.tracesSampleRate,

    // Server-specific options
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
    ],

    beforeSend(event) {
      // Remove sensitive data
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }

      if (event.extra) {
        // Remove OAuth tokens
        delete event.extra.mondayAccessToken;
        delete event.extra.quickbooksAccessToken;
        delete event.extra.refreshToken;
      }

      return event;
    },
  });

  console.log('Sentry initialized for server');
}

/**
 * Set user context for Sentry
 */
export function setUserContext(user: {
  id: string;
  email?: string;
  organizationId?: string;
}) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    organizationId: user.organizationId,
  });
}

/**
 * Clear user context (on logout)
 */
export function clearUserContext() {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  data?: Record<string, any>,
  level: Sentry.SeverityLevel = 'info'
) {
  Sentry.addBreadcrumb({
    message,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Capture exception with context
 */
export function captureException(
  error: Error,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
    level?: Sentry.SeverityLevel;
  }
) {
  Sentry.withScope((scope) => {
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    if (context?.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    if (context?.level) {
      scope.setLevel(context.level);
    }

    Sentry.captureException(error);
  });
}

/**
 * Capture message
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
  }
) {
  Sentry.withScope((scope) => {
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    if (context?.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    Sentry.captureMessage(message, level);
  });
}

/**
 * Start a new transaction for performance monitoring
 */
export function startTransaction(
  name: string,
  op: string,
  data?: Record<string, any>
) {
  return Sentry.startTransaction({
    name,
    op,
    data,
  });
}

/**
 * Wrap async function with Sentry error handling
 */
export function withSentry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: {
    operationName?: string;
    tags?: Record<string, string>;
  }
): T {
  return (async (...args: any[]) => {
    const transaction = options?.operationName
      ? Sentry.startTransaction({ name: options.operationName, op: 'function' })
      : null;

    try {
      if (options?.tags) {
        Object.entries(options.tags).forEach(([key, value]) => {
          transaction?.setTag(key, value);
        });
      }

      const result = await fn(...args);
      transaction?.setStatus('ok');
      return result;
    } catch (error) {
      transaction?.setStatus('internal_error');
      captureException(error as Error, {
        tags: options?.tags,
        extra: { args },
      });
      throw error;
    } finally {
      transaction?.finish();
    }
  }) as T;
}

/**
 * Create a Sentry-wrapped API route handler
 */
export function withSentryAPI<T extends (...args: any[]) => Promise<Response>>(
  handler: T
): T {
  return withSentry(handler, {
    operationName: 'api.request',
    tags: { type: 'api' },
  });
}

// Export Sentry for direct use
export { Sentry };
