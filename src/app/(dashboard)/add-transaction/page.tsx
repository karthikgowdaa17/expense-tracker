'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';
import { TransactionType, PaymentMethod, AccountType, Category } from '@/types';
import { Plus, Loader2, ArrowLeft, Sparkles } from 'lucide-react';
import { cn } from '@/utils/currency';
import { useForm } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { categoriesApi } from '@/lib/api/categories';
import { transactionsApi } from '@/lib/api/transactions';
import { accountsApi } from '@/lib/api/accounts';
import { formatAccountLabel } from '@/utils/accounts';
import type { Account } from '@/types';
import { suggestCategory } from '@/utils/categorySuggestion';

const transactionSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer', 'refund']),
  date: z.string().min(1, 'Date is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  payment_method: z.enum(['cash', 'upi', 'credit_card', 'debit_card', 'bank_transfer', 'other']),
  account: z.string().min(1, 'Account is required'),
  to_account: z.string().optional(),
  notes: z.string().optional(),
}).refine(
  (data) => data.type !== 'transfer' || (!!data.to_account && data.to_account !== data.account),
  {
    message: 'Destination account is required for transfers',
    path: ['to_account'],
  }
);

type TransactionFormData = z.infer<typeof transactionSchema>;

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
];

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_account', label: 'Bank Account' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'savings', label: 'Savings' },
  { value: 'investment', label: 'Investment' },
  { value: 'other', label: 'Other' },
];

const TRANSACTION_TYPES: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'refund', label: 'Refund' },
];

export default function AddTransactionPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();
  const { user } = useAuth();

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: 'expense',
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      category: '',
      subcategory: '',
      description: '',
      payment_method: 'upi',
      account: 'bank_account',
      to_account: '',
      notes: '',
    },
  });

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        if (!user) return;
        const [data, accData] = await Promise.all([categoriesApi.list(), accountsApi.list()]);
        if (!ignore) {
          setCategories(data);
          setAccounts(accData);
          const current = form.getValues('account');
          if ((!current || current === 'bank_account') && accData.length > 0) {
            const preferred = accData.find(a => a.name === 'Bank Account') || accData[0];
            form.setValue('account', preferred.id);
          }
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    })();
    return () => { ignore = true; };
  }, []);

  const filteredCategories = categories.filter(c => c.type === form.watch('type'));
  const [suggestedCategory, setSuggestedCategory] = useState<Category | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);

  const updateSuggestion = useCallback(() => {
    const description = form.watch('description');
    const type = form.watch('type') as TransactionType;
    const userSelectedCategory = form.watch('category');
    
    if (!description || userSelectedCategory) {
      setSuggestedCategory(null);
      setShowSuggestion(false);
      return;
    }
    
    const suggested = suggestCategory(description, categories, type);
    setSuggestedCategory(suggested);
    setShowSuggestion(!!suggested);
  }, [categories]);

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'description' || name === 'type') {
        updateSuggestion();
      }
    });
    return () => subscription.unsubscribe();
  }, [updateSuggestion]);

  useEffect(() => {
    (async () => {
      const description = form.watch('description');
      const type = form.watch('type') as TransactionType;
      const userSelectedCategory = form.watch('category');

      if (!description || userSelectedCategory) {
        setSuggestedCategory(null);
        setShowSuggestion(false);
        return;
      }

      const suggested = suggestCategory(description, categories, type);
      setSuggestedCategory(suggested);
      setShowSuggestion(!!suggested);
    })();
  }, [categories]);

  const applySuggestion = () => {
    if (suggestedCategory) {
      form.setValue('category', suggestedCategory.name);
      setSuggestedCategory(null);
      setShowSuggestion(false);
    }
  };

  const onSubmit = async (data: TransactionFormData) => {
    try {
      setSubmitting(true);
      if (!user) return;

      const selectedAccount = accounts.find(a => a.id === data.account);
      const destAccount =
        data.type === 'transfer' ? accounts.find(a => a.id === data.to_account) : null;

      await transactionsApi.create({
        ...data,
        account: selectedAccount ? formatAccountLabel(selectedAccount) : data.account,
        account_id: selectedAccount ? selectedAccount.id : null,
        ...(data.type === 'transfer' && destAccount ? { to_account: destAccount.name } : {}),
      });

      router.push('/transactions');
      router.refresh();
    } catch (err) {
      console.error('Failed to add transaction:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Add Transaction</h1>
          <p className="text-muted-foreground">Record a new income or expense</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  onValueChange={(value) => {
                    const t = value as TransactionType;
                    form.setValue('type', t);
                    if (t !== 'transfer') form.setValue('to_account', '');
                  }}
                  defaultValue={form.getValues('type')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSACTION_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.type && (
                  <p className="text-sm text-destructive">{form.formState.errors.type.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  {...form.register('date', { valueAsDate: false })}
                  max={new Date().toISOString().split('T')[0]}
                />
                {form.formState.errors.date && (
                  <p className="text-sm text-destructive">{form.formState.errors.date.message}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Amount (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  {...form.register('amount', { valueAsNumber: true })}
                />
                {form.formState.errors.amount && (
                  <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select onValueChange={(value) => form.setValue('category', value)} defaultValue={form.getValues('category')}>
                  <SelectTrigger disabled={filteredCategories.length === 0}>
                    <SelectValue placeholder={filteredCategories.length === 0 ? 'Add categories in Settings' : 'Select category'} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map(c => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.category && (
                  <p className="text-sm text-destructive">{form.formState.errors.category.message}</p>
                )}
                {showSuggestion && suggestedCategory && (
                  <div className="flex items-center gap-2 mt-2 p-2 bg-primary/10 rounded-lg text-sm">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-primary font-medium">Suggested: {suggestedCategory.name}</span>
                    <Button type="button" variant="link" size="sm" onClick={applySuggestion} className="p-0 h-auto">
                      Apply
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Subcategory (Optional)</Label>
                <Input
                  placeholder="e.g., Groceries, Dining Out"
                  {...form.register('subcategory')}
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="What was this for?"
                  {...form.register('description')}
                />
                {form.formState.errors.description && (
                  <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select onValueChange={(value) => form.setValue('payment_method', value as PaymentMethod)} defaultValue={form.getValues('payment_method')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Account</Label>
                <Select onValueChange={(value) => form.setValue('account', value)} value={form.watch('account') || undefined}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>{formatAccountLabel(a)}</SelectItem>
                    ))}
                    {accounts.length === 0 && ACCOUNT_TYPES.map(a => (
                      <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.watch('type') === 'transfer' && (
              <div className="space-y-2">
                <Label>Destination Account</Label>
                <Select
                  onValueChange={(value) => form.setValue('to_account', value)}
                  defaultValue={form.getValues('to_account')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => (
                      <SelectItem
                        key={a.id}
                        value={a.id}
                        disabled={a.id === form.getValues('account')}
                      >
                        {formatAccountLabel(a)}
                      </SelectItem>
                    ))}
                    {accounts.length === 0 && (
                      <SelectItem disabled value="">
                        No accounts available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {form.formState.errors.to_account && (
                  <p className="text-sm text-destructive">{form.formState.errors.to_account.message}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Any additional details..."
                {...form.register('notes')}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-end gap-4 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Plus className="mr-2 h-4 w-4" />
                Save Transaction
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}