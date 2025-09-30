'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Play, TrendingUp, AlertTriangle, CheckCircle, RefreshCw, Upload, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface VarianceResult {
  id: string;
  category: string;
  subcategory?: string;
  budgetAmount: number;
  actualAmount: number;
  variance: number;
  variancePercentage: number;
  varianceType: 'favorable' | 'unfavorable';
  severity: 'low' | 'medium' | 'high' | 'critical';
  actionItems?: string[];
}

interface VarianceAnalysis {
  id: string;
  name: string;
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  totalVariancePercentage: number;
  results: VarianceResult[];
  summary: {
    favorableCount: number;
    unfavorableCount: number;
    criticalCount: number;
    topVariances: VarianceResult[];
  };
}

interface Board {
  id: string;
  name: string;
  description?: string;
  workspace_id?: string;
}

interface BoardData {
  items: any[];
  columns: any[];
  itemCount: number;
  columnCount: number;
}

interface VarianceAnalyzerProps {
  boardId?: string;
  autoLoad?: boolean;
  onAnalysisComplete?: (analysis: VarianceAnalysis) => void;
  enableN8nSync?: boolean;
}

export default function VarianceAnalyzerEnhanced({
  boardId: initialBoardId,
  autoLoad = false,
  onAnalysisComplete,
  enableN8nSync = true
}: VarianceAnalyzerProps) {
  // State
  const [selectedBoard, setSelectedBoard] = useState<string>(initialBoardId || '');
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [analysisName, setAnalysisName] = useState('');

  // Loading states
  const [isLoadingBoards, setIsLoadingBoards] = useState(false);
  const [isLoadingBoardData, setIsLoadingBoardData] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUpdatingBoard, setIsUpdatingBoard] = useState(false);

  // Data
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [analysis, setAnalysis] = useState<VarianceAnalysis | null>(null);
  const [syncProgress, setSyncProgress] = useState(0);

  // Error handling
  const [error, setError] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  // Dialog states
  const [isAnalysisDialogOpen, setIsAnalysisDialogOpen] = useState(false);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);

  // Fetch boards on mount
  useEffect(() => {
    fetchBoards();
  }, []);

  // Auto-load board data if boardId is provided
  useEffect(() => {
    if (selectedBoard && autoLoad) {
      fetchBoardData(selectedBoard);
    }
  }, [selectedBoard, autoLoad]);

  const fetchBoards = useCallback(async () => {
    setIsLoadingBoards(true);
    setError(null);

    try {
      const response = await fetch('/api/monday/boards');

      if (!response.ok) {
        throw new Error('Failed to fetch boards');
      }

      const data = await response.json();
      setBoards(data.boards || []);

      // If boardId prop is provided, select it
      if (initialBoardId && data.boards.some((b: Board) => b.id === initialBoardId)) {
        setSelectedBoard(initialBoardId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load boards');
      console.error('Error fetching boards:', err);
    } finally {
      setIsLoadingBoards(false);
    }
  }, [initialBoardId]);

  const fetchBoardData = useCallback(async (boardId: string) => {
    setIsLoadingBoardData(true);
    setError(null);

    try {
      const response = await fetch(`/api/monday/boards/${boardId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch board data');
      }

      const data = await response.json();
      setBoardData({
        items: data.items || [],
        columns: data.columns || [],
        itemCount: data.itemCount || 0,
        columnCount: data.columnCount || 0,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load board data');
      console.error('Error fetching board data:', err);
    } finally {
      setIsLoadingBoardData(false);
    }
  }, []);

  const runAnalysis = async () => {
    if (!selectedBoard || !analysisName) return;

    setIsRunning(true);
    setError(null);

    try {
      const response = await fetch('/api/variance/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId: selectedBoard,
          startDate,
          endDate,
          analysisName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const data = await response.json();
      setAnalysis(data.analysis);
      setIsAnalysisDialogOpen(false);

      // Callback for parent component
      if (onAnalysisComplete) {
        onAnalysisComplete(data.analysis);
      }
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
      console.error('Analysis error:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const triggerN8nSync = async () => {
    if (!analysis) return;

    setIsSyncing(true);
    setError(null);
    setSyncProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setSyncProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/webhooks/n8n', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_N8N_WEBHOOK_SECRET || ''}`
        },
        body: JSON.stringify({
          action: 'sync_data',
          data: {
            analysisId: analysis.id,
            boardId: selectedBoard,
            source: 'variance_analysis',
            destination: 'monday_board',
            syncType: 'variance_update'
          }
        }),
      });

      clearInterval(progressInterval);
      setSyncProgress(100);

      if (!response.ok) {
        throw new Error('n8n sync failed');
      }

      const result = await response.json();
      setUpdateStatus({
        success: true,
        message: 'Data synced successfully via n8n',
        details: result
      });

      setTimeout(() => {
        setIsSyncDialogOpen(false);
        setSyncProgress(0);
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Sync failed');
      console.error('Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const updateMondayBoard = async () => {
    if (!analysis || !boardData) return;

    setIsUpdatingBoard(true);
    setError(null);

    try {
      // Prepare updates based on analysis results
      const updates = boardData.items.map(item => {
        const result = analysis.results.find(r =>
          r.category === item.name || r.id === item.id
        );

        return {
          itemId: item.id,
          columnValues: result ? {
            // Map to your board's column IDs
            actual_amount: parseFloat(result.actualAmount.toString()),
            variance: parseFloat(result.variance.toString()),
            variance_percent: parseFloat(result.variancePercentage.toString()),
            status: {
              label: result.varianceType === 'favorable' ? 'On Track' : 'Over Budget'
            }
          } : {}
        };
      });

      const response = await fetch(`/api/monday/boards/${selectedBoard}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: analysis.id,
          updates: updates.filter(u => Object.keys(u.columnValues).length > 0),
          columnMappings: {
            actualColumn: 'actual_amount',
            varianceColumn: 'variance',
            variancePercentColumn: 'variance_percent',
            statusColumn: 'status'
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Board update failed');
      }

      const result = await response.json();
      setUpdateStatus({
        success: true,
        message: `Board updated: ${result.summary.successful}/${result.summary.total} items`,
        details: result.summary
      });

    } catch (err: any) {
      setError(err.message || 'Board update failed');
      console.error('Update error:', err);
    } finally {
      setIsUpdatingBoard(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getVarianceIcon = (type: string, severity: string) => {
    if (severity === 'critical') return <AlertTriangle className="w-4 h-4 text-red-600" />;
    return type === 'favorable' ?
      <CheckCircle className="w-4 h-4 text-green-600" /> :
      <TrendingUp className="w-4 h-4 text-red-600" />;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Variance Analyzer</h2>
          <p className="text-muted-foreground">
            {selectedBoard ? `Analyzing ${boards.find(b => b.id === selectedBoard)?.name || 'board'}` : 'Compare budgets with actuals'}
          </p>
        </div>

        <div className="flex gap-2">
          {analysis && (
            <>
              <Button
                variant="outline"
                onClick={updateMondayBoard}
                disabled={isUpdatingBoard || !boardData}
              >
                {isUpdatingBoard ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Update Board
                  </>
                )}
              </Button>

              {enableN8nSync && (
                <Button
                  variant="outline"
                  onClick={() => setIsSyncDialogOpen(true)}
                  disabled={isSyncing}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sync via n8n
                </Button>
              )}
            </>
          )}

          <Button
            onClick={() => setIsAnalysisDialogOpen(true)}
            disabled={isRunning || isLoadingBoards}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Analysis
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Update Status Alert */}
      {updateStatus && (
        <Alert variant={updateStatus.success ? "default" : "destructive"}>
          <AlertTitle>{updateStatus.success ? 'Success' : 'Failed'}</AlertTitle>
          <AlertDescription>{updateStatus.message}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoadingBoards && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-2">Loading boards...</span>
          </CardContent>
        </Card>
      )}

      {/* Board Data Preview */}
      {boardData && !analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Board Data</CardTitle>
            <CardDescription>
              {boardData.itemCount} items, {boardData.columnCount} columns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Ready to analyze. Click "Run Analysis" to start.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Results */}
      {analysis && (
        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="details">Detailed Results</TabsTrigger>
            <TabsTrigger value="actions">Action Items</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(analysis.totalBudget)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total Actual</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(analysis.totalActual)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total Variance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${analysis.totalVariance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(analysis.totalVariance)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {analysis.totalVariancePercentage.toFixed(1)}%
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Critical Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{analysis.summary.criticalCount}</div>
                  <div className="text-sm text-muted-foreground">
                    {analysis.summary.unfavorableCount} unfavorable
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top Variances */}
            {analysis.summary.topVariances.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Top Variances</CardTitle>
                  <CardDescription>Items with the largest percentage variance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analysis.summary.topVariances.slice(0, 5).map((result) => (
                      <div key={result.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {getVarianceIcon(result.varianceType, result.severity)}
                          <div>
                            <div className="font-medium">{result.category}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatCurrency(result.budgetAmount)} → {formatCurrency(result.actualAmount)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold ${result.variance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {result.variancePercentage.toFixed(1)}%
                          </div>
                          <Badge variant={getSeverityColor(result.severity) as any}>
                            {result.severity}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="details">
            <Card>
              <CardHeader>
                <CardTitle>Variance Breakdown</CardTitle>
                <CardDescription>
                  Detailed variance analysis by category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>Actual</TableHead>
                      <TableHead>Variance</TableHead>
                      <TableHead>%</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Severity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.results.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{result.category}</div>
                            {result.subcategory && (
                              <div className="text-sm text-muted-foreground">{result.subcategory}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(result.budgetAmount)}</TableCell>
                        <TableCell>{formatCurrency(result.actualAmount)}</TableCell>
                        <TableCell className={result.variance >= 0 ? 'text-red-600' : 'text-green-600'}>
                          {formatCurrency(result.variance)}
                        </TableCell>
                        <TableCell className={result.variance >= 0 ? 'text-red-600' : 'text-green-600'}>
                          {result.variancePercentage.toFixed(1)}%
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            {getVarianceIcon(result.varianceType, result.severity)}
                            <span className="text-sm">{result.varianceType}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getSeverityColor(result.severity) as any}>
                            {result.severity}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions">
            <Card>
              <CardHeader>
                <CardTitle>Recommended Actions</CardTitle>
                <CardDescription>Action items for critical and high-severity variances</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analysis.results
                    .filter(r => r.actionItems && r.actionItems.length > 0)
                    .map((result) => (
                      <div key={result.id} className="border-l-4 border-primary pl-4">
                        <div className="font-medium">{result.category}</div>
                        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                          {result.actionItems?.map((action, idx) => (
                            <li key={idx}>• {action}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  {analysis.results.filter(r => r.actionItems && r.actionItems.length > 0).length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No action items required. All variances are within acceptable ranges.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Empty State */}
      {!analysis && !isLoadingBoards && !isLoadingBoardData && (
        <Card className="text-center py-12">
          <CardContent>
            <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Analysis Yet</h3>
            <p className="text-muted-foreground mb-4">
              {selectedBoard
                ? 'Run your first variance analysis to compare budgets with actuals'
                : 'Select a board and run your first variance analysis'
              }
            </p>
            <Button onClick={() => setIsAnalysisDialogOpen(true)}>
              <Play className="w-4 h-4 mr-2" />
              Get Started
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Analysis Dialog */}
      <Dialog open={isAnalysisDialogOpen} onOpenChange={setIsAnalysisDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Variance Analysis</DialogTitle>
            <DialogDescription>
              Configure your variance analysis parameters
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="analysis-name">Analysis Name</Label>
              <Input
                id="analysis-name"
                placeholder="Q4 2024 Budget vs Actual"
                value={analysisName}
                onChange={(e) => setAnalysisName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="board-select">Monday.com Board</Label>
              <Select value={selectedBoard} onValueChange={(value) => {
                setSelectedBoard(value);
                fetchBoardData(value);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a board" />
                </SelectTrigger>
                <SelectContent>
                  {boards.map(board => (
                    <SelectItem key={board.id} value={board.id}>
                      {board.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {isLoadingBoardData && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>Loading board data...</AlertDescription>
              </Alert>
            )}

            {boardData && (
              <Alert>
                <AlertDescription>
                  Ready to analyze {boardData.itemCount} items from {boardData.columnCount} columns
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAnalysisDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={runAnalysis}
              disabled={!selectedBoard || !analysisName || isRunning || !boardData}
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                'Run Analysis'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* n8n Sync Dialog */}
      <Dialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync via n8n</DialogTitle>
            <DialogDescription>
              Trigger n8n workflow to sync variance data
            </DialogDescription>
          </DialogHeader>

          {isSyncing ? (
            <div className="space-y-4 py-4">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Syncing data...</p>
              </div>
              <Progress value={syncProgress} className="w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  This will trigger your n8n workflow to sync variance data with Monday.com.
                </AlertDescription>
              </Alert>

              {analysis && (
                <div className="text-sm text-muted-foreground">
                  <div>Analysis: {analysis.name}</div>
                  <div>Items to sync: {analysis.results.length}</div>
                  <div>Board ID: {selectedBoard}</div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSyncDialogOpen(false)} disabled={isSyncing}>
              Cancel
            </Button>
            <Button onClick={triggerN8nSync} disabled={isSyncing}>
              {isSyncing ? 'Syncing...' : 'Start Sync'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}