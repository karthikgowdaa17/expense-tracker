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
import { createClient } from '@/lib/supabase/client';
import { generateTransactionFingerprint, deduplicateTransactions } from '@/utils/fingerprint';
import { Category, Account, PaymentMethod, AccountType, UserSettings, Profile } from '@/types';
import { Plus, Loader2, Edit, Trash2, Download, Upload, Trash, AlertTriangle, Save, X, CheckCircle2, FileText, AlertCircle } from 'lucide-react';
import { cn } from '@/utils/currency';
import { useForm } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['income', 'expense']),
  icon: z.string().optional(),
  color: z.string().optional(),
});

const accountSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['cash', 'bank_account', 'credit_card', 'savings', 'investment', 'other']),
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
  const [phonepeParsed, setPhonepeParsed] = useState<any[]>([]);
  const [phonepePreview, setPhonepePreview] = useState<any[]>([]);
  const [phonepeSummary, setPhonepeSummary] = useState<{ total: number; income: number; expense: number; transfers: number; duplicates: number; newTx: number } | null>(null);
  const [phonepeImporting, setPhonepeImporting] = useState(false);
  const [phonepeError, setPhonepeError] = useState('');
  const [phonepeMessage, setPhonepeMessage] = useState('');
  const [learnedMap, setLearnedMap] = useState<Record<string, string>>({}); // merchant_key -> category name

  // Generic JSON Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importParsed, setImportParsed] = useState<any>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importSummary, setImportSummary] = useState<{ total: number; income: number; expense: number; transfers: number; duplicates: number; newTx: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importMessage, setImportMessage] = useState('');

  const supabase = createClient();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const categoryForm = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', type: 'expense', icon: '', color: '#3B82F6' },
  });

  const accountForm = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: '', type: 'bank_account', opening_balance: 0, currency: 'INR' },
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email || '');

      const [catRes, accRes, setRes, profRes] = await Promise.all([
        supabase.from('categories').select('*').eq('user_id', user.id).order('type').order('name'),
        supabase.from('accounts').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
        supabase.from('profiles').select('*').eq('id', user.id).single(),
      ]);

      if (catRes.data) setCategories(catRes.data);
      if (accRes.data) setAccounts(accRes.data);
      if (setRes.data) setSettings(setRes.data);
      if (profRes.data) setProfile(profRes.data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const updateUserSettings = async (updates: Partial<{ currency: string; financial_year_start_month: number }>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from('user_settings').update(updates).eq('user_id', user.id);
      if (error) throw error;
      // refresh settings
      const { data } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single();
      if (data) setSettings(data);
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load learned category mappings from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('cat_memory');
      if (stored) {
        try {
          setLearnedMap(JSON.parse(stored));
        } catch {}
      }
    }
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (editingCategory) {
        const { error } = await supabase.from('categories').update(data).eq('id', editingCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('categories').insert({ ...data, user_id: user.id, is_default: false });
        if (error) throw error;
      }
      setCategoryDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error('Failed to save category:', err);
    }
  };

  const handleAccountSubmit = async (data: AccountFormData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (editingAccount) {
        const { error } = await supabase.from('accounts').update(data).eq('id', editingAccount.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('accounts').insert({ ...data, user_id: user.id, is_active: true });
        if (error) throw error;
      }
      setAccountDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error('Failed to save account:', err);
    }
  };

  const handleProfileSubmit = async (data: ProfileFormData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('profiles').update(data).eq('id', user.id);
      if (error) throw error;

      setProfileMessage({ type: 'success', text: 'Profile updated successfully' });
      fetchData();
    } catch (err) {
      console.error('Failed to save profile:', err);
      setProfileMessage({ type: 'error', text: 'Failed to update profile' });
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    try {
      const { error } = await supabase.from('categories').delete().eq('id', cat.id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  };

  const handleDeleteAccount = async (acc: any) => {
    try {
      const { error } = await supabase.from('accounts').delete().eq('id', acc.id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error('Failed to delete account:', err);
    }
  };

  const handleExportData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [txRes, catRes, budRes, accRes, recRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('user_id', user.id),
        supabase.from('categories').select('*').eq('user_id', user.id),
        supabase.from('budgets').select('*').eq('user_id', user.id),
        supabase.from('accounts').select('*').eq('user_id', user.id),
        supabase.from('recurring_transactions').select('*').eq('user_id', user.id),
      ]);

      const exportData = {
        transactions: txRes.data || [],
        categories: catRes.data || [],
        budgets: budRes.data || [],
        accounts: accRes.data || [],
        recurring_transactions: recRes.data || [],
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Delete in order respecting FK
      await supabase.from('transactions').delete().eq('user_id', user.id);
      await supabase.from('budgets').delete().eq('user_id', user.id);
      await supabase.from('recurring_transactions').delete().eq('user_id', user.id);
      await supabase.from('categories').delete().eq('user_id', user.id);
      await supabase.from('accounts').delete().eq('user_id', user.id);
      await supabase.from('user_settings').delete().eq('user_id', user.id);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      alert('All transactions have been cleared.');
      fetchData();
    } catch (err) {
      console.error('Failed to clear transactions:', err);
      alert('Clear transactions failed');
    }
  };

  // ---------- PhonePe Import Helpers ----------
  const parseCSV = (text: string): any[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim());
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
      return obj;
    });
    return rows;
  };

  const parseAmount = (value: unknown): number => {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^0-9.-]+/g, '');
      const parsed = Number.parseFloat(cleaned);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const isSelfTransfer = (desc: string): boolean => {
    const d = desc.toLowerCase();
    return (
      /transfer\s+(to|from).*\(self\)/.test(d) ||
      /self\s*transfer/.test(d) ||
      /transfer\s+to\s+.*self/.test(d) ||
      /transfer\s+from\s+.*self/.test(d)
    );
  };

  const normalizeDesc = (s: string): string => {
    return s.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.,;:]+/g, '');
  };

  const stripCorporateSuffixes = (s: string): string => {
    return s
      .replace(/\b(limited|ltd|pvt|private|inc|corp|corporation|company|co|llp|india|foods|services|solutions|technologies|systems|enterprises|ventures|group|holdings)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const extractMerchantKey = (desc: string): string => {
    let cleaned = desc.toLowerCase().trim().replace(/[^a-z0-9\s]/g, ' ');
    cleaned = stripCorporateSuffixes(cleaned);
    cleaned = cleaned.replace(/\s+/g, ' ');
    const words = cleaned.split(' ').filter(w => w.length > 2);
    // Take first two meaningful words as merchant identifier
    return words.slice(0, 2).join(' ');
  };

  const getCategoryForTransaction = (description: string, type: 'income' | 'expense' | 'transfer', categories: Category[]): string => {
    // Priority 1: User-learned mappings
    const merchantKey = extractMerchantKey(description);
    if (learnedMap[merchantKey]) {
      const learnedCat = learnedMap[merchantKey];
      const catExists = categories.find(c => c.name === learnedCat && c.type === (type === 'transfer' ? 'expense' : type));
      if (catExists) return learnedCat;
    }

    // Normalized description for keyword matching
    const normDesc = stripCorporateSuffixes(description.toLowerCase());

    // Priority 2: Strong exact merchant mappings (high confidence)
    const merchantMap: Record<string, string> = {
      // Food
      'swiggy': 'Food',
      'zomato': 'Food',
      'blinkit': 'Food',
      'zepto': 'Food',
      'instamart': 'Food',
      'bigbasket': 'Food',
      'dominos': 'Food',
      'domino': 'Food',
      'pizza hut': 'Food',
      'pizza': 'Food',
      'biryani': 'Food',
      'juice': 'Food',
      'sugar cane': 'Food',
      'bakery': 'Food',
      'cafe': 'Food',
      'restaurant': 'Food',
      'hotel': 'Food', // will be weighed with other keywords
      // Transport
      'uber': 'Transportation',
      'ola': 'Transportation',
      'rapido': 'Transportation',
      'namma yatri': 'Transportation',
      'metro': 'Transportation',
      'bmtc': 'Transportation',
      'cab': 'Transportation',
      'taxi': 'Transportation',
      'parking': 'Transportation',
      'fastag': 'Transportation',
      // Shopping
      'amazon': 'Shopping',
      'flipkart': 'Shopping',
      'myntra': 'Shopping',
      'meesho': 'Shopping',
      'ajio': 'Shopping',
      'nykaa': 'Shopping',
      'croma': 'Shopping',
      'reliance digital': 'Shopping',
      // Entertainment
      'netflix': 'Entertainment',
      'spotify': 'Entertainment',
      'youtube premium': 'Entertainment',
      'prime video': 'Entertainment',
      'disney': 'Entertainment',
      'sony liv': 'Entertainment',
      'hotstar': 'Entertainment',
      'steam': 'Entertainment',
      'playstation': 'Entertainment',
      'xbox': 'Entertainment',
      // Bills
      'bescom': 'Bills & Utilities',
      'electricity': 'Bills & Utilities',
      'water bill': 'Bills & Utilities',
      'gas bill': 'Bills & Utilities',
      'broadband': 'Bills & Utilities',
      'airtel': 'Bills & Utilities',
      'jio': 'Bills & Utilities',
      'vi': 'Bills & Utilities',
      'bsnl': 'Bills & Utilities',
      'recharge': 'Bills & Utilities',
      'bbps': 'Bills & Utilities',
      // Health
      'apollo': 'Health',
      '1mg': 'Health',
      'pharmeasy': 'Health',
      'netmeds': 'Health',
      'hospital': 'Health',
      'pharmacy': 'Health',
      'medical': 'Health',
      'clinic': 'Health',
      'diagnostic': 'Health',
      // Rent
      'rent': 'Rent',
      'landlord': 'Rent',
      // Income (only when type is income)
      'salary': 'Income',
      'payroll': 'Income',
      'employer': 'Income',
      'stipend': 'Income',
      'refund': 'Income',
      // Cash
      'atm': 'Cash',
      'cash withdrawal': 'Cash',
      // Transfer (handled by self-transfer detection)
    };

    // Check exact merchant key first
    for (const [merchant, cat] of Object.entries(merchantMap)) {
      if (normDesc.includes(merchant)) {
        // For Income category, ensure transaction type is income
        if (cat === 'Income' && type !== 'income') continue;
        // For Transfer category, ensure type is transfer (but we handle transfers earlier)
        if (cat === 'Transfer' && type !== 'transfer') continue;
        // Verify category exists for this type
        const catExists = categories.find(c => c.name === cat && c.type === (type === 'transfer' ? 'expense' : type));
        if (catExists) return cat;
      }
    }

    // Priority 3: Strong category keywords (broader)
    const catKeywords: Record<string, string[]> = {
      Food: ['food', 'restaurant', 'cafe', 'bakery', 'juice', 'sweets', 'biryani', 'pizza', 'hotel'],
      Transportation: ['uber', 'ola', 'rapido', 'namma yatri', 'metro', 'bmtc', 'bus', 'cab', 'taxi', 'parking', 'fastag'],
      Shopping: ['amazon', 'flipkart', 'myntra', 'meesho', 'ajio', 'nykaa', 'croma', 'reliance digital', 'shopping'],
      'Bills & Utilities': ['electricity', 'bescom', 'water', 'gas', 'broadband', 'airtel', 'jio', 'vi', 'bsnl', 'recharge', 'bbps', 'bill'],
      Entertainment: ['netflix', 'spotify', 'youtube', 'prime', 'disney', 'sony', 'hotstar', 'steam', 'playstation', 'xbox', 'gaming'],
      Health: ['apollo', '1mg', 'pharmeasy', 'netmeds', 'hospital', 'pharmacy', 'medical', 'clinic', 'diagnostic'],
      Rent: ['rent', 'landlord'],
      Income: ['salary', 'payroll', 'employer', 'stipend', 'refund', 'cashback'],
      Cash: ['atm', 'cash withdrawal', 'withdrawal'],
    };

    for (const [cat, keywords] of Object.entries(catKeywords)) {
      if (keywords.some(k => normDesc.includes(k))) {
        if (cat === 'Income' && type !== 'income') continue;
        const catExists = categories.find(c => c.name === cat && c.type === (type === 'transfer' ? 'expense' : type));
        if (catExists) return cat;
      }
    }

    // Priority 4: Match existing user categories by name (fallback to Other)
    const existingCat = categories.find(c => c.name.toLowerCase() === 'other' && c.type === (type === 'transfer' ? 'expense' : type));
    if (existingCat) return existingCat.name;

    // Fallback: default category of type
    const def = categories.find(c => c.is_default && c.type === (type === 'transfer' ? 'expense' : type));
    return def?.name || 'Other';
  };

  const normalizePhonePeRow = (row: any, categories: Category[]): any => {
    const date = row.date || row.transaction_date || row.txn_date || '';
    const description = row.description || row.narration || row.merchant || row.details || '';
    const amountRaw = row.amount ?? row.txn_amount ?? row.debit ?? row.credit ?? 0;
    const typeRaw = (row.type || row.txn_type || row.cr_dr || '').toLowerCase();

    const amount = parseAmount(amountRaw);
    let type: 'income' | 'expense' | 'transfer' = 'expense';

    if (isSelfTransfer(description)) {
      type = 'transfer';
    } else if (typeRaw.includes('credit') || typeRaw.includes('cr') || typeRaw.includes('received')) {
      type = 'income';
    } else if (typeRaw.includes('debit') || typeRaw.includes('dr') || typeRaw.includes('paid')) {
      type = 'expense';
    } else {
      if (amount > 0 && /salary|credit|received|refund|cashback/i.test(description)) type = 'income';
    }

    const category = getCategoryForTransaction(description, type, categories);

    // Determine account type from notes (e.g., credit card identifiers)
    const rawNotes = row.notes || row.note || '';
    const lowerNotes = rawNotes.toLowerCase();
    let accountType: 'cash' | 'bank_account' | 'credit_card' | 'savings' | 'investment' | 'other' = 'bank_account';
    if (lowerNotes.includes('credit card') || lowerNotes.includes('slice') || lowerNotes.includes('credit_card')) {
      accountType = 'credit_card';
    } else if (lowerNotes.includes('cash')) {
      accountType = 'cash';
    }

    return {
      date: date.split('T')[0],
      type,
      amount: Math.abs(amount),
      category,
      description: description.slice(0, 200),
      payment_method: 'upi',
      account: accountType,
      notes: rawNotes,
    };
  };

  const detectDuplicates = async (transactions: any[], supabase: any, userId: string) => {
    const fingerprints = transactions.map(t => generateTransactionFingerprint({
      userId,
      date: t.date,
      type: t.type,
      amount: t.amount,
      description: t.description,
      payment_method: t.payment_method,
      account: t.account,
    }));
    
    const { data: existing } = await supabase
      .from('transactions')
      .select('fingerprint')
      .eq('user_id', userId)
      .in('fingerprint', fingerprints);
    
    const existingFingerprints = new Set((existing ?? []).map((e: { fingerprint: string }) => e.fingerprint));
    return transactions.map((t, i) => ({ ...t, isDuplicate: existingFingerprints.has(fingerprints[i]) }));
  };

  const handlePhonePeFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhonepeFile(file);
    setPhonepeError('');
    setPhonepeMessage('');
    setPhonepePreview([]);
    setPhonepeSummary(null);

    const text = await file.text();
    let rows: any[] = [];
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

    // normalize
    const normalized = rows.map(r => normalizePhonePeRow(r, categories));
    
    // Deduplicate within the file first
    const uniqueNormalized = deduplicateTransactions(normalized);
    setPhonepeParsed(uniqueNormalized);

    // duplicate detection against database
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPhonepeError('Not logged in'); return; }
    const withDup = await detectDuplicates(uniqueNormalized, supabase, user.id);
    setPhonepePreview(withDup);

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const rowsToUpsert = phonepePreview
        .filter(t => !t.isDuplicate)
        .map(t => ({
          user_id: user.id,
          date: t.date,
          type: t.type,
          amount: Math.round(Number(t.amount) * 100) / 100,
          category: t.category,
          description: t.description,
          payment_method: t.payment_method,
          account: t.account,
          notes: t.notes || '',
        }));

      if (!rowsToUpsert.length) {
        setPhonepeMessage('Nothing new to import. All transactions already exist.');
        setPhonepeImporting(false);
        return;
      }

      const batchSize = 50;
      let insertedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < rowsToUpsert.length; i += batchSize) {
        const batch = rowsToUpsert.slice(i, i + batchSize);
        const { data: inserted, error } = await supabase
          .from('transactions')
          .upsert(batch, {
            onConflict: 'user_id,fingerprint',
            ignoreDuplicates: true,
          })
          .select('id');
        
        if (error) throw new Error(`Import failed: ${error.message}`);
        
        insertedCount += inserted?.length || 0;
        skippedCount += batch.length - (inserted?.length || 0);
      }

      setPhonepeMessage(`Successfully imported ${insertedCount} transactions. ${skippedCount} duplicates skipped.`);
      setPhonepeFile(null);
      setPhonepeParsed([]);
      setPhonepePreview([]);
      setPhonepeSummary(null);
      fetchData();
    } catch (err: any) {
      setPhonepeError(err.message || 'Import failed');
    } finally {
      setPhonepeImporting(false);
    }
  };

  const handlePhonePeCancel = () => {
    setPhonepeFile(null);
    setPhonepeParsed([]);
    setPhonepePreview([]);
    setPhonepeSummary(null);
    setPhonepeError('');
    setPhonepeMessage('');
  };

  // ---------- Generic JSON Import Helpers ----------
  const normalizeTransaction = (tx: any, categories: Category[], accounts: Account[]): any => {
    const type = (tx.type || 'expense').toLowerCase() as 'income' | 'expense' | 'transfer';
    const amount = Math.abs(Number(tx.amount) || 0);
    
    // Find matching category
    let category = tx.category || 'Other';
    const catExists = categories.find(c => c.name === category && c.type === (type === 'transfer' ? 'expense' : type));
    if (!catExists) {
      const defCat = categories.find(c => c.is_default && c.type === (type === 'transfer' ? 'expense' : type));
      category = defCat?.name || 'Other';
    }

    // Find matching account
    let account = tx.account || 'Cash';
    const accExists = accounts.find(a => a.name === account);
    if (!accExists && accounts.length > 0) {
      account = accounts[0].name;
    }

    return {
      date: (tx.date || '').split('T')[0],
      type,
      amount,
      category,
      description: (tx.description || tx.narration || '').slice(0, 200),
      payment_method: (tx.payment_method || tx.paymentMethod || 'cash').toLowerCase(),
      account,
      notes: tx.notes || '',
    };
  };

  const detectImportDuplicates = async (transactions: any[], supabase: any, userId: string) => {
    const fingerprints = transactions.map(t => generateTransactionFingerprint({
      userId,
      date: t.date,
      type: t.type,
      amount: t.amount,
      description: t.description,
      payment_method: t.payment_method,
      account: t.account,
    }));
    
    const { data: existing } = await supabase
      .from('transactions')
      .select('fingerprint')
      .eq('user_id', userId)
      .in('fingerprint', fingerprints);
    
    const existingFingerprints = new Set((existing ?? []).map((e: { fingerprint: string }) => e.fingerprint));
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
      let data: any;
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

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setImportError('Not logged in'); return; }

      // Determine if it's a full backup or transaction-only
      const isFullBackup = data.transactions !== undefined || data.categories !== undefined || data.accounts !== undefined;
      
      let transactions: any[] = [];
      
      if (isFullBackup) {
        // Full backup format
        transactions = Array.isArray(data.transactions) ? data.transactions : [];
      } else if (Array.isArray(data)) {
        // Transaction-only array format
        transactions = data;
      } else {
        setImportError('Unsupported JSON format. Expected a full backup object or an array of transactions.');
        return;
      }

      if (transactions.length === 0) {
        setImportError('No transactions found in the selected file.');
        return;
      }

      setImportParsed(data);

      // Normalize transactions
      const normalized = transactions.map(t => normalizeTransaction(t, categories, accounts));
      
      // Deduplicate within the file first
      const uniqueNormalized = deduplicateTransactions(normalized);
      setImportPreview(uniqueNormalized);

      // Detect duplicates against database
      const withDup = await detectImportDuplicates(uniqueNormalized, supabase, user.id);
      setImportPreview(withDup);

      // Calculate summary
      const total = withDup.length;
      const income = withDup.filter(t => t.type === 'income').length;
      const expense = withDup.filter(t => t.type === 'expense').length;
      const transfers = withDup.filter(t => t.type === 'transfer').length;
      const duplicates = withDup.filter(t => t.isDuplicate).length;
      const newTx = total - duplicates;
      
      setImportSummary({ total, income, expense, transfers, duplicates, newTx });

    } catch (err: any) {
      setImportError(err.message || 'Failed to process file');
    }
  };

  const handleImportConfirm = async () => {
    if (!importPreview.length) return;
    setImporting(true);
    setImportError('');
    setImportMessage('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      // If full backup, import categories, accounts, budgets, recurring first
      if (importParsed && (importParsed.categories || importParsed.accounts || importParsed.budgets || importParsed.recurring_transactions)) {
        // Import categories
        if (importParsed.categories?.length) {
          const catRows = importParsed.categories.map((c: any) => ({
            ...c,
            user_id: user.id,
            id: undefined,
            created_at: undefined,
          }));
          const { error } = await supabase.from('categories').upsert(catRows, {
            onConflict: 'user_id,name,type',
            ignoreDuplicates: true,
          });
          if (error) throw new Error(`Categories import failed: ${error.message}`);
        }

        // Import accounts
        if (importParsed.accounts?.length) {
          const accRows = importParsed.accounts.map((a: any) => ({
            ...a,
            user_id: user.id,
            id: undefined,
            created_at: undefined,
            updated_at: undefined,
          }));
          const { error } = await supabase.from('accounts').upsert(accRows, {
            onConflict: 'user_id,name',
            ignoreDuplicates: true,
          });
          if (error) throw new Error(`Accounts import failed: ${error.message}`);
        }

        // Import budgets
        if (importParsed.budgets?.length) {
          const budRows = importParsed.budgets.map((b: any) => ({
            ...b,
            user_id: user.id,
            id: undefined,
            created_at: undefined,
            updated_at: undefined,
          }));
          const { error } = await supabase.from('budgets').upsert(budRows, {
            onConflict: 'user_id,category_id,month',
            ignoreDuplicates: true,
          });
          if (error) throw new Error(`Budgets import failed: ${error.message}`);
        }

        // Import recurring transactions
        if (importParsed.recurring_transactions?.length) {
          const recRows = importParsed.recurring_transactions.map((r: any) => ({
            ...r,
            user_id: user.id,
            id: undefined,
            created_at: undefined,
            updated_at: undefined,
          }));
          const { error } = await supabase.from('recurring_transactions').upsert(recRows, {
            onConflict: 'user_id,id',
            ignoreDuplicates: true,
          });
          if (error) throw new Error(`Recurring transactions import failed: ${error.message}`);
        }
      }

      // Import new transactions only
      const rowsToUpsert = importPreview
        .filter(t => !t.isDuplicate)
        .map(t => ({
          user_id: user.id,
          date: t.date,
          type: t.type,
          amount: Math.round(Number(t.amount) * 100) / 100,
          category: t.category,
          description: t.description,
          payment_method: t.payment_method,
          account: t.account,
          notes: t.notes || '',
        }));

      if (!rowsToUpsert.length) {
        setImportMessage('Nothing new to import. All transactions already exist.');
        setImporting(false);
        return;
      }

      const batchSize = 50;
      let insertedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < rowsToUpsert.length; i += batchSize) {
        const batch = rowsToUpsert.slice(i, i + batchSize);
        const { data: inserted, error } = await supabase
          .from('transactions')
          .upsert(batch, {
            onConflict: 'user_id,fingerprint',
            ignoreDuplicates: true,
          })
          .select('id');
        
        if (error) throw new Error(`Import failed: ${error.message}`);
        
        insertedCount += inserted?.length || 0;
        skippedCount += batch.length - (inserted?.length || 0);
      }

      setImportMessage(`Successfully imported ${insertedCount} transactions. ${skippedCount} duplicates skipped.`);
      setImportFile(null);
      setImportParsed(null);
      setImportPreview([]);
      setImportSummary(null);
      fetchData();
    } catch (err: any) {
      setImportError(err.message || 'Import failed');
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
              {accounts.map(acc => (
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
                      <p className="font-medium">{acc.name}</p>
                      <p className="text-sm text-muted-foreground capitalize">{acc.type.replace('_', ' ')} · {formatCurrency(acc.opening_balance)} {acc.currency}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => { setEditingAccount(acc); accountForm.reset({ name: acc.name, type: acc.type, opening_balance: acc.opening_balance, currency: acc.currency }); setAccountDialogOpen(true); }}>
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
                          <AlertDialogTitle>Delete account</AlertDialogTitle>
                          <AlertDialogDescription>Are you sure you want to delete this account?</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogAction onClick={() => handleDeleteAccount(acc)}>Delete</AlertDialogAction>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
              {accounts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No accounts added yet. Add your first account to get started.
                </div>
              )}
            </CardContent>
          </Card>

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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Import Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">Import data from a previously exported JSON file or a transaction-only JSON array.</p>
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