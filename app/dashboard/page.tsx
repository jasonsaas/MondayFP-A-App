import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  PlayCircle,
  RefreshCw,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';

// Placeholder components for dashboard sections
function DashboardStats() {
  const stats = [
    {
      title: 'Total Budget',
      value: '$245,000',
      change: '+12% from last month',
      icon: DollarSign,
      trend: 'up',
    },
    {
      title: 'Total Actual',
      value: '$198,500',
      change: '+8% from last month',
      icon: TrendingUp,
      trend: 'up',
    },
    {
      title: 'Variance',
      value: '$46,500',
      change: 'Under budget',
      icon: TrendingDown,
      trend: 'down',
    },
    {
      title: 'Variance %',
      value: '19.0%',
      change: 'Within threshold',
      icon: Percent,
      trend: 'neutral',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.change}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ConnectionStatus() {
  const connections = [
    { name: 'Monday.com', status: 'connected', icon: CheckCircle2, color: 'text-green-600' },
    { name: 'QuickBooks', status: 'connected', icon: CheckCircle2, color: 'text-green-600' },
    { name: 'n8n Workflows', status: 'active', icon: CheckCircle2, color: 'text-green-600' },
  ];

  return (
    <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 border-green-200/50">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            {connections.map((conn) => {
              const Icon = conn.icon;
              return (
                <div key={conn.name} className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${conn.color}`} />
                  <span className="text-sm font-medium">{conn.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {conn.status}
                  </Badge>
                </div>
              );
            })}
          </div>
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Sync Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common FP&A operations</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button className="w-full justify-start" variant="outline">
          <PlayCircle className="w-4 h-4 mr-2" />
          New Variance Analysis
        </Button>
        <Button className="w-full justify-start" variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Sync QuickBooks Data
        </Button>
        <Button className="w-full justify-start" variant="outline">
          <FileText className="w-4 h-4 mr-2" />
          Generate P&L Report
        </Button>
      </CardContent>
    </Card>
  );
}

function VarianceChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Variance Trend</CardTitle>
        <CardDescription>Budget vs Actual over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
          Chart placeholder - integrate with variance data API
        </div>
      </CardContent>
    </Card>
  );
}

function RecentAnalyses() {
  const analyses = [
    { id: 1, name: '2024 Q1 Budget', status: 'completed', variance: '-12.5%', date: '2024-03-15' },
    { id: 2, name: 'Marketing Budget', status: 'completed', variance: '+5.2%', date: '2024-03-14' },
    { id: 3, name: 'Operations Budget', status: 'running', variance: 'N/A', date: '2024-03-13' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Analyses</CardTitle>
        <CardDescription>Your latest variance reports</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {analyses.map((analysis) => (
            <div key={analysis.id} className="flex items-center justify-between pb-4 border-b last:border-0">
              <div>
                <p className="font-medium">{analysis.name}</p>
                <p className="text-sm text-muted-foreground">{analysis.date}</p>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant={analysis.status === 'completed' ? 'default' : 'secondary'}>
                  {analysis.status}
                </Badge>
                <span className="font-mono text-sm font-medium">{analysis.variance}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <div className="@container/main flex flex-1 flex-col gap-6 p-6">
      {/* Connection Status Banner */}
      <ConnectionStatus />

      {/* Stats Cards Row */}
      <Suspense fallback={<Skeleton className="h-32" />}>
        <DashboardStats />
      </Suspense>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Variance Chart (2/3 width) */}
        <div className="lg:col-span-2">
          <Suspense fallback={<Skeleton className="h-[400px]" />}>
            <VarianceChart />
          </Suspense>
        </div>

        {/* Right Column: Quick Actions (1/3 width) */}
        <div>
          <QuickActions />
        </div>
      </div>

      {/* Recent Analyses Table */}
      <Suspense fallback={<Skeleton className="h-64" />}>
        <RecentAnalyses />
      </Suspense>
    </div>
  );
}
