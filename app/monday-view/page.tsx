'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

/**
 * Monday.com Board View - Embedded in Monday boards
 *
 * This view is embedded directly in Monday.com boards via the marketplace app.
 * It shows variance analysis for the current board's budget data.
 */

interface MondayContext {
  boardId: number;
  itemId?: number;
  user: {
    id: number;
    name: string;
    email: string;
  };
  sessionToken: string;
}

interface VarianceData {
  category: string;
  budget: number;
  actual: number;
  variance: number;
  variancePercent: number;
  status: 'good' | 'warning' | 'critical';
}

export default function MondayViewPage() {
  const [context, setContext] = useState<MondayContext | null>(null);
  const [variances, setVariances] = useState<VarianceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize Monday Apps SDK
    const initMonday = async () => {
      try {
        // @ts-ignore - Monday SDK is loaded via script tag
        const monday = window.monday;

        if (!monday) {
          throw new Error('Monday SDK not loaded');
        }

        // Get context from Monday
        const ctx = await monday.get('context');
        setContext(ctx.data);

        // Listen for context changes
        monday.listen('context', (res: any) => {
          setContext(res.data);
        });

        // Get session token for API calls
        const token = await monday.get('sessionToken');

        // Fetch variance data
        await fetchVariances(ctx.data.boardId, token.data);

      } catch (err) {
        console.error('Failed to initialize Monday SDK:', err);
        setError('Failed to connect to Monday.com');
        setLoading(false);
      }
    };

    initMonday();
  }, []);

  const fetchVariances = async (boardId: number, sessionToken: string) => {
    try {
      setLoading(true);

      const response = await fetch(`/api/variance/analyze?boardId=${boardId}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch variance data');
      }

      const data = await response.json();
      setVariances(data.variances || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch variances:', err);
      setError('Failed to load variance data');
    } finally {
      setLoading(false);
    }
  };

  const syncQuickBooks = async () => {
    if (!context) return;

    try {
      setLoading(true);

      const response = await fetch('/api/quickbooks/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${context.sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ boardId: context.boardId }),
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      // Refresh variance data
      await fetchVariances(context.boardId, context.sessionToken);

      // @ts-ignore
      window.monday.execute('notice', {
        message: 'QuickBooks data synced successfully',
        type: 'success',
      });
    } catch (err) {
      console.error('Sync error:', err);
      // @ts-ignore
      window.monday.execute('notice', {
        message: 'Failed to sync QuickBooks data',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good':
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critical':
        return <TrendingDown className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading variance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="p-6 max-w-md">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Budget Variance Analysis</h1>
            <p className="text-gray-600">
              Board: {context?.boardId} | User: {context?.user.name}
            </p>
          </div>
          <Button onClick={syncQuickBooks} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              'Sync QuickBooks'
            )}
          </Button>
        </div>

        <div className="grid gap-4">
          {variances.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-gray-600">
                No variance data available. Click "Sync QuickBooks" to fetch data.
              </p>
            </Card>
          ) : (
            variances.map((variance, index) => (
              <Card key={index} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(variance.status)}
                    <div>
                      <h3 className="font-semibold">{variance.category}</h3>
                      <p className="text-sm text-gray-600">
                        Budget: ${variance.budget.toLocaleString()} |
                        Actual: ${variance.actual.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${
                      variance.variance > 0 ? 'text-red-500' : 'text-green-500'
                    }`}>
                      {variance.variance > 0 ? '+' : ''}
                      ${variance.variance.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">
                      {variance.variancePercent.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
