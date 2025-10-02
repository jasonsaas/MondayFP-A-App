// app/api/organizations/active/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/app/api/middleware/auth';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  // Validate API key
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    // Get active organizations
    const activeOrgs = await db
      .select()
      .from(organizations)
      .where(eq(organizations.isActive, true));

    return NextResponse.json({
      success: true,
      data: activeOrgs,
      count: activeOrgs.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching active organizations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
