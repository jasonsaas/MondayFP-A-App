"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  DollarSign,
  Calendar,
  Workflow,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero Section */}
      <div className="text-center py-16 sm:py-24 relative px-4">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <ThemeToggle />
        </div>

        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-400 bg-clip-text text-transparent">
            Monday FP&A Platform
          </h1>
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Automated Variance Analysis for Monday.com & QuickBooks
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Connect your Monday.com budget boards with QuickBooks actuals. Get real-time variance analysis powered by n8n workflows.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              className="text-lg px-8"
              onClick={() => (window.location.href = '/api/auth/monday')}
            >
              Get Started Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8">
              Watch Demo
            </Button>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 sm:px-6 pb-16 max-w-6xl">
        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {/* Feature 1: Real-Time Variance Analysis */}
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border-blue-200/50 dark:border-blue-700/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-blue-500 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-xl">Real-Time Variance Analysis</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Compare budgets from Monday.com with actuals from QuickBooks automatically. See exactly where you're over or under budget.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Automatic sync between systems</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Threshold alerts (warning & critical)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Drill-down reports by category</span>
              </li>
            </ul>
          </Card>

          {/* Feature 2: Monday.com Integration */}
          <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10 border-purple-200/50 dark:border-purple-700/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-purple-500 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-xl">Monday.com Integration</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Works directly with your existing Monday.com boards. No need to recreate your budget structure.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Secure OAuth authentication</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Select any board for analysis</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Automatic variance updates</span>
              </li>
            </ul>
          </Card>

          {/* Feature 3: QuickBooks Sync */}
          <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 border-green-200/50 dark:border-green-700/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-green-500 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-xl">QuickBooks Sync</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Pull P&L data and transactions from QuickBooks automatically. Always stay up-to-date with actual spending.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Secure OAuth 2.0 connection</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Sandbox & production support</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Automatic token refresh</span>
              </li>
            </ul>
          </Card>

          {/* Feature 4: n8n Automation */}
          <Card className="p-6 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/10 dark:to-red-900/10 border-orange-200/50 dark:border-orange-700/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-orange-500 flex items-center justify-center">
                <Workflow className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-xl">n8n Automation</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Trigger workflows for data sync and notifications. Automate your entire FP&A process.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Scheduled analysis runs</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Webhook callbacks & status</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Custom workflow triggers</span>
              </li>
            </ul>
          </Card>
        </div>

        {/* How It Works Section */}
        <Card className="p-8 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/50">
          <h3 className="font-bold text-2xl mb-6 text-center">How It Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold mb-3">
                1
              </div>
              <h4 className="font-semibold mb-2">Connect Monday</h4>
              <p className="text-sm text-muted-foreground">
                Authorize with your Monday.com account
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold mb-3">
                2
              </div>
              <h4 className="font-semibold mb-2">Link QuickBooks</h4>
              <p className="text-sm text-muted-foreground">
                Connect your QuickBooks company
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold mb-3">
                3
              </div>
              <h4 className="font-semibold mb-2">Select Board</h4>
              <p className="text-sm text-muted-foreground">
                Choose your budget board
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold mb-3">
                4
              </div>
              <h4 className="font-semibold mb-2">Run Analysis</h4>
              <p className="text-sm text-muted-foreground">
                Trigger variance analysis
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center font-bold mb-3">
                ✓
              </div>
              <h4 className="font-semibold mb-2">Review Insights</h4>
              <p className="text-sm text-muted-foreground">
                See results in Monday
              </p>
            </div>
          </div>
          <div className="mt-8 text-center">
            <Button
              size="lg"
              className="text-lg px-8"
              onClick={() => (window.location.href = '/api/auth/monday')}
            >
              Get Started Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
