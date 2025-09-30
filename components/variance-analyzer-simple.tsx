'use client';

import React, { useState } from 'react';
import { Calendar, Play, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

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
}

export default function VarianceAnalyzer() {
  const [selectedBoard, setSelectedBoard] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [analysisName, setAnalysisName] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [analysis, setAnalysis] = useState<VarianceAnalysis | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  React.useEffect(() => {
    fetchBoards();
  }, []);

  const fetchBoards = async () => {
    try {
      const response = await fetch('/api/monday/boards');
      if (response.ok) {
        const data = await response.json();
        setBoards(data.boards || []);
      }
    } catch (error) {
      console.error('Failed to fetch boards:', error);
    }
  };

  const runAnalysis = async () => {
    if (!selectedBoard || !analysisName) return;

    setIsRunning(true);
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

      if (response.ok) {
        const data = await response.json();
        setAnalysis(data.analysis);
        setIsDialogOpen(false);
      } else {
        console.error('Analysis failed');
      }
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getVarianceIcon = (type: string, severity: string) => {
    if (severity === 'critical') return <AlertTriangle className="w-4 h-4" />;
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
          <p className="text-muted-foreground">Compare budgets with actuals and identify variances</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={isRunning}>
              <Play className="w-4 h-4 mr-2" />
              {isRunning ? 'Running...' : 'Run Analysis'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>New Variance Analysis</DialogTitle>
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
                <Select value={selectedBoard} onValueChange={setSelectedBoard}>
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
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={runAnalysis}
                disabled={!selectedBoard || !analysisName || isRunning}
              >
                {isRunning ? 'Running...' : 'Run Analysis'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-6">
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
                <div className="text-sm text-muted-foreground">Need attention</div>
              </CardContent>
            </Card>
          </div>

          {/* Variance Breakdown */}
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
                        <Badge variant={getSeverityVariant(result.severity) as any}>
                          {result.severity}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!analysis && (
        <Card className="text-center py-12">
          <CardContent>
            <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Analysis Yet</h3>
            <p className="text-muted-foreground mb-4">
              Run your first variance analysis to compare budgets with actuals
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Play className="w-4 h-4 mr-2" />
              Get Started
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}