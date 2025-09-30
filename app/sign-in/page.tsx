"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import Image from "next/image";

export default function SignInPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const searchParams = useSearchParams();

    useEffect(() => {
        const errorParam = searchParams.get('error');
        if (errorParam) {
            switch (errorParam) {
                case 'session_expired':
                    setError('Your session has expired. Please sign in again.');
                    break;
                case 'authentication_failed':
                    setError('Authentication failed. Please try again.');
                    break;
                case 'invalid_state':
                    setError('Invalid request. Please try again.');
                    break;
                default:
                    setError('An error occurred. Please try again.');
            }
        }
    }, [searchParams]);

    const handleMondaySignIn = () => {
        setIsLoading(true);
        window.location.href = '/api/auth/monday/login';
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center space-y-4">
                    <div className="flex justify-center">
                        <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
                            <svg className="w-10 h-10 text-primary" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                            </svg>
                        </div>
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-bold">FP&A Variance Analyzer</CardTitle>
                        <CardDescription>
                            Sign in with your Monday.com account to get started
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <Button
                        onClick={handleMondaySignIn}
                        className="w-full h-12 text-base"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Connecting to Monday.com...
                            </>
                        ) : (
                            <>
                                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                                </svg>
                                Sign in with Monday.com
                            </>
                        )}
                    </Button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">
                                Secure OAuth Authentication
                            </span>
                        </div>
                    </div>

                    <div className="text-xs text-center text-muted-foreground">
                        By signing in, you agree to connect your Monday.com workspace
                        and QuickBooks data for variance analysis.
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col space-y-2 text-center text-sm text-muted-foreground">
                    <p>
                        Need help? <Link href="/docs" className="font-medium text-primary hover:underline">
                            View Documentation
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}