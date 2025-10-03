/**
 * Setup Wizard - MVP Version
 *
 * Simple 3-step wizard to connect Monday.com and QuickBooks
 * Shows connection status and allows first sync
 */

'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, XCircle, RefreshCw, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
  const router = useRouter();
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  // Check setup status
  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['setup-status'],
    queryFn: async () => {
      const res = await fetch('/api/setup/status', {
        headers: {
          'x-user-id': 'temp-user-id', // TODO: Get from auth
        },
      });
      if (!res.ok) throw new Error('Failed to load setup status');
      return res.json();
    },
  });

  // Run first sync
  const runFirstSync = async () => {
    setSyncRunning(true);
    setSyncResult(null);

    try {
      const res = await fetch('/api/sync/trigger', {
        method: 'POST',
        headers: {
          'x-user-id': 'temp-user-id', // TODO: Get from auth
        },
      });

      const result = await res.json();

      if (result.success) {
        setSyncResult({
          success: true,
          message: `Successfully synced ${result.data.itemsProcessed} items!`,
        });

        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          router.push('/dashboard/variance');
        }, 2000);
      } else {
        setSyncResult({
          success: false,
          message: result.message || 'Sync failed',
        });
      }
    } catch (error) {
      setSyncResult({
        success: false,
        message: error instanceof Error ? error.message : 'Sync failed',
      });
    } finally {
      setSyncRunning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Checking setup status...</p>
        </div>
      </div>
    );
  }

  if (!status?.success) {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-8">
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load setup status. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { connections, allConnected, nextStep, organizationName } = status;

  return (
    <div className="max-w-3xl mx-auto mt-10 p-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">Welcome to FP&A Variance Analyzer</h1>
        <p className="text-muted-foreground">
          Let's connect your accounts and run your first variance analysis
        </p>
        {organizationName && (
          <p className="text-sm text-muted-foreground mt-2">
            Organization: <span className="font-medium">{organizationName}</span>
          </p>
        )}
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center space-x-4">
          {/* Step 1 */}
          <div className="flex items-center">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full ${
                connections.monday.connected
                  ? 'bg-green-500 text-white'
                  : nextStep === 'connect-monday'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {connections.monday.connected ? (
                <CheckCircle className="h-6 w-6" />
              ) : (
                <span className="font-bold">1</span>
              )}
            </div>
            <span className="ml-2 text-sm font-medium">Monday.com</span>
          </div>

          <ArrowRight className="h-5 w-5 text-gray-400" />

          {/* Step 2 */}
          <div className="flex items-center">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full ${
                connections.quickbooks.connected
                  ? 'bg-green-500 text-white'
                  : nextStep === 'connect-quickbooks'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {connections.quickbooks.connected ? (
                <CheckCircle className="h-6 w-6" />
              ) : (
                <span className="font-bold">2</span>
              )}
            </div>
            <span className="ml-2 text-sm font-medium">QuickBooks</span>
          </div>

          <ArrowRight className="h-5 w-5 text-gray-400" />

          {/* Step 3 */}
          <div className="flex items-center">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full ${
                allConnected ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
              }`}
            >
              <span className="font-bold">3</span>
            </div>
            <span className="ml-2 text-sm font-medium">First Sync</span>
          </div>
        </div>
      </div>

      {/* Connection Cards */}
      <div className="space-y-4 mb-8">
        {/* Monday.com */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Monday.com</CardTitle>
                <CardDescription>Connect to fetch budget data</CardDescription>
              </div>
              {connections.monday.connected ? (
                <CheckCircle className="h-6 w-6 text-green-500" />
              ) : (
                <XCircle className="h-6 w-6 text-gray-400" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            {connections.monday.connected ? (
              <div className="text-sm text-muted-foreground">
                Connected as: {connections.monday.accountName || `Account #${connections.monday.accountId}`}
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground mb-4">
                  You need to connect your Monday.com account to access budget data.
                </p>
                <Button>
                  Connect Monday.com
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* QuickBooks */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>QuickBooks Online</CardTitle>
                <CardDescription>Connect to fetch actual expenses</CardDescription>
              </div>
              {connections.quickbooks.connected ? (
                <CheckCircle className="h-6 w-6 text-green-500" />
              ) : (
                <XCircle className="h-6 w-6 text-gray-400" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            {connections.quickbooks.connected ? (
              <div className="text-sm text-muted-foreground">
                Connected - Company ID: {connections.quickbooks.companyId}
              </div>
            ) : connections.monday.connected ? (
              <div>
                <p className="text-sm text-muted-foreground mb-4">
                  Connect your QuickBooks account to access actual expense data.
                </p>
                <Button>
                  Connect QuickBooks
                </Button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Connect Monday.com first
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Success / Sync Step */}
      {allConnected && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800">All Set! 🎉</CardTitle>
            <CardDescription>
              Both accounts are connected. Run your first sync to see variance analysis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {syncResult && (
              <Alert
                variant={syncResult.success ? 'default' : 'destructive'}
                className="mb-4"
              >
                <AlertDescription>{syncResult.message}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={runFirstSync}
              disabled={syncRunning}
              size="lg"
              className="w-full"
            >
              {syncRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running First Sync...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Run First Sync
                </>
              )}
            </Button>

            {!syncResult && (
              <p className="text-sm text-muted-foreground mt-4 text-center">
                This will fetch budget data from Monday.com and actuals from QuickBooks,
                then calculate variances.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
