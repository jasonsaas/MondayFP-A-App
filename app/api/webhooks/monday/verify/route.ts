// app/api/webhooks/monday/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { validateApiKey } from '@/app/api/middleware/auth';

/**
 * POST /api/webhooks/monday/verify
 *
 * Verify Monday.com webhook HMAC signature
 *
 * Request body:
 * {
 *   signature: string;
 *   body: string;
 * }
 */
export async function POST(request: NextRequest) {
  // Validate API key for n8n
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const { signature, body } = await request.json();

    if (!signature || !body) {
      return NextResponse.json(
        { error: 'signature and body are required' },
        { status: 400 }
      );
    }

    const signingSecret = process.env.MONDAY_SIGNING_SECRET;

    if (!signingSecret) {
      console.error('MONDAY_SIGNING_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook verification not configured' },
        { status: 500 }
      );
    }

    // Calculate HMAC signature
    const hmac = createHmac('sha256', signingSecret);
    hmac.update(body);
    const calculatedSignature = hmac.digest('hex');

    // Remove "sha256=" prefix if present in received signature
    const receivedSignature = signature.startsWith('sha256=')
      ? signature.substring(7)
      : signature;

    // Constant-time comparison to prevent timing attacks
    const valid = timingSafeEqual(
      Buffer.from(calculatedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    );

    return NextResponse.json({
      valid,
      algorithm: 'sha256',
    });
  } catch (error) {
    console.error('Webhook verification error:', error);
    return NextResponse.json(
      {
        error: 'Verification failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}
