/**
 * Sentry Edge Configuration
 *
 * This file configures Sentry for Edge runtime (middleware, edge functions).
 * It is automatically imported by Next.js.
 */

import { initSentryServer } from './lib/monitoring/sentry';

initSentryServer();
