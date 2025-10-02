/**
 * Next.js Instrumentation
 *
 * This file is automatically loaded by Next.js to initialize monitoring
 * and instrumentation before the application starts.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side instrumentation
    const { initSentryServer } = await import('./lib/monitoring/sentry');
    initSentryServer();
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime instrumentation
    const { initSentryServer } = await import('./lib/monitoring/sentry');
    initSentryServer();
  }
}
