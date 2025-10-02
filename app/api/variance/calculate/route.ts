import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { VarianceEngine } from '@/lib/variance/engine';
import { BudgetItem, ActualItem, VarianceEngineOptions } from '@/lib/variance/types';
import {
  generateCacheKey,
  getCachedVariance,
  setCachedVariance,
} from '@/lib/variance/cache';

/**
 * POST /api/variance/calculate
 *
 * Production-ready variance calculation endpoint
 * Supports caching, hierarchical accounts, and AI insights
 *
 * Request body:
 * {
 *   organizationId: string;
 *   boardId: number;
 *   period: string;
 *   budgetItems: BudgetItem[];
 *   actualItems: ActualItem[];
 *   options?: VarianceEngineOptions;
 *   useCache?: boolean;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      organizationId,
      boardId,
      period,
      budgetItems,
      actualItems,
      options,
      useCache = true,
    } = body;

    // Validate required fields
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    if (!boardId) {
      return NextResponse.json({ error: 'boardId is required' }, { status: 400 });
    }

    if (!period) {
      return NextResponse.json({ error: 'period is required' }, { status: 400 });
    }

    if (!budgetItems || !Array.isArray(budgetItems)) {
      return NextResponse.json(
        { error: 'budgetItems array is required' },
        { status: 400 }
      );
    }

    // Verify organization exists
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check cache if enabled
    if (useCache) {
      const cacheKey = generateCacheKey(organizationId, boardId.toString(), period);
      const cached = await getCachedVariance(cacheKey);

      if (cached) {
        console.log('Variance cache hit:', cacheKey);
        return NextResponse.json({
          ...cached,
          fromCache: true,
        });
      }
    }

    // Initialize variance engine with custom thresholds from org settings
    const thresholds = org.settings?.thresholds
      ? {
          critical: org.settings.thresholds.critical,
          warning: org.settings.thresholds.warning,
          favorable: -5, // Default favorable threshold
        }
      : undefined;

    const engineOptions: VarianceEngineOptions = {
      thresholds,
      includeZeroVariances: options?.includeZeroVariances ?? false,
      includeChildren: options?.includeChildren ?? true,
      generateInsights: options?.generateInsights ?? true,
      includeTrends: options?.includeTrends ?? false,
      historicalPeriods: options?.historicalPeriods ?? 3,
    };

    const engine = new VarianceEngine(engineOptions);

    // Perform variance analysis
    const result = await engine.analyze(
      budgetItems as BudgetItem[],
      actualItems as ActualItem[],
      engineOptions
    );

    // Cache result if enabled
    if (useCache) {
      const cacheKey = generateCacheKey(organizationId, boardId.toString(), period);
      await setCachedVariance(cacheKey, result, 3600); // 1 hour TTL
      console.log('Variance cached:', cacheKey);
    }

    // Store snapshot in database for historical tracking
    await db.insert(require('@/lib/db/schema').varianceSnapshots).values({
      organizationId,
      boardId: parseInt(boardId),
      period,
      data: {
        variances: result.variances,
        insights: result.insights,
        summary: result.summary,
        totalVariance: result.totalVariance,
        totalVariancePercent: result.totalVariancePercent,
      },
    });

    return NextResponse.json({
      ...result,
      fromCache: false,
    });
  } catch (error: any) {
    console.error('Variance calculation error:', error);

    // Handle specific error types
    if (error.name === 'VarianceCalculationError') {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Variance calculation failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/variance/calculate
 *
 * Get variance calculation status and cache info
 *
 * Query params:
 * - organizationId: string
 * - boardId: number
 * - period: string
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const boardId = searchParams.get('boardId');
    const period = searchParams.get('period');

    if (!organizationId || !boardId || !period) {
      return NextResponse.json(
        { error: 'organizationId, boardId, and period are required' },
        { status: 400 }
      );
    }

    const cacheKey = generateCacheKey(organizationId, boardId, period);
    const cached = await getCachedVariance(cacheKey);

    if (cached) {
      return NextResponse.json({
        cached: true,
        cacheKey,
        generatedAt: cached.generatedAt,
        summary: cached.summary,
      });
    }

    // Check database for historical snapshot
    const snapshot = await db.query.varianceSnapshots.findFirst({
      where: eq(
        require('@/lib/db/schema').varianceSnapshots.organizationId,
        organizationId
      ),
    });

    if (snapshot) {
      return NextResponse.json({
        cached: false,
        hasSnapshot: true,
        snapshotDate: snapshot.createdAt,
      });
    }

    return NextResponse.json({
      cached: false,
      hasSnapshot: false,
      message: 'No variance data available. Run calculation first.',
    });
  } catch (error: any) {
    console.error('Variance status error:', error);
    return NextResponse.json(
      { error: 'Failed to get variance status', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/variance/calculate
 *
 * Invalidate variance cache
 *
 * Query params:
 * - organizationId: string
 * - boardId?: number
 * - period?: string
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const boardId = searchParams.get('boardId');
    const period = searchParams.get('period');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    const { invalidateVarianceCache } = await import('@/lib/variance/cache');
    await invalidateVarianceCache(
      organizationId,
      boardId || undefined,
      period || undefined
    );

    return NextResponse.json({
      success: true,
      message: 'Cache invalidated',
    });
  } catch (error: any) {
    console.error('Cache invalidation error:', error);
    return NextResponse.json(
      { error: 'Failed to invalidate cache', message: error.message },
      { status: 500 }
    );
  }
}
