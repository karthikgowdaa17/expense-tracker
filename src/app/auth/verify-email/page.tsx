'use client';

import { useState, useEffect, Suspense, FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Mail, CheckCircle2, ArrowLeft, AlertCircle } from 'lucide-react';
import Link from 'next/link';

/* eslint-disable react-hooks/set-state-in-effect */

function VerifyEmailForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [emailFromUrl, setEmailFromUrl] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const searchParams = useSearchParams();
  const supabase = createClient();

  const verifyEmailToken = async (token: string) => {
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.verifyOtp({
        token,
        type: 'email',
        email: emailFromUrl!,
      });
      if (error) throw error;
      setSuccess(true);
      setMessage('Email verified successfully! You can now sign in.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired verification token');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setResending(true);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      setMessage('Verification email sent! Check your inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification email');
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    const token = searchParams.get('token');
    const emailFromUrl = searchParams.get('email');
    if (emailFromUrl) {
      setEmailFromUrl(emailFromUrl);
    }
    if (token) {
      verifyEmailToken(token);
    } else {
      setError('Missing verification token');
    }
  }, [searchParams, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Verifying your email...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Verify Email</CardTitle>
          <CardDescription>
            {success ? 'Your email has been verified' : 'Please verify your email address'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {success ? (
            <div className="space-y-4">
              <div className="p-3 text-sm text-green-600 bg-green-50 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                {message}
              </div>
              <Button asChild className="w-full">
                <Link href="/auth/login">Sign In</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
              {message && !error && (
                <div className="p-3 text-sm text-green-600 bg-green-50 rounded-lg flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {message}
                </div>
              )}

              <form onSubmit={handleResend} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                      disabled={resending}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={resending}>
                  {resending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Resend Verification Email
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground">
                <Link href="/auth/login" className="font-medium text-primary hover-underline">
                  <ArrowLeft className="mr-1 h-4 w-4 inline" />
                  Back to Sign In
                </Link>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function VerifyEmailPageContent() {
  return <VerifyEmailForm />;
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background px-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <VerifyEmailPageContent />
    </Suspense>
  );
}
