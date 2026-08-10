'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, CheckCircle, AlertCircle } from 'lucide-react';

type Transaction = {
  date: string;
  type: 'income' | 'expense' | 'transfer' | 'refund';
  amount: number;
  category: string;
  subcategory?: string;
  description: string;
  payment_method:
    | 'cash'
    | 'upi'
    | 'credit_card'
    | 'debit_card'
    | 'bank_transfer'
    | 'other';
  account: string;
  notes?: string;
};

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setError('');
    setMessage('');

    try {
      const text = await selectedFile.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data)) {
        throw new Error('JSON must contain an array of transactions.');
      }

      setTransactions(data);
      setMessage(`Loaded ${data.length} transactions.`);
    } catch (err) {
      setTransactions([]);
      setError(
        err instanceof Error ? err.message : 'Could not read the JSON file.'
      );
    }
  };

  const importTransactions = async () => {
    if (!transactions.length) return;

    setImporting(true);
    setError('');
    setMessage('');

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('You are not logged in.');
      }

      // Create missing categories
      const categoryRows = [
        ...new Map(
          transactions.map((t) => [
            `${t.category}|${t.type}`,
            {
              user_id: user.id,
              name: t.category,
              type: t.type,
              is_default: false,
            },
          ])
        ).values(),
      ];

      if (categoryRows.length) {
        const { error: categoryError } = await supabase
          .from('categories')
          .upsert(categoryRows, {
            onConflict: 'user_id,name,type',
            ignoreDuplicates: true,
          });

        if (categoryError) {
          throw new Error(
            `Category setup failed: ${categoryError.message}`
          );
        }
      }

      // Find date range
      const dates = transactions.map((t) => t.date).sort();
      const minDate = dates[0];
      const maxDate = dates[dates.length - 1];

      // Check existing transactions to prevent duplicates
      const { data: existing, error: existingError } = await supabase
        .from('transactions')
        .select(
          'date,type,amount,category,description,payment_method,account,notes'
        )
        .eq('user_id', user.id)
        .gte('date', minDate)
        .lte('date', maxDate);

      if (existingError) {
        throw new Error(
          `Could not check existing transactions: ${existingError.message}`
        );
      }

      const keyOf = (t: Transaction) =>
        [
          t.date,
          t.type,
          Number(t.amount).toFixed(2),
          t.category,
          t.description,
          t.payment_method,
          t.account,
          t.notes ?? '',
        ].join('|');

      const existingKeys = new Set(
        (existing ?? []).map(keyOf)
      );

      const newRows = transactions
        .filter((t) => !existingKeys.has(keyOf(t)))
        .map((t) => ({
          ...t,
          user_id: user.id,
          amount: Math.round(Number(t.amount) * 100) / 100,
        }));

      if (!newRows.length) {
        setMessage(
          `Nothing new to import. All ${transactions.length} transactions already exist.`
        );
        return;
      }

      // Insert in batches
      const batchSize = 50;

      for (let i = 0; i < newRows.length; i += batchSize) {
        const batch = newRows.slice(i, i + batchSize);

        const { error: insertError } = await supabase
          .from('transactions')
          .insert(batch);

        if (insertError) {
          throw new Error(
            `Import failed: ${insertError.message}`
          );
        }
      }

      setMessage(
        `Successfully imported ${newRows.length} transactions. ${transactions.length - newRows.length} duplicates were skipped.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Import failed.'
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Import PhonePe
        </h1>
        <p className="text-muted-foreground">
          Import your PhonePe transactions into your expense tracker.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload PhonePe JSON</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-lg border-2 border-dashed p-8 text-center">
            <Upload className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />

            <p className="mb-2 font-medium">
              Select your PhonePe transaction file
            </p>

            <p className="mb-4 text-sm text-muted-foreground">
              Choose phonepe_aug2026.json from your computer.
            </p>

            <input
              type="file"
              accept=".json,application/json"
              className="mx-auto block max-w-full text-sm"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) handleFile(selected);
              }}
            />
          </div>

          {message && (
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm">{message}</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {file && transactions.length > 0 && (
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {transactions.length} transactions ready
                  </p>
                </div>

                <Button
                  onClick={importTransactions}
                  disabled={importing}
                >
                  {importing && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {!importing && (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Import Transactions
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
