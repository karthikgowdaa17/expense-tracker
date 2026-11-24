'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/utils/currency';
import { generateTransactionFingerprint, deduplicateTransactions } from '@/utils/fingerprint';
import { suggestCategory } from '@/utils/categorySuggestion';
import { Category, Account, PaymentMethod, AccountType, TransactionType, Frequency, UserSettings, Profile } from '@/types';
import { normalizePhonePeRow, parseCSV, extractMerchantKey } from '@/lib/import/phonepe';
import {
  detectedLabel, resolveRefLabel, rowFingerprint, refExistingId, refForJsonRow,
  type DetectedAccount, type AccountRef,
} from '@/lib/import/preview';
import { formatAccountLabel, buildAccountMap } from '@/utils/accounts';
import { Plus, Loader2, Edit, Trash2, Download, Upload, Trash, AlertTriangle, Save, X, CheckCircle2, FileText, AlertCircle } from 'lucide-react';
import { cn } from '@/utils/currency';
import { useForm } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { categoriesApi } from '@/lib/api/categories';
import { accountsApi } from '@/lib/api/accounts';
import { settingsApi } from '@/lib/api/settings';
import { profilesApi } from '@/lib/api/profiles';
import { transactionsApi } from '@/lib/api/transactions';
import { budgetsApi } from '@/lib/api/budgets';
import { recurringApi } from '@/lib/api/recurring';

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['income', 'expense']),
  icon: z.string().optional(),
  color: z.string().optional(),
});

const accountSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['cash', 'bank_account', 'credit_card', 'savings', 'investment', 'other']),
  bank_name: z.string().optional(),
  account_number_last4: z.string().regex(/^\d{4}$/, 'Exactly 4 digits').optional().or(z.literal('')),
  opening_balance: z.number(),
  currency: z.string(),
});

type CategoryFormData = z.infer<typeof categorySchema>;
type AccountFormData = z.infer<typeof accountSchema>;

const DEFAULT_CATEGORIES = {
  income: [
    { name: 'Salary', icon: '💼', color: '#10B981' },
    { name: 'Bonus', icon: '🎁', color: '#059669' },
    { name: 'Freelance', icon: '💻', color: '#0D9488' },
    { name: 'Business', icon: '🏢', color: '#0891B2' },
    { name: 'Investment', icon: '📈', color: '#7C3AED' },
    { name: 'Other Income', icon: '➕', color: '#6B7280' },
  ],
  expense: [
    { name: 'Housing', icon: '🏠', color: '#EF4444' },
    { name: 'Food', icon: '🍽️', color: '#F97316' },
    { name: 'Transportation', icon: '🚗', color: '#EAB308' },
    { name: 'Shopping', icon: '🛍️', color: '#EC4899' },
    { name: 'Entertainment', icon: '🎬', color: '#8B5CF6' },
    { name: 'Bills & Utilities', icon: '📄', color: '#06B6D4' },
    { name: 'Health', icon: '❤️', color: '#F43F5E' },
    { name: 'Education', icon: '🎓', color: '#6366F1' },
    { name: 'Travel', icon: '✈️', color: '#14B8A6' },
    { name: 'Other', icon: '⋯', color: '#9CA3AF' },
  ],
};

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'upi', 'credit_card', 'debit_card', 'bank_transfer', 'other'];
const ACCOUNT_TYPES: AccountType[] = ['cash', 'bank_account', 'credit_card', 'savings', 'investment', 'other'];

interface PhonePePreviewRow {
  date: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  category: string;
  description: string;
  payment_method: string;
  account: string;
  notes: string;
  accountRef: AccountRef;
  isDuplicate: boolean;
}

type NormalizedImport = {
  date: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  category: string;
  description: string;
  payment_method: string;
  account: string;
  notes: string;
  account_id: string | null;
  transfer_direction: 'in' | 'out' | null;
};

interface ImportPreviewRow extends NormalizedImport {
  isDuplicate: boolean;
}

