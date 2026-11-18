'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { categoriesApi } from '@/lib/api/categories';
import { transactionsApi } from '@/lib/api/transactions';
import { accountsApi } from '@/lib/api/accounts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload, CheckCircle, AlertCircle, Landmark, X } from 'lucide-react';
import { generateTransactionFingerprint } from '@/utils/fingerprint';
import { suggestCategory } from '@/utils/categorySuggestion';
import { formatCurrency } from '@/utils/currency';
import { formatAccountLabel } from '@/utils/accounts';
import { parseBankStatement, type StatementLine } from '@/lib/import/bankStatement';
import { normalizePhonePeRow, type NormalizedPhonePeRow } from '@/lib/import/phonepe';
import type { Account, Category, TransactionType, PaymentMethod } from '@/types';

import {
  detectedLabel,
  resolveRefLabel,
  refForJsonRow,
  rowFingerprint,
  refExistingId,
  type DetectedAccount,
  type AccountRef,
  type ImportPreviewRow,
} from '@/lib/import/preview';

type PreviewRow = ImportPreviewRow;

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

export default function ImportPage() {
  const [fileName, setFileName] = useState('');
  const [fileKind, setFileKind] = useState<'pdf' | 'json' | null>(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [detectedAccounts, setDetectedAccounts] = useState<DetectedAccount[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [existingFingerprints, setExistingFingerprints] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        const [accRes, catRes] = await Promise.all([accountsApi.list(), categoriesApi.list()]);
        setAccounts(accRes);
        setCategories(catRes);
      } catch (err) {
        console.error('Failed to load accounts/categories:', err);
      }
    })();
  }, [user]);

  const refLabel = (ref: AccountRef) => resolveRefLabel(ref, detectedAccounts, accounts);

  const fingerprintForRow = (row: PreviewRow) =>
    rowFingerprint(row, { userId: user?.id ?? '', detected: detectedAccounts, accounts });

  const refreshDuplicateFlag = (row: PreviewRow, fps: Set<string>) => fps.has(fingerprintForRow(row));

  const updateRow = (id: string, patch: Partial<PreviewRow>) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const next = { ...r, ...patch };
      next.isDuplicate = refreshDuplicateFlag(next, existingFingerprints);
      return next;
    }));
  };

  const loadExistingFingerprints = async (): Promise<Set<string>> => {
    const existing = await transactionsApi.list();
    const fps = new Set(existing.map(t =>
      generateTransactionFingerprint({
        userId: user?.id ?? '',
        date: t.date,
        type: t.type,
        amount: t.amount,
        description: t.description,
        payment_method: t.payment_method,
        account: t.account,
        account_id: t.account_id ?? null,
      })
    ));
    setExistingFingerprints(fps);
    return fps;
  };

  const resetState = () => {
    setRows([]);
    setDetectedAccounts([]);
    setWarnings([]);
    setMessage('');
    setError('');
    setFileName('');
    setFileKind(null);
  };

  // ------------------------------------------------------------------------
  // File handling: PDF or JSON
  // ------------------------------------------------------------------------

  const handleFile = async (file: File) => {
    resetState();
    if (!user) { setError('You are not logged in.'); return; }
    setParsing(true);
    setFileName(file.name);

    try {
      if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
        setFileKind('pdf');
        await handlePdf(file);
      } else {
        setFileKind('json');
        await handleJson(file);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to read the file.');
      setRows([]);
      setDetectedAccounts([]);
    } finally {
      setParsing(false);
    }
  };

  const handlePdf = async (file: File) => {
    const { extractPdfLines } = await import('@/lib/import/pdfText');
    const buffer = await file.arrayBuffer();
    const lines: StatementLine[] = await extractPdfLines(buffer);
    const result = parseBankStatement(lines);

    if (!result.transactions.length) {
      setError('No transactions were found in this PDF. If this is a scanned/image-only statement, it cannot be imported automatically.');
      setWarnings(result.warnings);
      return;
    }

    setWarnings(result.warnings);

    // Resolve detected accounts against the user's existing accounts
    const detected: DetectedAccount[] = result.accounts.map(a => {
      const last4 = a.account_number_last4;
      const match = accounts.find(existing =>
        last4 && existing.account_number_last4 === last4 &&
        (!a.bank_name || !existing.bank_name || existing.bank_name.toLowerCase() === a.bank_name.toLowerCase())
      ) || accounts.find(existing => existing.name.toLowerCase() === a.name.toLowerCase());

      return {
        key: a.key,
        name: a.name,
        bank_name: a.bank_name,
        account_number_last4: a.account_number_last4,
        type: a.type,
        existingId: match?.id ?? null,
      };
    });
    setDetectedAccounts(detected);

    const accountRefForKey = (key: string | null): AccountRef => {
      if (!key) return '';
      const det = detected.find(d => d.key === key);
      if (!det) return '';
      return det.existingId ? `acc:${det.existingId}` : `new:${det.key}`;
    };

    const fps = await loadExistingFingerprints();
    const ctx = { userId: user?.id ?? '', detected, accounts };

    const preview: PreviewRow[] = result.transactions.map(t => {
      const category = t.type === 'transfer'
        ? (categories.find(c => c.name.toLowerCase() === 'other' && c.type === 'expense')?.name || 'Other')
        : (suggestCategory(t.description, categories, t.type)?.name
          || categories.find(c => c.name.toLowerCase() === 'other' && c.type === t.type)?.name
          || 'Other');
      return {
        id: t.id,
        date: t.date,
        type: t.type,
        amount: t.amount,
        category,
        description: t.description,
        payment_method: 'bank_transfer' as PaymentMethod,
        accountRef: accountRefForKey(t.accountKey),
        notes: 'Bank statement import',
        transfer_direction: t.type === 'transfer' ? (t.direction === 'credit' ? 'in' : 'out') : null,
        isDuplicate: false,
      };
    });

    // de-dupe within the file, then against the database
    const uniq = preview.filter((r, i, arr) =>
      arr.findIndex(x => rowFingerprint(x, ctx) === rowFingerprint(r, ctx)) === i
    );
    setRows(uniq.map(r => ({ ...r, isDuplicate: fps.has(rowFingerprint(r, ctx)) })));
  };

  const handleJson = async (file: File) => {
    const text = await file.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      setError('Invalid JSON file.');
      return;
    }
    const rawList: unknown = Array.isArray(data)
      ? data
      : (data && typeof data === 'object' && Array.isArray((data as { transactions?: unknown }).transactions)
          ? (data as { transactions: unknown[] }).transactions
          : null);
    const list = rawList as Record<string, unknown>[] | null;
    if (!list || !list.length) {
      setError('No transactions found in the JSON file.');
      return;
    }

    // PhonePe-style rows carry narration/notes; structured backups carry account strings.
    const looksStructured = list.every(r => r && typeof r === 'object' && 'category' in r && 'account' in r && 'payment_method' in r);

    let normalized: { row: NormalizedPhonePeRow; accountName: string | null }[];
    if (looksStructured) {
      normalized = list.map((r) => {
        const rawType = String(r.type || 'expense').toLowerCase();
        const type: PreviewRow['type'] = rawType.includes('transfer') ? 'transfer'
          : rawType.includes('credit') || rawType.includes('income') || rawType === 'cr' ? 'income'
          : rawType.includes('refund') ? 'refund' : 'expense';
        return {
          row: {
            date: String(r.date || '').split('T')[0],
            type,
            amount: Math.abs(parseFloat(String(r.amount)) || 0),
            category: r.category || 'Other',
            description: String(r.description || r.narration || '').slice(0, 200),
            payment_method: String(r.payment_method || 'cash').toLowerCase() as PaymentMethod,
            account: String(r.account || ''),
            notes: String(r.notes || ''),
            source_account_last4: null,
          } as NormalizedPhonePeRow,
          accountName: String(r.account || '') || null,
        };
      });
    } else {
      normalized = list.map((r) => ({ row: normalizePhonePeRow(r, categories), accountName: null }));
    }

    // Resolve account references first so the detected list is complete
    const detectedByKey = new Map<string, DetectedAccount>();
    const refs: AccountRef[] = normalized.map(n => refForJsonRow(n, detectedByKey, accounts));
    const detected = Array.from(detectedByKey.values());
    setDetectedAccounts(detected);

    const fps = await loadExistingFingerprints();
    const ctx = { userId: user?.id ?? '', detected, accounts };

    const preview: PreviewRow[] = normalized.map((n, i) => ({
      id: `json-${i}`,
      date: n.row.date,
      type: n.row.type,
      amount: n.row.amount,
      category: n.row.category,
      description: n.row.description,
      payment_method: n.row.payment_method,
      accountRef: refs[i],
      notes: n.row.notes,
      transfer_direction: n.row.type === 'transfer' ? 'out' : null,
      isDuplicate: false,
    }));

    const uniq = preview.filter((r, i, arr) =>
      arr.findIndex(x => rowFingerprint(x, ctx) === rowFingerprint(r, ctx)) === i
    );
    setRows(uniq.map(r => ({ ...r, isDuplicate: fps.has(rowFingerprint(r, ctx)) })));
  };

  // ------------------------------------------------------------------------
  // Import
  // ------------------------------------------------------------------------

  const validRows = rows.filter(r => !r.isDuplicate);
  const unassigned = validRows.filter(r => !r.accountRef).length;

  const handleImport = async () => {
    if (!validRows.length) return;
    setImporting(true);
    setError('');
    setMessage('');

    try {
      // 1. Materialize any new accounts (server-side findOrCreate makes this safe to retry)
      const accountIdByRef = new Map<string, string>();
      for (const det of detectedAccounts) {
        const ref = `new:${det.key}`;
        if (!rows.some(r => r.accountRef === ref)) continue;
        const created = await accountsApi.create({
          name: det.name,
          type: det.type,
          bank_name: det.bank_name,
          account_number_last4: det.account_number_last4 ?? null,
          opening_balance: 0,
          currency: 'INR',
          is_active: true,
        });
        accountIdByRef.set(ref, created.id);
      }

      // 2. Create transactions
      let inserted = 0;
      let skipped = 0;
      for (const row of validRows) {
        const existingId = refExistingId(row.accountRef);
        const accountId = existingId ?? accountIdByRef.get(row.accountRef) ?? null;
        const accountName = refLabel(row.accountRef);
        try {
          await transactionsApi.create({
            date: row.date,
            type: row.type,
            amount: Math.round(Number(row.amount) * 100) / 100,
            category: row.category,
            description: row.description,
            payment_method: row.payment_method,
            account: accountName,
            account_id: accountId,
            transfer_direction: row.type === 'transfer' ? (row.transfer_direction ?? 'out') : null,
            notes: row.notes,
          });
          inserted++;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : '';
          if (msg.includes('409') || msg.includes('duplicate') || msg.includes('UNIQUE')) {
            skipped++;
          } else {
            throw e;
          }
        }
      }

      setMessage(`Successfully imported ${inserted} transactions.${skipped ? ` ${skipped} duplicates were skipped.` : ''}`);
      setRows([]);
      setDetectedAccounts([]);
      setWarnings([]);
      setFileName('');
      window.dispatchEvent(new CustomEvent('transactions-updated'));

      // Refresh accounts (new ones may have been created)
      setAccounts(await accountsApi.list());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const assignAllUnassigned = (ref: string) => {
    setRows(prev => prev.map(r => {
      if (r.accountRef || r.isDuplicate) return r;
      const next = { ...r, accountRef: ref };
      next.isDuplicate = refreshDuplicateFlag(next, existingFingerprints);
      return next;
    }));
  };

  // ------------------------------------------------------------------------
  // Per-account summary groups
  // ------------------------------------------------------------------------

  interface Group {
    ref: AccountRef;
    label: string;
    count: number;
    income: number;
    expenses: number;
    transfers: number;
    needs: boolean;
  }
  const groups: Group[] = (() => {
    const map = new Map<AccountRef, Group>();
    for (const r of rows) {
      if (r.isDuplicate) continue;
      const key = r.accountRef;
      if (!map.has(key)) {
        map.set(key, {
          ref: key,
          label: key ? refLabel(key) : 'Needs account assignment',
          count: 0, income: 0, expenses: 0, transfers: 0,
          needs: !key,
        });
      }
      const g = map.get(key)!;
      g.count++;
      if (r.type === 'income' || r.type === 'refund') g.income += r.amount;
      else if (r.type === 'expense') g.expenses += r.amount;
      else if (r.type === 'transfer') g.transfers += r.amount;
    }
    return Array.from(map.values()).sort((a, b) => Number(a.needs) - Number(b.needs) || a.label.localeCompare(b.label));
  })();

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  const accountOptions = (
    <>
      {detectedAccounts.map(d => (
        <SelectItem key={d.key} value={d.existingId ? `acc:${d.existingId}` : `new:${d.key}`}>
          {detectedLabel(d)}{d.existingId ? '' : ' (new)'}
        </SelectItem>
      ))}
      {accounts.map(a => (
        <SelectItem key={a.id} value={`acc:${a.id}`}>{formatAccountLabel(a)}</SelectItem>
      ))}
    </>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Transactions</h1>
        <p className="text-muted-foreground">
          Import a bank statement (PDF) or a PhonePe / JSON transaction export.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload a file</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border-2 border-dashed p-8 text-center">
            <Upload className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <p className="mb-2 font-medium">Bank statement (PDF) or JSON export</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Accounts are detected automatically (bank name and last 4 digits). Transactions
              from different accounts are kept separate.
            </p>
            <input
              type="file"
              accept=".pdf,.json,application/pdf,application/json"
              className="mx-auto block max-w-full text-sm"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) handleFile(selected);
                e.target.value = '';
              }}
            />
          </div>

          {parsing && (
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm">Parsing {fileName}…</p>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border p-4 bg-yellow-50 dark:bg-yellow-900/20">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
              <div className="text-sm">
                {warnings.map((w, i) => <p key={i}>{w}</p>)}
              </div>
            </div>
          )}

          {message && (
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
              <p className="text-sm">{message}</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <>
          {/* Account group summaries */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groups.map(g => (
              <Card key={g.ref || 'needs'} className={g.needs ? 'border-yellow-400' : ''}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {g.needs
                      ? <AlertCircle className="h-4 w-4 text-yellow-600" />
                      : <Landmark className="h-4 w-4 text-primary" />}
                    {g.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p className="font-medium">{g.count} transactions</p>
                  <p className="text-green-600">Income {formatCurrency(g.income)}</p>
                  <p className="text-red-600">Expenses {formatCurrency(g.expenses)}</p>
                  <p className="text-purple-600">Transfers {formatCurrency(g.transfers)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {unassigned > 0 && (
            <Card className="border-yellow-400">
              <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm">
                  <span className="font-medium text-yellow-700">{unassigned} transaction(s)</span>{' '}
                  need an account before importing.
                </p>
                <div className="flex items-center gap-2">
                  <Select onValueChange={assignAllUnassigned}>
                    <SelectTrigger className="w-[240px]"><SelectValue placeholder="Assign all to…" /></SelectTrigger>
                    <SelectContent>{accountOptions}</SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transaction preview table */}
          <Card>
            <CardHeader>
              <CardTitle>Review transactions ({rows.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border max-h-[28rem] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="p-2">Date</th>
                      <th className="p-2">Description</th>
                      <th className="p-2 text-right">Amount</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Category</th>
                      <th className="p-2">Account</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(t => {
                      const availableCats = categories
                        .filter(c => c.type === (t.type === 'transfer' || t.type === 'refund' ? 'expense' : t.type))
                        .map(c => c.name);
                      return (
                        <tr key={t.id} className={`border-b ${!t.accountRef ? 'bg-yellow-50/60 dark:bg-yellow-900/10' : ''}`}>
                          <td className="py-2 px-2 whitespace-nowrap">{t.date}</td>
                          <td className="py-2 px-2 max-w-[260px] truncate" title={t.description}>{t.description}</td>
                          <td className="py-2 px-2 text-right font-mono whitespace-nowrap">
                            {t.type === 'income' || t.type === 'refund' || (t.type === 'transfer' && t.transfer_direction === 'in') ? '+' : '−'}
                            {formatCurrency(t.amount)}
                          </td>
                          <td className="py-2 px-2">
                            <Select value={t.type} onValueChange={(v) => updateRow(t.id, {
                              type: v as TransactionType,
                              transfer_direction: v === 'transfer' ? (t.transfer_direction ?? 'out') : null,
                            })}>
                              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="expense">Expense</SelectItem>
                                <SelectItem value="income">Income</SelectItem>
                                <SelectItem value="transfer">Transfer</SelectItem>
                                <SelectItem value="refund">Refund</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-2 px-2">
                            <Select value={t.category} onValueChange={(v) => updateRow(t.id, { category: v })}>
                              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {availableCats.map(cat => (
                                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-2 px-2">
                            <Select
                              value={t.accountRef || undefined}
                              onValueChange={(v) => updateRow(t.id, { accountRef: v })}
                            >
                              <SelectTrigger className={`w-[200px] ${!t.accountRef ? 'border-yellow-500' : ''}`}>
                                <SelectValue placeholder="Needs assignment" />
                              </SelectTrigger>
                              <SelectContent>{accountOptions}</SelectContent>
                            </Select>
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap">
                            {t.isDuplicate ? (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">Duplicate</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">New</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {validRows.length} new · {rows.length - validRows.length} duplicates · {fileKind?.toUpperCase() ?? ''}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetState} disabled={importing}>
                    <X className="mr-2 h-4 w-4" /> Cancel
                  </Button>
                  <Button onClick={handleImport} disabled={importing || validRows.length === 0 || unassigned > 0}>
                    {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Import {validRows.length} Transactions
                  </Button>
                </div>
              </div>
              {unassigned > 0 && (
                <p className="text-xs text-yellow-700">Assign an account to every transaction to enable import.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
