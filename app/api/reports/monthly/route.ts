// app/api/reports/monthly/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/app/api/middleware/auth';
import { db } from '@/db';
import { organizations, varianceAnalyses } from '@/db/schema';
import { and, eq, gte, lte } from 'drizzle-orm';

/**
 * POST /api/reports/monthly
 *
 * Generate monthly PDF variance report
 *
 * Request body:
 * {
 *   organizationId: string;
 *   period: string; // YYYY-MM format
 *   includeCharts?: boolean;
 *   includeInsights?: boolean;
 * }
 */
export async function POST(request: NextRequest) {
  // Validate API key
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const {
      organizationId,
      period,
      includeCharts = true,
      includeInsights = true,
    } = body;

    // Validate required fields
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json(
        { error: 'period is required in YYYY-MM format' },
        { status: 400 }
      );
    }

    // Get organization
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Parse period dates
    const [year, month] = period.split('-').map(Number);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59);

    // Get variance analyses for the period
    const analyses = await db
      .select()
      .from(varianceAnalyses)
      .where(
        and(
          eq(varianceAnalyses.organizationId, organizationId),
          gte(varianceAnalyses.periodStart, periodStart),
          lte(varianceAnalyses.periodEnd, periodEnd)
        )
      )
      .orderBy(varianceAnalyses.createdAt);

    if (analyses.length === 0) {
      return NextResponse.json(
        {
          error: 'No variance data found',
          message: `No variance analyses found for period ${period}`,
        },
        { status: 404 }
      );
    }

    // Get the most recent analysis
    const latestAnalysis = analyses[analyses.length - 1];

    // Generate PDF report data structure
    const reportData = {
      organization: {
        name: org.mondayAccountName || 'Organization',
        period,
        generatedAt: new Date().toISOString(),
      },
      summary: {
        totalBudget: parseFloat(latestAnalysis.totalBudget || '0'),
        totalActual: parseFloat(latestAnalysis.totalActual || '0'),
        totalVariance: parseFloat(latestAnalysis.totalVariance || '0'),
        totalVariancePercent: parseFloat(latestAnalysis.totalVariancePercent || '0'),
        criticalCount: latestAnalysis.criticalCount,
        warningCount: latestAnalysis.warningCount,
        normalCount: latestAnalysis.normalCount,
      },
      variances: latestAnalysis.results?.variances || [],
      insights: includeInsights ? latestAnalysis.results?.insights || [] : [],
      charts: includeCharts
        ? {
            budgetVsActual: true,
            varianceByCategory: true,
            trendAnalysis: true,
          }
        : null,
    };

    // In a real implementation, you would use a library like PDFKit, jsPDF, or Puppeteer
    // to generate the actual PDF. For now, we'll return the structured data.

    // TODO: Implement actual PDF generation
    // Example with PDFKit:
    // const PDFDocument = require('pdfkit');
    // const doc = new PDFDocument();
    // doc.text('Monthly Variance Report', 100, 100);
    // ... add report content
    // const pdfBuffer = await generatePDFBuffer(doc);

    // For now, return JSON with indication that PDF would be generated
    const mockPdfBase64 = Buffer.from(JSON.stringify(reportData, null, 2)).toString('base64');

    console.log(`📊 Monthly report generated for ${org.mondayAccountName} - ${period}`);

    return NextResponse.json({
      success: true,
      organizationId,
      period,
      reportData,
      // In production, this would be actual PDF:
      // pdf: pdfBuffer.toString('base64'),
      // contentType: 'application/pdf',
      mockPdf: mockPdfBase64, // Remove this in production
      message:
        'Report data generated successfully. PDF generation would happen here in production.',
      metadata: {
        includeCharts,
        includeInsights,
        varianceAnalysisId: latestAnalysis.id,
        totalAnalyses: analyses.length,
      },
    });
  } catch (error: any) {
    console.error('Monthly report generation error:', error);
    return NextResponse.json(
      {
        error: 'Report generation failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reports/monthly
 *
 * Get list of available monthly reports
 *
 * Query params:
 * - organizationId: string (required)
 */
export async function GET(request: NextRequest) {
  // Validate API key
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId parameter is required' },
        { status: 400 }
      );
    }

    // Get all variance analyses for the organization
    const analyses = await db
      .select({
        id: varianceAnalyses.id,
        periodLabel: varianceAnalyses.periodLabel,
        periodStart: varianceAnalyses.periodStart,
        periodEnd: varianceAnalyses.periodEnd,
        criticalCount: varianceAnalyses.criticalCount,
        warningCount: varianceAnalyses.warningCount,
        totalVariancePercent: varianceAnalyses.totalVariancePercent,
        createdAt: varianceAnalyses.createdAt,
      })
      .from(varianceAnalyses)
      .where(eq(varianceAnalyses.organizationId, organizationId))
      .orderBy(varianceAnalyses.periodStart);

    // Group by period
    const reportsByPeriod = analyses.reduce((acc: any, analysis) => {
      const period = analysis.periodLabel;
      if (!acc[period]) {
        acc[period] = [];
      }
      acc[period].push(analysis);
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      organizationId,
      periods: Object.keys(reportsByPeriod).sort().reverse(),
      reportsByPeriod,
      totalReports: analyses.length,
    });
  } catch (error: any) {
    console.error('Report list error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get report list',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
