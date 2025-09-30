import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { mondayBoards, budgetItems, actualTransactions, varianceAnalyses, varianceResults } from '@/db/schema/fpa';
import { integrationSettings } from '@/db/schema/fpa';
import { MondayClient } from '@/lib/monday-client';
import { QuickBooksClient } from '@/lib/quickbooks-client';
import { VarianceEngine } from '@/lib/variance-engine';
import { eq, and, between } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { boardId, startDate, endDate, analysisName } = body;

    if (!boardId || !startDate || !endDate || !analysisName) {
      return NextResponse.json(
        { error: 'Missing required fields: boardId, startDate, endDate, analysisName' },
        { status: 400 }
      );
    }

    // Get integration settings
    const [mondaySettings, qbSettings] = await Promise.all([
      db.select()
        .from(integrationSettings)
        .where(and(
          eq(integrationSettings.userId, session.user.id),
          eq(integrationSettings.provider, 'monday')
        ))
        .limit(1),
      db.select()
        .from(integrationSettings)
        .where(and(
          eq(integrationSettings.userId, session.user.id),
          eq(integrationSettings.provider, 'quickbooks')
        ))
        .limit(1)
    ]);

    if (!mondaySettings[0]?.isConnected || !qbSettings[0]?.isConnected) {
      return NextResponse.json(
        { error: 'Monday.com or QuickBooks integration not connected' },
        { status: 400 }
      );
    }

    // Initialize clients
    const mondayClient = new MondayClient(mondaySettings[0].accessToken!);
    const qbClient = new QuickBooksClient(
      qbSettings[0].accessToken!,
      qbSettings[0].realmId!,
      process.env.NODE_ENV !== 'production'
    );

    // Fetch budget data from Monday.com
    const budgetData = await mondayClient.getBudgetData(boardId);
    
    // Transform Monday data to budget items
    const budgetItemsData = budgetData
      .filter((item: any) => item.budget_amount || item.amount)
      .map((item: any) => ({
        id: item.id,
        name: item.name,
        category: item.category || item.group || 'Uncategorized',
        subcategory: item.subcategory,
        budgetAmount: parseFloat(item.budget_amount || item.amount || '0'),
        period: 'monthly',
        periodStartDate: new Date(startDate),
        periodEndDate: new Date(endDate),
        department: item.department,
        costCenter: item.cost_center,
      }));

    // Fetch actual data from QuickBooks
    const transactions = await qbClient.getAllTransactions(startDate, endDate);
    
    // Transform QB data to actual transactions
    const actualTransactionsData = transactions.map(tx => ({
      id: tx.id,
      amount: tx.amount,
      date: new Date(tx.date),
      category: tx.account.name,
      subcategory: tx.class?.name,
      department: tx.department?.name,
      description: tx.description,
    }));

    // Run variance analysis
    const varianceEngine = new VarianceEngine();
    const analysis = varianceEngine.runVarianceAnalysis(
      budgetItemsData,
      actualTransactionsData,
      new Date(startDate),
      new Date(endDate),
      analysisName
    );

    // Save analysis to database
    const [savedAnalysis] = await db
      .insert(varianceAnalyses)
      .values({
        id: analysis.id,
        userId: session.user.id,
        name: analysisName,
        boardId,
        analysisType: 'budget_vs_actual',
        periodStartDate: new Date(startDate),
        periodEndDate: new Date(endDate),
        status: 'completed',
        totalBudget: analysis.totalBudget.toString(),
        totalActual: analysis.totalActual.toString(),
        totalVariance: analysis.totalVariance.toString(),
        variancePercentage: analysis.totalVariancePercentage.toString(),
        lastRunAt: new Date(),
      })
      .returning();

    // Save variance results
    const resultsWithActionItems = analysis.results.map(result => ({
      ...result,
      actionItems: varianceEngine.generateActionItems(result),
    }));

    await db
      .insert(varianceResults)
      .values(
        resultsWithActionItems.map(result => ({
          id: crypto.randomUUID(),
          analysisId: savedAnalysis.id,
          category: result.category,
          subcategory: result.subcategory,
          budgetAmount: result.budgetAmount.toString(),
          actualAmount: result.actualAmount.toString(),
          variance: result.variance.toString(),
          variancePercentage: result.variancePercentage.toString(),
          varianceType: result.varianceType,
          severity: result.severity,
          actionItems: result.actionItems,
        }))
      );

    return NextResponse.json({
      analysis: {
        ...analysis,
        results: resultsWithActionItems,
      },
    });

  } catch (error) {
    console.error('Variance analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to run variance analysis' },
      { status: 500 }
    );
  }
}