"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Circle, Building2, Link2, BarChart3, Settings2 } from 'lucide-react';

type OnboardingStep = 1 | 2 | 3 | 4;

interface OrganizationSettings {
  syncFrequency: 'realtime' | '15min' | 'hourly' | 'daily';
  defaultBoardId: string;
  thresholds: {
    warning: number;
    critical: number;
  };
}

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<OrganizationSettings>({
    syncFrequency: 'hourly',
    defaultBoardId: '',
    thresholds: {
      warning: 10,
      critical: 25,
    },
  });

  const steps = [
    { number: 1, title: 'Welcome', icon: Building2 },
    { number: 2, title: 'Connect QuickBooks', icon: Link2 },
    { number: 3, title: 'Select Board', icon: BarChart3 },
    { number: 4, title: 'Configure Settings', icon: Settings2 },
  ];

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep((prev) => (prev + 1) as OnboardingStep);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as OnboardingStep);
    }
  };

  const handleSkip = () => {
    router.push('/dashboard');
  };

  const handleFinish = async () => {
    setIsLoading(true);
    try {
      // Save settings to database
      await fetch('/api/organization/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            {steps.map((step) => {
              const Icon = step.icon;
              const isActive = currentStep === step.number;
              const isCompleted = currentStep > step.number;

              return (
                <div key={step.number} className="flex flex-col items-center flex-1">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-colors ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isActive
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <Icon className="w-6 h-6" />
                    )}
                  </div>
                  <span className={`text-sm font-medium ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
          <Progress value={(currentStep / 4) * 100} className="h-2" />
        </div>

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle>
              {currentStep === 1 && 'Welcome to Monday FP&A Platform'}
              {currentStep === 2 && 'Connect Your QuickBooks Account'}
              {currentStep === 3 && 'Select Your Budget Board'}
              {currentStep === 4 && 'Configure Analysis Settings'}
            </CardTitle>
            <CardDescription>
              {currentStep === 1 && 'Let\'s get your variance analysis set up in just a few steps'}
              {currentStep === 2 && 'Link your QuickBooks company to pull actual financial data'}
              {currentStep === 3 && 'Choose which Monday.com board contains your budget data'}
              {currentStep === 4 && 'Set sync frequency and variance thresholds'}
            </CardDescription>
          </CardHeader>

          <CardContent className="min-h-[300px]">
            {/* Step 1: Welcome */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  This platform automatically compares your budgets in Monday.com with actual spending from QuickBooks.
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg space-y-2">
                  <h4 className="font-semibold">What you'll need:</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>✓ Monday.com account (already connected)</li>
                    <li>✓ QuickBooks Online account</li>
                    <li>✓ A Monday.com board with budget data</li>
                  </ul>
                </div>
                <p className="text-sm text-muted-foreground">
                  Don't worry - you can skip any step and configure it later in settings.
                </p>
              </div>
            )}

            {/* Step 2: Connect QuickBooks */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Connect your QuickBooks account to automatically pull actual expenses and revenue data.
                </p>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Note:</strong> You'll be redirected to QuickBooks to authorize access. We only request read-only access to your financial data.
                  </p>
                </div>
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => window.location.href = '/api/auth/quickbooks'}
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  Connect QuickBooks
                </Button>
              </div>
            )}

            {/* Step 3: Select Board */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="board-select">Default Budget Board</Label>
                  <Select
                    value={settings.defaultBoardId}
                    onValueChange={(value) => setSettings({ ...settings, defaultBoardId: value })}
                  >
                    <SelectTrigger id="board-select">
                      <SelectValue placeholder="Select a board" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="board-1">2024 Annual Budget</SelectItem>
                      <SelectItem value="board-2">Q1 Marketing Budget</SelectItem>
                      <SelectItem value="board-3">Operations Budget</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground mt-2">
                    This board will be used by default for variance analysis. You can analyze other boards anytime.
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Configure Settings */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <Label htmlFor="sync-frequency">Sync Frequency</Label>
                  <Select
                    value={settings.syncFrequency}
                    onValueChange={(value: any) => setSettings({ ...settings, syncFrequency: value })}
                  >
                    <SelectTrigger id="sync-frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="realtime">Real-time (instant updates)</SelectItem>
                      <SelectItem value="15min">Every 15 minutes</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <Label>Variance Thresholds</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="warning-threshold" className="text-sm text-muted-foreground">
                        Warning (%)
                      </Label>
                      <Input
                        id="warning-threshold"
                        type="number"
                        value={settings.thresholds.warning}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            thresholds: { ...settings.thresholds, warning: Number(e.target.value) },
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="critical-threshold" className="text-sm text-muted-foreground">
                        Critical (%)
                      </Label>
                      <Input
                        id="critical-threshold"
                        type="number"
                        value={settings.thresholds.critical}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            thresholds: { ...settings.thresholds, critical: Number(e.target.value) },
                          })
                        }
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Variances above these percentages will be highlighted as warnings or critical issues.
                  </p>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-between">
            <div className="flex gap-2">
              {currentStep > 1 && (
                <Button variant="outline" onClick={handleBack}>
                  Back
                </Button>
              )}
              {currentStep < 4 && (
                <Button variant="ghost" onClick={handleSkip}>
                  Skip for now
                </Button>
              )}
            </div>

            <div>
              {currentStep < 4 ? (
                <Button onClick={handleNext}>
                  Next
                </Button>
              ) : (
                <Button onClick={handleFinish} disabled={isLoading}>
                  {isLoading ? 'Saving...' : 'Finish Setup'}
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
