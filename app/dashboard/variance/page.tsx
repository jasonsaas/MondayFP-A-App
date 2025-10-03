/**
 * Variance Dashboard - MVP Version
 *
 * Simple variance analysis dashboard connected to real API
 * Uses React Query for data fetching
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Download, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function VariancePage() {
  // Fetch variance data from API
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['variance-analysis'],
    queryFn: async () => {
      const res = await fetch('/api/variance/current', {
        headers: {
          'x-user-id': 'temp-user-id', // TODO: Get from auth
        },
      });
      if (!res.ok) throw new Error('Failed to load variance data');
      return res.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Trigger manual sync
  const triggerSync = async () => {
    try {
      const res = await fetch('/api/sync/trigger', {
        method: 'POST',
        headers: {
          'x-user-id': 'temp-user-id', // TODO: Get from auth
        },
      });

      if (!res.ok) throw new Error('Sync failed');

      // Refetch data after 2 seconds
      setTimeout(() => refetch(), 2000);
    } catch (err) {
      console.error('Sync error:', err);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading variance data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load variance data. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Empty state - no data yet
  if (!data?.hasData) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card className="p-12 text-center">
          <CardHeader>
            <CardTitle className="text-2xl">No Variance Data Yet</CardTitle>
            <CardDescription>
              Connect your accounts and run your first sync to see variance analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={triggerSync} size="lg" className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Run First Sync
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              This will fetch budget data from Monday.com and actuals from QuickBooks
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { summary, items = [], lastSync } = data;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Variance Analysis</h1>
          <p className="text-muted-foreground">
            Last synced: {lastSync ? new Date(lastSync).toLocaleString() : 'Never'}
          </p>
        </div>
        <div className="flex gap-2">
          {data.needsSync && (
            <span className="text-sm text-amber-600 mr-2 self-center">
              Data is stale - sync recommended
            </span>
          )}
          <Button onClick={triggerSync} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync Now
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${summary.totalBudget.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${summary.totalActual.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Variance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.totalVariance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ${Math.abs(summary.totalVariance).toLocaleString()}
              <span className="text-sm ml-1">
                ({summary.totalVariancePercent.toFixed(1)}%)
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {summary.criticalCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.warningCount} warnings
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Variance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Variance Details</CardTitle>
          <CardDescription>
            Showing {items.length} line items
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Account</th>
                  <th className="text-right p-2 font-medium">Budget</th>
                  <th className="text-right p-2 font-medium">Actual</th>
                  <th className="text-right p-2 font-medium">Variance</th>
                  <th className="text-right p-2 font-medium">%</th>
                  <th className="text-center p-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, index: number) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      <div className="font-medium">{item.accountName}</div>
                      {item.category && (
                        <div className="text-sm text-muted-foreground">{item.category}</div>
                      )}
                    </td>
                    <td className="text-right p-2">
                      ${item.budgetAmount.toLocaleString()}
                    </td>
                    <td className="text-right p-2">
                      ${item.actualAmount.toLocaleString()}
                    </td>
                    <td className={`text-right p-2 font-medium ${item.variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ${Math.abs(item.variance).toLocaleString()}
                    </td>
                    <td className={`text-right p-2 font-medium ${Math.abs(item.variancePercent) > 15 ? 'text-red-600' : Math.abs(item.variancePercent) > 10 ? 'text-amber-600' : ''}`}>
                      {item.variancePercent.toFixed(1)}%
                    </td>
                    <td className="text-center p-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.severity === 'critical'
                          ? 'bg-red-100 text-red-800'
                          : item.severity === 'warning'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {item.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
