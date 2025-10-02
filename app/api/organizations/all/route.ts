// app/api/organizations/all/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/app/api/middleware/auth';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/organizations/all
 *
 * Returns all organizations for monthly report generation
 * Includes contact email for report delivery
 *
 * Query params:
 * - active?: boolean (default: true) - filter by active status
 */
export async function GET(request: NextRequest) {
  // Validate API key
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('active') !== 'false'; // Default to true

    // Build query
    let query = db.select({
      id: organizations.id,
      name: organizations.mondayAccountName,
      mondayAccountId: organizations.mondayAccountId,
      quickbooksRealmId: organizations.quickbooksRealmId,
      billingEmail: organizations.billingEmail,
      subscriptionTier: organizations.subscriptionTier,
      subscriptionStatus: organizations.subscriptionStatus,
      settings: organizations.settings,
      active: organizations.active,
      createdAt: organizations.createdAt,
      updatedAt: organizations.updatedAt,
    }).from(organizations);

    // Apply active filter if requested
    if (activeOnly) {
      query = query.where(eq(organizations.active, true));
    }

    const allOrgs = await query;

    // Categorize organizations by status
    const categorized = {
      active: allOrgs.filter((org) => org.active),
      inactive: allOrgs.filter((org) => !org.active),
      withQuickBooks: allOrgs.filter((org) => org.quickbooksRealmId),
      withoutQuickBooks: allOrgs.filter((org) => !org.quickbooksRealmId),
      withBillingEmail: allOrgs.filter((org) => org.billingEmail),
      withoutBillingEmail: allOrgs.filter((org) => !org.billingEmail),
    };

    return NextResponse.json({
      success: true,
      data: allOrgs,
      count: allOrgs.length,
      summary: {
        total: allOrgs.length,
        active: categorized.active.length,
        inactive: categorized.inactive.length,
        withQuickBooks: categorized.withQuickBooks.length,
        withoutQuickBooks: categorized.withoutQuickBooks.length,
        withBillingEmail: categorized.withBillingEmail.length,
        withoutBillingEmail: categorized.withoutBillingEmail.length,
      },
      filters: {
        activeOnly,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching all organizations:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizations/all
 *
 * Bulk update organizations (for admin tasks)
 *
 * Request body:
 * {
 *   updates: Array<{
 *     id: string;
 *     billingEmail?: string;
 *     settings?: object;
 *     active?: boolean;
 *   }>
 * }
 */
export async function POST(request: NextRequest) {
  // Validate API key
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { updates } = body;

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'updates array is required' },
        { status: 400 }
      );
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'updates array cannot be empty' },
        { status: 400 }
      );
    }

    const results = [];

    // Process each update
    for (const update of updates) {
      const { id, billingEmail, settings, active } = update;

      if (!id) {
        results.push({
          id: null,
          success: false,
          error: 'Organization ID is required',
        });
        continue;
      }

      try {
        // Build update object
        const updateData: any = {
          updatedAt: new Date(),
        };

        if (billingEmail !== undefined) updateData.billingEmail = billingEmail;
        if (settings !== undefined) updateData.settings = settings;
        if (active !== undefined) updateData.active = active;

        // Update organization
        const [updated] = await db
          .update(organizations)
          .set(updateData)
          .where(eq(organizations.id, id))
          .returning();

        if (updated) {
          results.push({
            id,
            success: true,
            updated: Object.keys(updateData).filter((k) => k !== 'updatedAt'),
          });
        } else {
          results.push({
            id,
            success: false,
            error: 'Organization not found',
          });
        }
      } catch (error: any) {
        results.push({
          id,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: failureCount === 0,
      results,
      summary: {
        total: updates.length,
        successful: successCount,
        failed: failureCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Bulk update error:', error);
    return NextResponse.json(
      {
        error: 'Bulk update failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
