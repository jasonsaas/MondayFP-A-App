'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

/**
 * Monday.com Dashboard Widget - Compact variance summary
 *
 * This widget appears on Monday dashboards showing key variance metrics.
 */

interface WidgetData {
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  variancePercent: number;
  criticalCount: number;
  warningCount: number;
  lastSync: string;
}

export default function MondayWidgetPage() {
  const [data, setData] = useState<WidgetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initWidget = async () => {
      try {
        // @ts-ignore
        const monday = window.monday;

        if (!monday) {
          throw new Error('Monday SDK not loaded');
        }

        const context = await monday.get('context');
        const token = await monday.get('sessionToken');

        // Fetch widget data
        const response = await fetch(`/api/variance/summary?boardId=${context.data.boardId}`, {
          headers: {
            'Authorization': `Bearer ${token.data}`,
          },
        });

        if (response.ok) {
          const widgetData = await response.json();
          setData(widgetData);
        }
      } catch (err) {
        console.error('Widget initialization error:', err);
      } finally {
        setLoading(false);
      }
    };

    initWidget();
  }, []);

  if (loading || !data) {
    return (
      <div className="p-4 bg-white h-full flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  const isOverBudget = data.totalVariance > 0;

  return (
    <div className="p-4 bg-white h-full">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Budget vs Actual</h3>
          {isOverBudget ? (
            <TrendingDown className="h-4 w-4 text-red-500" />
          ) : (
            <TrendingUp className="h-4 w-4 text-green-500" />
          )}
        </div>

        <div className="space-y-2">
          <div>
            <div className="text-xs text-gray-500">Total Variance</div>
            <div className={`text-2xl font-bold ${
              isOverBudget ? 'text-red-500' : 'text-green-500'
            }`}>
              {isOverBudget ? '+' : ''}${Math.abs(data.totalVariance).toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">
              {data.variancePercent.toFixed(1)}% {isOverBudget ? 'over' : 'under'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-gray-500">Budget</div>
              <div className="font-semibold">${data.totalBudget.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-gray-500">Actual</div>
              <div className="font-semibold">${data.totalActual.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {(data.criticalCount > 0 || data.warningCount > 0) && (
          <div className="flex items-center gap-2 text-xs pt-2 border-t">
            {data.criticalCount > 0 && (
              <div className="flex items-center gap-1 text-red-500">
                <AlertCircle className="h-3 w-3" />
                {data.criticalCount} critical
              </div>
            )}
            {data.warningCount > 0 && (
              <div className="flex items-center gap-1 text-yellow-500">
                <AlertCircle className="h-3 w-3" />
                {data.warningCount} warning
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-gray-400 pt-2 border-t">
          Last sync: {new Date(data.lastSync).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
