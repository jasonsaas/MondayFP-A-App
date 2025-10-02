/**
 * Sentry Server Configuration
 *
 * This file configures Sentry for the server-side (Node.js runtime).
 * It is automatically imported by Next.js.
 */

import { initSentryServer } from './lib/monitoring/sentry';

initSentryServer();
