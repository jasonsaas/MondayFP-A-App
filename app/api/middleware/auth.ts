// app/api/middleware/auth.ts
import { NextRequest, NextResponse } from 'next/server';

export function validateApiKey(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key');

  if (!apiKey || apiKey !== process.env.N8N_API_KEY) {
    return NextResponse.json(
      { error: 'Unauthorized - Invalid API Key' },
      { status: 401 }
    );
  }

  return null; // Valid key
}
