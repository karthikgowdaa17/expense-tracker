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
import { Category, Account, PaymentMethod, AccountType, UserSettings, Profile } from '@/types';
import { Plus, Loader2, Edit, Trash2, Download, Upload, Trash, AlertTriangle, Save } from 'lucide-react';
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

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Import categories
        if (data.categories?.length) {
          const catRows = data.categories.map((c: any) => ({
            ...c,
            user_id: user.id,
            id: undefined, // let DB generate
            created_at: undefined,
          }));
          const { error } = await supabase.from('categories').upsert(catRows, {
            onConflict: 'user_id,name,type',
            ignoreDuplicates: true,
          });
          if (error) throw new Error(`Categories import failed: ${error.message}`);
        }

        // Import accounts
        if (data.accounts?.length) {
          const accRows = data.accounts.map((a: any) => ({
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
        if (data.budgets?.length) {
          const budRows = data.budgets.map((b: any) => ({
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
        if (data.recurring_transactions?.length) {
          const recRows = data.recurring_transactions.map((r: any) => ({
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
          if (error) throw new Error(`Recurring import failed: ${error.message}`);
        }

        // Import transactions (check duplicates)
        if (data.transactions?.length) {
          // fetch existing to avoid duplicates
          const dates = data.transactions.map((t: any) => t.date).sort();
          const minDate = dates[0];
          const maxDate = dates[dates.length - 1];
          const { data: existing, error: existingError } = await supabase
            .from('transactions')
            .select('date,type,amount,category,description,payment_method,account,notes')
            .eq('user_id', user.id)
            .gte('date', minDate)
            .lte('date', maxDate);

          if (existingError) throw new Error(`Could not check existing transactions: ${existingError.message}`);

          const keyOf = (t: any) =>
            [t.date, t.type, Number(t.amount).toFixed(2), t.category, t.description, t.payment_method, t.account, t.notes ?? ''].join('|');
          const existingKeys = new Set((existing ?? []).map(keyOf));

          const newRows = data.transactions
            .filter((t: any) => !existingKeys.has(keyOf(t)))
            .map((t: any) => ({
              ...t,
              user_id: user.id,
              id: undefined,
              created_at: undefined,
              updated_at: undefined,
              amount: Math.round(Number(t.amount) * 100) / 100,
            }));

          if (newRows.length) {
            const batchSize = 50;
            for (let i = 0; i < newRows.length; i += batchSize) {
              const batch = newRows.slice(i, i + batchSize);
              const { error } = await supabase.from('transactions').insert(batch);
              if (error) throw new Error(`Transactions import failed: ${error.message}`);
            }
          }

          alert(`Import completed. ${newRows.length} new transactions added.`);
        } else {
          alert('Import completed.');
        }
        // refresh UI
        fetchData();
      } catch (err) {
        console.error('Failed to import data:', err);
        alert(err instanceof Error ? err.message : 'Import failed');
      }
    };
    reader.readAsText(file);
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
              <p className="text-muted-foreground">Import data from a previously exported JSON file.</p>
              <Input type="file" accept=".json" onChange={handleImportData} />
              <p className="text-xs text-muted-foreground">This will merge with existing data. Duplicates may occur.</p>
            </CardContent>
          </Card>

          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">Irreversible actions. Please be careful.</p>
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}