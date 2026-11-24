'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  transactionsApi,
  type ExportFormat,
} from '@/lib/api/transactions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
} from 'lucide-react';
import { cn } from '@/utils/currency';

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'pdf', label: 'PDF' },
];

export default function ExportPage() {
  const { user } = useAuth();
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastDownloaded, setLastDownloaded] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ).toISOString().split('T')[0];

  const handleDownload = useCallback(async () => {
    if (!user) return;
    setError('');
    setLoading(true);
    try {
      const blob = await transactionsApi.exportTransactions(
        {
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          category: category || undefined,
        },
        format,
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions-${today}.${format}`;
      a.click();
      URL.revokeObjectURL(url);

      setLastDownloaded(today);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  }, [user, format, dateFrom, dateTo, category, today]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Export Transactions</h1>
        <p className="text-muted-foreground">
          Download your transactions as a CSV or PDF file.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Export filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4 items-end">
            <div className="space-y-2">
              <Label>Format</Label>
              <Select
                value={format}
                onValueChange={(value) => setFormat(value as ExportFormat)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>From date</Label>
              <Input
                type="date"
                value={dateFrom || firstOfMonth}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>To date</Label>
              <Input
                type="date"
                value={dateTo || today}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Button
              onClick={handleDownload}
              disabled={loading}
              className="w-auto"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Download className="mr-2 h-4 w-4" />
              Download {format.toUpperCase()}
            </Button>
            {lastDownloaded && (
              <div
                className={cn(
                  'flex items-center gap-2 rounded-lg border p-3 text-sm',
                  'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
                )}
              >
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <p className="font-medium">
                  Downloaded transactions-{today}.{format}
                </p>
              </div>
            )}
          </div>

          {error && (
            <div
              className="flex items-start gap-3 rounded-lg border p-4 bg-destructive/10 text-destructive"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