export default function SettingsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'general' | 'categories' | 'accounts' | 'data' | 'profile'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      const validTabs = ['general','categories','accounts','data','profile'] as const;
      if (tab && validTabs.includes(tab as typeof validTabs[number])) {
        return tab as 'general' | 'categories' | 'accounts' | 'data' | 'profile';
      }
    }
    return 'general';
  });
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // PhonePe import state
  const [phonepeFile, setPhonepeFile] = useState<File | null>(null);
  const [phonepeParsed, setPhonepeParsed] = useState<PhonePePreviewRow[]>([]);
  const [phonepePreview, setPhonepePreview] = useState<PhonePePreviewRow[]>([]);
  const [phonepeSummary, setPhonepeSummary] = useState<{ total: number; income: number; expense: number; transfers: number; duplicates: number; newTx: number } | null>(null);
  const [phonepeImporting, setPhonepeImporting] = useState(false);
  const [phonepeError, setPhonepeError] = useState('');
  const [phonepeMessage, setPhonepeMessage] = useState('');
  const [learnedMap, setLearnedMap] = useState<Record<string, string>>({}); // merchant_key -> category name
  const [phonepeDetectedAccounts, setPhonepeDetectedAccounts] = useState<DetectedAccount[]>([]);
  const [phonepeExistingFps, setPhonepeExistingFps] = useState<Set<string>>(new Set());

  // Account delete dialog state
  const [deleteAccount, setDeleteAccount] = useState<Account | null>(null);
  const [deleteMode, setDeleteMode] = useState<'unassign' | 'reassign' | 'delete'>('unassign');
  const [deleteReassignTo, setDeleteReassignTo] = useState<string>('');
  const [accountTxCounts, setAccountTxCounts] = useState<Record<string, number>>({});
  const [accountBalances, setAccountBalances] = useState<Record<string, number>>({});

  // Generic JSON Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importParsed, setImportParsed] = useState<Record<string, unknown> | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewRow[]>([]);
  const [importSummary, setImportSummary] = useState<{ total: number; income: number; expense: number; transfers: number; duplicates: number; newTx: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importMessage, setImportMessage] = useState('');

  const { user, loading: authLoading } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const categoryForm = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', type: 'expense', icon: '', color: '#3B82F6' },
  });

  const accountForm = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: '', type: 'bank_account', bank_name: '', account_number_last4: '', opening_balance: 0, currency: 'INR' },
  });

  const profileSchema = z.object({
    full_name: z.string().optional(),
    avatar_url: z.string().url().or(z.literal('')).optional(),
    currency: z.string(),
    theme: z.enum(['light', 'dark', 'system']),
    financial_year_start_month: z.number().min(1).max(12),
  });
  type ProfileFormData = z.infer<typeof profileSchema>;

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: '',
      avatar_url: '',
      currency: 'INR',
      theme: 'system',
      financial_year_start_month: 4,
    },
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      if (!user) return;
      setUserEmail(user.email || '');

      const [catRes, accRes, setRes, profRes, txRes] = await Promise.all([
        categoriesApi.list(),
        accountsApi.list(),
        settingsApi.get(),
        profilesApi.get(),
        transactionsApi.list(),
      ]);

      setCategories(catRes);
      setAccounts(accRes);
      setSettings(setRes);
      setProfile(profRes);

      // Per-account stats (count + current balance incl. transfer direction)
      const counts: Record<string, number> = {};
      const balances: Record<string, number> = {};
      for (const acc of accRes) balances[acc.id] = acc.opening_balance;
      for (const t of txRes) {
        if (!t.account_id) continue;
        counts[t.account_id] = (counts[t.account_id] || 0) + 1;
        if (t.account_id in balances) {
          if (t.type === 'income' || t.type === 'refund') balances[t.account_id] += t.amount;
          else if (t.type === 'expense') balances[t.account_id] -= t.amount;
          else if (t.type === 'transfer') balances[t.account_id] += (t.transfer_direction === 'in' ? t.amount : -t.amount);
        }
      }
      setAccountTxCounts(counts);
      setAccountBalances(balances);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updateUserSettings = async (updates: Partial<{ currency: string; financial_year_start_month: number }>) => {
    try {
      if (!user) return;
      const updated = await settingsApi.upsert(updates);
      setSettings(updated);
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchData();
    })();
  }, [fetchData]);

  // Load learned category mappings from localStorage
  useEffect(() => {
    (async () => {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('cat_memory');
        if (stored) {
          try {
            setLearnedMap(JSON.parse(stored));
          } catch {}
        }
      }
    })();
  }, []);

  // Reset profile form when profile data loads
  useEffect(() => {
    if (profile) {
      profileForm.reset({
        full_name: profile.full_name || '',
        avatar_url: profile.avatar_url || '',
        currency: profile.currency || 'INR',
        theme: profile.theme || 'system',
        financial_year_start_month: profile.financial_year_start_month || 4,
      });
    }
  }, [profile, profileForm]);

  const handleCategorySubmit = async (data: CategoryFormData) => {
    try {
      if (!user) return;

      if (editingCategory) {
        await categoriesApi.update(editingCategory.id, data);
      } else {
        await categoriesApi.create(data);
      }
      setCategoryDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error('Failed to save category:', err);
    }
  };

  const handleAccountSubmit = async (data: AccountFormData) => {
    try {
      if (!user) return;

      const payload = {
        ...data,
        bank_name: data.bank_name?.trim() || null,
        account_number_last4: data.account_number_last4?.trim() || null,
      };

      if (editingAccount) {
        await accountsApi.update(editingAccount.id, payload);
      } else {
        await accountsApi.create({ ...payload, is_active: true });
      }
      setAccountDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error('Failed to save account:', err);
    }
  };

  const handleProfileSubmit = async (data: ProfileFormData) => {
    try {
      if (!user) return;

      await profilesApi.update(data);

      setProfileMessage({ type: 'success', text: 'Profile updated successfully' });
      fetchData();
    } catch (err) {
      console.error('Failed to save profile:', err);
      setProfileMessage({ type: 'error', text: 'Failed to update profile' });
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    try {
      await categoriesApi.delete(cat.id);
      fetchData();
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  };

  const openDeleteAccount = (acc: Account) => {
    setDeleteAccount(acc);
    setDeleteMode('unassign');
    const others = accounts.filter(a => a.id !== acc.id);
    setDeleteReassignTo(others[0]?.id ?? '');
  };

  const handleDeleteAccount = async () => {
    if (!deleteAccount) return;
    try {
      await accountsApi.remove(
        deleteAccount.id,
        deleteMode,
        deleteMode === 'reassign' ? deleteReassignTo : undefined,
      );
      setDeleteAccount(null);
      fetchData();
    } catch (err) {
      console.error('Failed to delete account:', err);
    }
  };

  const handleExportData = async () => {
    try {
      if (!user) return;

      const [txRes, catRes, budRes, accRes, recRes] = await Promise.all([
        transactionsApi.list(),
        categoriesApi.list(),
        budgetsApi.list(),
        accountsApi.list(),
        recurringApi.list(),
      ]);

      const exportData = {
        transactions: txRes,
        categories: catRes,
        budgets: budRes,
        accounts: accRes,
        recurring_transactions: recRes,
        exported_at: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expense-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
  } catch (err) {
      console.error('Failed to export data:', err);
    }
  };

  const handleResetData = async () => {
    const confirmed = window.confirm('This will permanently delete ALL your data (transactions, categories, budgets, accounts, recurring transactions, settings). This cannot be undone. Are you sure?');
    if (!confirmed) return;
    const doubleConfirmed = window.confirm('Type "DELETE" in the next prompt to confirm.');
    if (!doubleConfirmed) return;
    const text = window.prompt('Type DELETE to confirm');
    if (text !== 'DELETE') return;

    try {
      if (!user) return;

      // Helper to delete all items of a resource
      const deleteAll = async <T extends { id: string }>(listFn: () => Promise<T[]>, deleteFn: (id: string) => Promise<void>) => {
        const items = await listFn();
        for (const item of items) {
          await deleteFn(item.id);
        }
      };

      // Delete in order respecting FK
      await deleteAll(transactionsApi.list, transactionsApi.delete);
      await deleteAll(budgetsApi.list, budgetsApi.delete);
      await deleteAll(recurringApi.list, recurringApi.delete);
      await deleteAll(categoriesApi.list, categoriesApi.delete);
      await deleteAll(accountsApi.list, accountsApi.delete);
      // user_settings: no delete endpoint, skip
      // profiles keep (auth user)
      alert('All data has been deleted.');
      fetchData();
    } catch (err) {
      console.error('Failed to reset data:', err);
      alert('Reset failed');
    }
  };

  const handleClearTransactions = async () => {
    const confirmed = window.confirm('This will permanently delete ALL your transactions. This cannot be undone. Are you sure?');
    if (!confirmed) return;
    const doubleConfirmed = window.confirm('Type "CLEAR TRANSACTIONS" in the next prompt to confirm.');
    if (!doubleConfirmed) return;
    const text = window.prompt('Type CLEAR TRANSACTIONS to confirm');
    if (text !== 'CLEAR TRANSACTIONS') return;

    try {
      if (!user) return;

      const items = await transactionsApi.list();
      for (const item of items) {
        await transactionsApi.delete(item.id);
      }

      alert('All transactions have been cleared.');
      fetchData();
    } catch (err) {
      console.error('Failed to clear transactions:', err);
      alert('Clear transactions failed');
    }
  };

  // ---------- PhonePe Import ----------
  const handlePhonePeFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhonepeFile(file);
    setPhonepeError('');
    setPhonepeMessage('');
    setPhonepePreview([]);
    setPhonepeSummary(null);

    const text = await file.text();
    let rows: Record<string, unknown>[] = [];
    if (file.name.endsWith('.json')) {
      try {
        const data = JSON.parse(text);
        if (Array.isArray(data)) rows = data;
        else throw new Error('JSON must be an array');
      } catch (e) {
        setPhonepeError('Invalid JSON file');
        return;
      }
    } else {
      rows = parseCSV(text);
    }

    // normalize (shared PhonePe rules: categorization + learned mappings)
    const normalized = rows.map(r => normalizePhonePeRow(r, categories, learnedMap));

    // Deduplicate within the file first; the funding account (when detectable
    // from notes) is part of the duplicate identity so identical payments made
    // from two different accounts do not collapse.
    const uniqueNormalized = deduplicateTransactions(normalized.map(n => ({
      ...n,
      userId: 'import',
      account_id: n.source_account_last4 ? `src-${n.source_account_last4}` : null,
    }))).map(n => {
      const { userId, ...rest } = n;
      return rest;
    });

    // Resolve an account for every row (PhonePe notes → detected accounts)
    const detectedByKey = new Map<string, DetectedAccount>();
    const refs: AccountRef[] = uniqueNormalized.map(n => refForJsonRow({ row: n, accountName: null }, detectedByKey, accounts));
    const detected = Array.from(detectedByKey.values());
    setPhonepeDetectedAccounts(detected);
    const withRefs = uniqueNormalized.map((n, i) => ({ ...n, accountRef: refs[i], isDuplicate: false }));
    setPhonepeParsed(withRefs);

    // duplicate detection against database (account identity included)
    if (!user) { setPhonepeError('Not logged in'); return; }
    try {
      const existingTx = await transactionsApi.list();
      const fps = new Set(existingTx.map(t => generateTransactionFingerprint({
        userId: user.id,
        date: t.date,
        type: t.type,
        amount: t.amount,
        description: t.description,
        payment_method: t.payment_method as PaymentMethod,
        account: t.account,
        account_id: t.account_id ?? null,
      })));
      setPhonepeExistingFps(fps);
      const ctx = { userId: user.id, detected, accounts };
      const withDup = withRefs.map(r => ({ ...r, isDuplicate: fps.has(rowFingerprint(r, ctx)) }));
      setPhonepePreview(withDup);
      summarizePhonepe(withDup);
      return;
    } catch {
      setPhonepeError('Could not check for duplicates.');
      setPhonepePreview(withRefs);
    }

    summarizePhonepe(withRefs);
  };

  const summarizePhonepe = (withDup: PhonePePreviewRow[]) => {
    const total = withDup.length;
    const income = withDup.filter(t => t.type === 'income').length;
    const expense = withDup.filter(t => t.type === 'expense').length;
    const transfers = withDup.filter(t => t.type === 'transfer').length;
    const duplicates = withDup.filter(t => t.isDuplicate).length;
    const newTx = total - duplicates;
    setPhonepeSummary({ total, income, expense, transfers, duplicates, newTx });
  };

  const handlePhonePeImport = async () => {
    if (!phonepePreview.length) return;
    setPhonepeImporting(true);
    setPhonepeError('');
    setPhonepeMessage('');

    try {
      if (!user) throw new Error('Not logged in');

      const toImport = phonepePreview.filter(t => !t.isDuplicate);

      if (!toImport.length) {
        setPhonepeMessage('Nothing new to import. All transactions already exist.');
        setPhonepeImporting(false);
        return;
      }

      // Materialize detected accounts that don't exist yet (server-side findOrCreate is idempotent)
      const createdByRef = new Map<string, string>();
      for (const det of phonepeDetectedAccounts) {
        const ref = `new:${det.key}`;
        if (!toImport.some(t => t.accountRef === ref)) continue;
        const created = await accountsApi.create({
          name: det.name,
          type: det.type,
          bank_name: det.bank_name,
          account_number_last4: det.account_number_last4 ?? null,
          opening_balance: 0,
          currency: 'INR',
          is_active: true,
        });
        createdByRef.set(ref, created.id);
      }

      const rowsToUpsert = toImport.map(t => ({
        date: t.date,
        type: t.type,
        amount: Math.round(Number(t.amount) * 100) / 100,
        category: t.category,
        description: t.description,
        payment_method: t.payment_method as PaymentMethod,
        account: resolveRefLabel(t.accountRef, phonepeDetectedAccounts, accounts),
        account_id: refExistingId(t.accountRef) ?? createdByRef.get(t.accountRef) ?? null,
        transfer_direction: t.type === 'transfer' ? 'out' as const : null,
        notes: t.notes || '',
      }));

      let insertedCount = 0;
      let skippedCount = 0;

      for (const row of rowsToUpsert) {
        try {
          await transactionsApi.create(row);
          insertedCount++;
        } catch (e: unknown) {
          // assume conflict (duplicate fingerprint) -> skip
          if (e instanceof Error && (e.message.includes('409') || e.message.includes('duplicate') || e.message.includes('UNIQUE'))) {
            skippedCount++;
          } else {
            throw e;
          }
        }
      }

      setPhonepeMessage(`Successfully imported ${insertedCount} transactions. ${skippedCount} duplicates skipped.`);
      setPhonepeFile(null);
      setPhonepeParsed([]);
      setPhonepePreview([]);
      setPhonepeSummary(null);
      setPhonepeDetectedAccounts([]);
      fetchData();
    } catch (err: unknown) {
      setPhonepeError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setPhonepeImporting(false);
    }
  };

  const handlePhonePeCancel = () => {
    setPhonepeFile(null);
    setPhonepeParsed([]);
    setPhonepePreview([]);
    setPhonepeSummary(null);
    setPhonepeDetectedAccounts([]);
    setPhonepeError('');
    setPhonepeMessage('');
  };

  // ---------- Generic JSON Import Helpers ----------
  const normalizeTransaction = (tx: Record<string, unknown>, categories: Category[], accounts: Account[]): NormalizedImport => {
    const t = tx as {
      type?: string;
      amount?: number;
      category?: string;
      description?: string;
      narration?: string;
      payment_method?: string;
      paymentMethod?: string;
      account?: string;
      notes?: string;
      transfer_direction?: string;
      date?: string;
    };

    const rawType = ((t.type || 'expense') as string).toLowerCase();
    const typeRaw = rawType.replace(/^cr$/, 'credit').replace(/^dr$/, 'debit');
    let type: 'income' | 'expense' | 'transfer' = 'expense';

    if (typeRaw.includes('transfer')) {
      type = 'transfer';
    } else if (typeRaw.includes('credit') || typeRaw.includes('cr') || typeRaw.includes('received')) {
      type = 'income';
    } else if (typeRaw.includes('debit') || typeRaw.includes('dr') || typeRaw.includes('paid')) {
      type = 'expense';
    }

    const amount = Math.abs(Number(t.amount) || 0);

    // Auto-categorize if no category provided or category doesn't exist for type
    let category = t.category || '';
    if (!category) {
      const suggested = suggestCategory(t.description || t.narration || '', categories, type);
      if (suggested) category = suggested.name;
    }
    if (!category) {
      const defCat = categories.find(c => c.is_default && c.type === (type === 'transfer' ? 'expense' : type));
      category = defCat?.name || 'Other';
    } else {
      const catExists = categories.find(c => c.name === category && c.type === (type === 'transfer' ? 'expense' : type));
      if (!catExists) {
        const defCat = categories.find(c => c.is_default && c.type === (type === 'transfer' ? 'expense' : type));
        category = defCat?.name || 'Other';
      }
    }

    // Find matching account
    let account = t.account || 'Cash';
    const accExists = accounts.find(a => a.name === account);
    if (!accExists && accounts.length > 0) {
      account = accounts[0].name;
    }

    return {
      date: (t.date || '').split('T')[0],
      type,
      amount,
      category,
      description: (t.description || t.narration || '').slice(0, 200),
      payment_method: (t.payment_method || t.paymentMethod || 'cash').toLowerCase() as PaymentMethod,
      account,
      account_id: null,
      notes: t.notes || '',
      transfer_direction: type === 'transfer' ? (t.transfer_direction === 'in' ? 'in' : 'out') : null,
    };
  };

  const detectImportDuplicates = async (transactions: NormalizedImport[]): Promise<ImportPreviewRow[]> => {
    if (!user) return transactions as ImportPreviewRow[];
    const existingTx = await transactionsApi.list();
    const existingFingerprints = new Set(
      existingTx.map(t => generateTransactionFingerprint({
        userId: user.id,
        date: t.date,
        type: t.type,
        amount: t.amount,
        description: t.description,
        payment_method: t.payment_method as PaymentMethod,
        account: t.account,
        account_id: t.account_id ?? null,
      }))
    );
    const fingerprints = transactions.map(t => generateTransactionFingerprint({
      userId: user.id,
      date: t.date,
      type: t.type,
      amount: t.amount,
      description: t.description,
      payment_method: t.payment_method as PaymentMethod,
      account: t.account,
      account_id: t.account_id ?? null,
    }));
    return transactions.map((t, i) => ({ ...t, isDuplicate: existingFingerprints.has(fingerprints[i]) }));
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setImportFile(file);
    setImportError('');
    setImportMessage('');
    setImportPreview([]);
    setImportSummary(null);
    setImportParsed(null);

    try {
      const text = await file.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        setImportError('Invalid JSON file. Please select a valid JSON file.');
        return;
      }

      // Validate data structure
      if (!data || typeof data !== 'object') {
        setImportError('Invalid JSON structure.');
        return;
      }

      const backup = data as { transactions?: unknown; categories?: unknown; accounts?: unknown };

      if (!user) { setImportError('Not logged in'); return; }

      // Determine if it's a full backup or transaction-only
      const isFullBackup = backup.transactions !== undefined || backup.categories !== undefined || backup.accounts !== undefined;

      let transactions: NormalizedImport[] = [];

      if (isFullBackup) {
        // Full backup format
        transactions = Array.isArray(backup.transactions) ? (backup.transactions as NormalizedImport[]) : [];
      } else if (Array.isArray(data)) {
        // Transaction-only array format
        transactions = data as NormalizedImport[];
      } else {
        setImportError('Unsupported JSON format. Expected a full backup object or an array of transactions.');
        return;
      }

      if (transactions.length === 0) {
        setImportError('No transactions found in the selected file.');
        return;
      }

      setImportParsed(data as Record<string, unknown>);

      // Normalize transactions
      const normalized = transactions.map(t => normalizeTransaction(t, categories, accounts))
        .map(t => ({
          ...t,
          // Resolve the account id by name now, so duplicate detection uses the
          // same account identity the transaction will be stored with
          account_id: (accounts.find(a => a.name.toLowerCase() === String(t.account).toLowerCase())?.id) ?? null,
        }));

      // Deduplicate within the file first
      const uniqueNormalized = deduplicateTransactions(normalized.map(n => ({ ...n, userId: user.id })));

      // Detect duplicates against database
      const withDup = await detectImportDuplicates(uniqueNormalized);
      setImportPreview(withDup);

      // Calculate summary
      const total = withDup.length;
      const income = withDup.filter(t => t.type === 'income').length;
      const expense = withDup.filter(t => t.type === 'expense').length;
      const transfers = withDup.filter(t => t.type === 'transfer').length;
      const duplicates = withDup.filter(t => t.isDuplicate).length;
      const newTx = total - duplicates;
      
      setImportSummary({ total, income, expense, transfers, duplicates, newTx });

    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Failed to process file');
    }
  };

  const handleImportConfirm = async () => {
    if (!importPreview.length) return;
    setImporting(true);
    setImportError('');
    setImportMessage('');

    try {
      if (!user) throw new Error('Not logged in');

      // If full backup, import categories, accounts, budgets, recurring first
      const parsed = importParsed as {
        categories?: Array<{ name: string; type: string; icon?: string; color?: string; is_default?: boolean }>;
        accounts?: Array<{ name: string; type: string; bank_name?: string | null; account_number_last4?: string | null; opening_balance?: number; currency?: string; is_active?: boolean }>;
        budgets?: Array<{ category_id: string; month: string; amount: number; notes?: string }>;
        recurring_transactions?: Array<{ name: string; amount: number; category: string; subcategory?: string; description?: string; frequency: string; start_date: string; end_date?: string; payment_method: string; account: string; day_of_month?: number; day_of_week?: number; is_active?: boolean }>;
      } | null;

      if (parsed && (parsed.categories || parsed.accounts || parsed.budgets || parsed.recurring_transactions)) {
        // Import categories
        if (parsed.categories?.length) {
          for (const c of parsed.categories) {
            try {
              await categoriesApi.create({
                name: c.name,
                type: c.type as TransactionType,
                icon: c.icon,
                color: c.color,
                is_default: c.is_default,
              });
            } catch (e: unknown) {
              if (!(e instanceof Error && (e.message.includes('409') || e.message.includes('duplicate') || e.message.includes('UNIQUE')))) throw e;
            }
          }
        }

        // Import accounts (with bank metadata when the export has it)
        if (parsed.accounts?.length) {
          for (const a of parsed.accounts) {
            try {
              await accountsApi.create({
                name: a.name,
                type: a.type as AccountType,
                bank_name: a.bank_name ?? null,
                account_number_last4: a.account_number_last4 ?? null,
                opening_balance: a.opening_balance ?? 0,
                currency: a.currency || 'INR',
                is_active: a.is_active ?? true,
              });
            } catch (e: unknown) {
              if (!(e instanceof Error && (e.message.includes('409') || e.message.includes('duplicate') || e.message.includes('UNIQUE')))) throw e;
            }
          }
        }

        // Import budgets
        if (parsed.budgets?.length) {
          for (const b of parsed.budgets) {
            try {
              await budgetsApi.create({
                category_id: b.category_id,
                month: b.month,
                amount: b.amount,
                notes: b.notes,
              });
            } catch (e: unknown) {
              if (!(e instanceof Error && (e.message.includes('409') || e.message.includes('duplicate') || e.message.includes('UNIQUE')))) throw e;
            }
          }
        }

        // Import recurring transactions
        if (parsed.recurring_transactions?.length) {
          for (const r of parsed.recurring_transactions) {
            try {
              await recurringApi.create({
                name: r.name,
                amount: r.amount,
                category: r.category,
                subcategory: r.subcategory,
                description: r.description,
                frequency: r.frequency as Frequency,
                start_date: r.start_date,
                end_date: r.end_date,
                payment_method: r.payment_method as PaymentMethod,
                account: r.account,
                day_of_month: r.day_of_month,
                day_of_week: r.day_of_week,
                is_active: r.is_active ?? true,
              });
            } catch (e: unknown) {
              if (!(e instanceof Error && (e.message.includes('409') || e.message.includes('duplicate') || e.message.includes('UNIQUE')))) throw e;
            }
          }
        }
      }

      // Import new transactions only; resolve account ids by (possibly newly imported) account name
      const postImportAccounts = (parsed && parsed.accounts?.length)
        ? await accountsApi.list()
        : accounts;
      const accIdByLowerName = new Map(postImportAccounts.map(a => [a.name.toLowerCase(), a.id]));

      const rowsToUpsert = importPreview
        .filter(t => !t.isDuplicate)
        .map(t => ({
          date: t.date,
          type: t.type,
          amount: Math.round(Number(t.amount) * 100) / 100,
          category: t.category,
          description: t.description,
          payment_method: t.payment_method as PaymentMethod,
          account: t.account,
          account_id: accIdByLowerName.get(String(t.account).toLowerCase()) ?? null,
          transfer_direction: t.type === 'transfer' ? (t.transfer_direction ?? 'out') : null,
          notes: t.notes || '',
        }));

      if (!rowsToUpsert.length) {
        setImportMessage('Nothing new to import. All transactions already exist.');
        setImporting(false);
        return;
      }

      let insertedCount = 0;
      let skippedCount = 0;

      for (const row of rowsToUpsert) {
        try {
          await transactionsApi.create(row);
          insertedCount++;
        } catch (e: unknown) {
          if (e instanceof Error && (e.message.includes('409') || e.message.includes('duplicate') || e.message.includes('UNIQUE'))) {
            skippedCount++;
          } else {
            throw e;
          }
        }
      }

      setImportMessage(`Successfully imported ${insertedCount} transactions. ${skippedCount} duplicates skipped.`);
      setImportFile(null);
      setImportParsed(null);
      setImportPreview([]);
      setImportSummary(null);
      fetchData();
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleImportCancel = () => {
    setImportFile(null);
    setImportParsed(null);
    setImportPreview([]);
    setImportSummary(null);
    setImportError('');
    setImportMessage('');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your preferences and data</p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'general' | 'categories' | 'accounts' | 'data' | 'profile')}>
<TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
          </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Theme</p>
                  <p className="text-sm text-muted-foreground">Choose your preferred color scheme</p>
                </div>
                <Select value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}>
                  <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Currency</p>
                  <p className="text-sm text-muted-foreground">Default currency for all amounts</p>
                </div>
                <Select value={settings?.currency || 'INR'} onValueChange={async (v) => { await updateUserSettings({ currency: v }); }}>
                  <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">Indian Rupee (₹)</SelectItem>
                    <SelectItem value="USD">US Dollar ($)</SelectItem>
                    <SelectItem value="EUR">Euro (€)</SelectItem>
                    <SelectItem value="GBP">British Pound (£)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Financial Year</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Financial Year Start</p>
                  <p className="text-sm text-muted-foreground">Month when financial year begins (India: April)</p>
                </div>
                <Select value={String(settings?.financial_year_start_month || 4)} onValueChange={async (v) => { await updateUserSettings({ financial_year_start_month: parseInt(v, 10) }); }}>
                  <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{new Date(2024, i, 1).toLocaleString('default', { month: 'long' })}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <div className="flex items-center justify-between">
            <CardTitle>Expense Categories</CardTitle>
            <Button onClick={() => { setEditingCategory(null); categoryForm.reset(); setCategoryDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </div>

          {['expense', 'income'].map(type => (
            <Card key={type}>
              <CardHeader>
                <CardTitle className="capitalize">{type} Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {categories.filter(c => c.type === type).map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-3 border rounded-lg" style={{ backgroundColor: cat.color ? `${cat.color}15` : 'transparent' }}>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: cat.color || '#9CA3AF' }}>
                          {cat.icon || '📁'}
                        </div>
                        <div>
                          <p className="font-medium">{cat.name}</p>
                          <p className="text-xs text-muted-foreground">{cat.is_default ? 'Default' : 'Custom'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!cat.is_default && (
                          <>
                            <Button variant="outline" size="icon" onClick={() => { setEditingCategory(cat); categoryForm.reset({ name: cat.name, type: cat.type as 'income' | 'expense', icon: cat.icon || '', color: cat.color || '#3B82F6' }); setCategoryDialogOpen(true); }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete category</AlertDialogTitle>
                                  <AlertDialogDescription>Are you sure you want to delete this category?</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogAction onClick={() => handleDeleteCategory(cat)}>Delete</AlertDialogAction>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
                <DialogDescription>Create or edit a transaction category</DialogDescription>
              </DialogHeader>
              <form onSubmit={categoryForm.handleSubmit(handleCategorySubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input {...categoryForm.register('name')} placeholder="Category name" />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select onValueChange={(value) => categoryForm.setValue('type', value as 'income' | 'expense')} defaultValue={categoryForm.getValues('type')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Icon (Emoji)</Label>
                  <Input {...categoryForm.register('icon')} placeholder="🏠" maxLength={2} />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Input type="color" {...categoryForm.register('color')} className="h-10 w-10 p-0 cursor-pointer" />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
                  <Button type="submit">{editingCategory ? 'Update' : 'Create'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-6">
          <div className="flex items-center justify-between">
            <CardTitle>Accounts</CardTitle>
            <Button onClick={() => { setEditingAccount(null); accountForm.reset(); setAccountDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </div>

          <Card>
            <CardContent className="space-y-3">
              {accounts.map(acc => {
                const txCount = accountTxCounts[acc.id] || 0;
                const balance = accountBalances[acc.id];
                return (
                <div key={acc.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                      {acc.type === 'cash' && '💵'}
                      {acc.type === 'bank_account' && '🏦'}
                      {acc.type === 'credit_card' && '💳'}
                      {acc.type === 'savings' && '🐷'}
                      {acc.type === 'investment' && '📈'}
                      {acc.type === 'other' && '📦'}
                    </div>
                    <div>
                      <p className="font-medium">{formatAccountLabel(acc)}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {acc.type.replace('_', ' ')}
                        {acc.account_number_last4 ? ` · ••••${acc.account_number_last4}` : ''}
                        {' · '}{formatCurrency(balance ?? acc.opening_balance)} {acc.currency}
                        {' · '}{txCount} transaction{txCount === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => { setEditingAccount(acc); accountForm.reset({ name: acc.name, type: acc.type, bank_name: acc.bank_name || '', account_number_last4: acc.account_number_last4 || '', opening_balance: acc.opening_balance, currency: acc.currency }); setAccountDialogOpen(true); }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => openDeleteAccount(acc)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );})}
              {accounts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No accounts added yet. Add your first account to get started.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Safe account deletion: transactions are never silently dropped */}
          <Dialog open={!!deleteAccount} onOpenChange={(open) => { if (!open) setDeleteAccount(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete {deleteAccount ? formatAccountLabel(deleteAccount) : 'account'}</DialogTitle>
                <DialogDescription>
                  Choose what happens to the transactions of this account. Transactions are never deleted unless you explicitly choose that option.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <p className="text-sm text-muted-foreground">
                  This account has {deleteAccount ? (accountTxCounts[deleteAccount.id] || 0) : 0} transaction(s).
                </p>
                <div className="space-y-2">
                  <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
                    <input type="radio" name="delete-mode" className="mt-1" checked={deleteMode === 'unassign'} onChange={() => setDeleteMode('unassign')} />
                    <span>
                      <span className="font-medium text-sm">Keep transactions, unassign account</span>
                      <span className="block text-xs text-muted-foreground">Transactions stay in your history without a linked account.</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
                    <input type="radio" name="delete-mode" className="mt-1" checked={deleteMode === 'reassign'} onChange={() => setDeleteMode('reassign')} />
                    <span className="flex-1">
                      <span className="font-medium text-sm">Reassign transactions to another account</span>
                      <span className="block text-xs text-muted-foreground mb-2">Transfers and history are preserved on the target account.</span>
                      {deleteMode === 'reassign' && (
                        <Select value={deleteReassignTo} onValueChange={setDeleteReassignTo}>
                          <SelectTrigger><SelectValue placeholder="Select target account" /></SelectTrigger>
                          <SelectContent>
                            {accounts.filter(a => a.id !== deleteAccount?.id).map(a => (
                              <SelectItem key={a.id} value={a.id}>{formatAccountLabel(a)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </span>
                  </label>
                  <label className="flex items-start gap-3 rounded-lg border border-destructive/40 p-3 cursor-pointer">
                    <input type="radio" name="delete-mode" className="mt-1" checked={deleteMode === 'delete'} onChange={() => setDeleteMode('delete')} />
                    <span>
                      <span className="font-medium text-sm text-destructive">Delete transactions too</span>
                      <span className="block text-xs text-muted-foreground">Permanently deletes this account and all of its transactions.</span>
                    </span>
                  </label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteAccount(null)}>Cancel</Button>
                <Button
                  variant="destructive"
                  disabled={deleteMode === 'reassign' && !deleteReassignTo}
                  onClick={handleDeleteAccount}
                >
                  Delete Account
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingAccount ? 'Edit Account' : 'Add Account'}</DialogTitle>
                <DialogDescription>Add a new financial account</DialogDescription>
              </DialogHeader>
              <form onSubmit={accountForm.handleSubmit(handleAccountSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input {...accountForm.register('name')} placeholder="e.g., HDFC Bank, Cash Wallet" />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select onValueChange={(value) => accountForm.setValue('type', value as AccountType)} defaultValue={accountForm.getValues('type')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Bank Name (optional)</Label>
                    <Input {...accountForm.register('bank_name')} placeholder="e.g., HDFC Bank" />
                  </div>
                  <div className="space-y-2">
                    <Label>Account No. (last 4 digits)</Label>
                    <Input {...accountForm.register('account_number_last4')} placeholder="4521" maxLength={4} inputMode="numeric" />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Opening Balance</Label>
                    <Input type="number" step="0.01" {...accountForm.register('opening_balance', { valueAsNumber: true })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select onValueChange={(value) => accountForm.setValue('currency', value)} defaultValue={accountForm.getValues('currency')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INR">INR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setAccountDialogOpen(false)}>Cancel</Button>
                  <Button type="submit">{editingAccount ? 'Update' : 'Create'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {profileMessage && (
                <div className={cn(
                  'p-4 rounded-lg text-sm',
                  profileMessage.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                )}>
                  {profileMessage.text}
                </div>
              )}
              <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      {...profileForm.register('full_name')}
                      placeholder="Your name"
                      defaultValue={profile?.full_name || ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      disabled
                      value={userEmail}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="avatar_url">Avatar URL</Label>
                  <Input
                    id="avatar_url"
                    {...profileForm.register('avatar_url')}
                    placeholder="https://example.com/avatar.png"
                    defaultValue={profile?.avatar_url || ''}
                  />
                  <p className="text-xs text-muted-foreground">Enter a direct image URL. Leave empty to use initials.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      onValueChange={(value) => profileForm.setValue('currency', value)}
                      defaultValue={profile?.currency || settings?.currency || 'INR'}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INR">Indian Rupee (₹)</SelectItem>
                        <SelectItem value="USD">US Dollar ($)</SelectItem>
                        <SelectItem value="EUR">Euro (€)</SelectItem>
                        <SelectItem value="GBP">British Pound (£)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="theme">Theme</Label>
                    <Select
                      onValueChange={(value) => {
                        profileForm.setValue('theme', value as 'light' | 'dark' | 'system');
                        setTheme(value as 'light' | 'dark' | 'system');
                      }}
                      defaultValue={profile?.theme || settings?.theme || 'system'}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="financial_year_start_month">Financial Year Start</Label>
                    <Select
                      onValueChange={(value) => profileForm.setValue('financial_year_start_month', parseInt(value, 10))}
                      defaultValue={String(profile?.financial_year_start_month || settings?.financial_year_start_month || 4)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>{new Date(2024, i, 1).toLocaleString('default', { month: 'long' })}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end pt-4 border-t">
                  <Button type="submit" className="w-full md:w-auto">
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Export Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">Download all your data as a JSON file for backup or migration.</p>
              <Button onClick={handleExportData}>
                <Download className="mr-2 h-4 w-4" />
                Export All Data (JSON)
              </Button>
              <Link
                href="/export"
                className="inline-flex items-center gap-1 text-sm text-primary underline underline-offset-4"
              >
                Export Transactions (CSV/PDF) →
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Import Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">Import data from a previously exported JSON file or a transaction-only JSON array.</p>
              <p className="text-sm">
                Have a bank statement PDF?{' '}
                <Link href="/import" className="text-primary font-medium underline underline-offset-4">
                  Import bank statement (PDF) →
                </Link>
              </p>
              <Input type="file" accept=".json" onChange={handleImportFile} disabled={importing} />
              {importError && (
                <div className="flex items-start gap-3 rounded-lg border p-4 bg-destructive/10 text-destructive">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <p className="text-sm">{importError}</p>
                </div>
              )}
              {importMessage && (
                <div className="flex items-start gap-3 rounded-lg border p-4 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                  <p className="text-sm">{importMessage}</p>
                </div>
              )}
              {importSummary && (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center text-sm">
                  <div className="p-3 rounded-lg bg-muted/50"><p className="font-bold">{importSummary.total}</p><p className="text-xs text-muted-foreground">Transactions found</p></div>
                  <div className="p-3 rounded-lg bg-green-100/50"><p className="font-bold text-green-700">{importSummary.income}</p><p className="text-xs text-muted-foreground">Income</p></div>
                  <div className="p-3 rounded-lg bg-red-100/50"><p className="font-bold text-red-700">{importSummary.expense}</p><p className="text-xs text-muted-foreground">Expenses</p></div>
                  <div className="p-3 rounded-lg bg-purple-100/50"><p className="font-bold text-purple-700">{importSummary.transfers ?? 0}</p><p className="text-xs text-muted-foreground">Transfers</p></div>
                  <div className="p-3 rounded-lg bg-yellow-100/50"><p className="font-bold text-yellow-700">{importSummary.duplicates}</p><p className="text-xs text-muted-foreground">Duplicates</p></div>
                  <div className="p-3 rounded-lg bg-blue-100/50"><p className="font-bold text-blue-700">{importSummary.newTx}</p><p className="text-xs text-muted-foreground">New</p></div>
                </div>
              )}
              {importPreview.length > 0 && (
                <div className="rounded-lg border p-4 max-h-96 overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b">
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Description</th>
                        <th className="pb-2 text-right">Amount</th>
                        <th className="pb-2">Type</th>
                        <th className="pb-2">Category</th>
                        <th className="pb-2">Account</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.map((t, idx) => {
                        const availableCats = categories
                          .filter(c => c.type === (t.type === 'transfer' ? 'expense' : t.type))
                          .map(c => c.name);
                        const availableAccounts = accounts.map(a => a.name);
                        return (
                          <tr key={idx} className="border-b">
                            <td className="py-2 px-2 whitespace-nowrap">{t.date}</td>
                            <td className="py-2 px-2 max-w-xs truncate">{t.description}</td>
                            <td className="py-2 px-2 text-right font-mono whitespace-nowrap">{t.amount.toFixed(2)}</td>
                            <td className="py-2 px-2 capitalize whitespace-nowrap">{t.type}</td>
                            <td className="py-2 px-2 whitespace-nowrap">
                              <Select
                                value={t.category}
                                onValueChange={(val) => {
                                  const updated = [...importPreview];
                                  updated[idx] = { ...updated[idx], category: val };
                                  setImportPreview(updated);
                                }}
                              >
                                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {availableCats.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="py-2 px-2 whitespace-nowrap">
                              <Select
                                value={t.account}
                                onValueChange={(val) => {
                                  const updated = [...importPreview];
                                  updated[idx] = { ...updated[idx], account: val };
                                  setImportPreview(updated);
                                }}
                              >
                                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {availableAccounts.map(acc => (
                                    <SelectItem key={acc} value={acc}>{acc}</SelectItem>
                                  ))}
                                </SelectContent>
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
              )}
              {importPreview.length > 0 && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleImportCancel} disabled={importing}>
                    <X className="mr-2 h-4 w-4" /> Cancel
                  </Button>
                  <Button onClick={handleImportConfirm} disabled={importing || importSummary?.newTx === 0}>
                    {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Import {importSummary?.newTx ?? 0} Transactions
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PhonePe Import */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Import PhonePe Transactions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">Upload your PhonePe transaction statement to automatically add your transactions.</p>
              <Input type="file" accept=".csv,.json" onChange={handlePhonePeFile} />
              {phonepeError && (
                <div className="flex items-start gap-3 rounded-lg border p-4 bg-destructive/10 text-destructive">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <p className="text-sm">{phonepeError}</p>
                </div>
              )}
              {phonepeMessage && (
                <div className="flex items-start gap-3 rounded-lg border p-4 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                  <p className="text-sm">{phonepeMessage}</p>
                </div>
              )}
              {phonepeSummary && (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center text-sm">
                  <div className="p-3 rounded-lg bg-muted/50"><p className="font-bold">{phonepeSummary.total}</p><p className="text-xs text-muted-foreground">Transactions found</p></div>
                  <div className="p-3 rounded-lg bg-green-100/50"><p className="font-bold text-green-700">{phonepeSummary.income}</p><p className="text-xs text-muted-foreground">Income</p></div>
                  <div className="p-3 rounded-lg bg-red-100/50"><p className="font-bold text-red-700">{phonepeSummary.expense}</p><p className="text-xs text-muted-foreground">Expenses</p></div>
                  <div className="p-3 rounded-lg bg-purple-100/50"><p className="font-bold text-purple-700">{phonepeSummary.transfers ?? 0}</p><p className="text-xs text-muted-foreground">Transfers</p></div>
                  <div className="p-3 rounded-lg bg-yellow-100/50"><p className="font-bold text-yellow-700">{phonepeSummary.duplicates}</p><p className="text-xs text-muted-foreground">Duplicates</p></div>
                  <div className="p-3 rounded-lg bg-blue-100/50"><p className="font-bold text-blue-700">{phonepeSummary.newTx}</p><p className="text-xs text-muted-foreground">New</p></div>
                </div>
              )}
              {phonepePreview.length > 0 && (
                <div className="rounded-lg border p-4 max-h-96 overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b">
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Description</th>
                        <th className="pb-2 text-right">Amount</th>
                        <th className="pb-2">Type</th>
                        <th className="pb-2">Category</th>
                        <th className="pb-2">Account</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {phonepePreview.map((t, idx) => {
                        const merchantKey = extractMerchantKey(t.description);
                        const availableCats = categories
                          .filter(c => c.type === (t.type === 'transfer' ? 'expense' : t.type))
                          .map(c => c.name);
                        return (
                          <tr key={idx} className="border-b">
                            <td className="py-2 px-2 whitespace-nowrap">{t.date}</td>
                            <td className="py-2 px-2 max-w-xs truncate">{t.description}</td>
                            <td className="py-2 px-2 text-right font-mono whitespace-nowrap">{t.amount.toFixed(2)}</td>
                            <td className="py-2 px-2 capitalize whitespace-nowrap">{t.type}</td>
                            <td className="py-2 px-2 whitespace-nowrap">
                              <Select
                                value={t.category}
                                onValueChange={(val) => {
                                  const updated = [...phonepePreview];
                                  updated[idx] = { ...updated[idx], category: val };
                                  setPhonepePreview(updated);
                                  // Learn the merchant -> category mapping
                                  const newLearned = { ...learnedMap, [merchantKey]: val };
                                  setLearnedMap(newLearned);
                                  if (typeof window !== 'undefined') {
                                    localStorage.setItem('cat_memory', JSON.stringify(newLearned));
                                  }
                                }}
                              >
                                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {availableCats.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="py-2 px-2 whitespace-nowrap">
                              <Select
                                value={t.accountRef}
                                onValueChange={(val) => {
                                  const updated = [...phonepePreview];
                                  const next = { ...updated[idx], accountRef: val };
                                  // Recompute duplicate status with the new account identity
                                  next.isDuplicate = phonepeExistingFps.has(rowFingerprint(
                                    { ...next, payment_method: next.payment_method as PaymentMethod },
                                    { userId: user?.id ?? '', detected: phonepeDetectedAccounts, accounts },
                                  ));
                                  updated[idx] = next;
                                  setPhonepePreview(updated);
                                }}
                              >
                                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {phonepeDetectedAccounts.map(d => (
                                    <SelectItem key={d.key} value={d.existingId ? `acc:${d.existingId}` : `new:${d.key}`}>
                                      {detectedLabel(d)}{d.existingId ? '' : ' (new)'}
                                    </SelectItem>
                                  ))}
                                  {accounts.map(a => (
                                    <SelectItem key={a.id} value={`acc:${a.id}`}>{formatAccountLabel(a)}</SelectItem>
                                  ))}
                                </SelectContent>
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
              )}
              {phonepePreview.length > 0 && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handlePhonePeCancel} disabled={phonepeImporting}>
                    <X className="mr-2 h-4 w-4" /> Cancel
                  </Button>
                  <Button onClick={handlePhonePeImport} disabled={phonepeImporting}>
                    {phonepeImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Import {phonepeSummary?.newTx ?? 0} Transactions
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">Irreversible actions. Please be careful.</p>
              <div className="flex flex-col sm:flex-row gap-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" onClick={handleClearTransactions}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Clear All Transactions
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear all transactions?</AlertDialogTitle>
                      <AlertDialogDescription>This will permanently delete all your transactions. Categories, accounts, budgets, and recurring transactions will be preserved. This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogAction onClick={handleClearTransactions}>Clear Transactions</AlertDialogAction>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                  </AlertDialogContent>
                </AlertDialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" onClick={handleResetData}>
                      <Trash className="mr-2 h-4 w-4" />
                      Delete All Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete all data?</AlertDialogTitle>
                      <AlertDialogDescription>This will permanently delete all your transactions, categories, budgets, accounts, and settings. This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogAction onClick={handleResetData}>Delete Everything</AlertDialogAction>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}