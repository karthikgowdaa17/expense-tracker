'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { formatCurrency } from '@/utils/currency';
import { formatDisplayDate } from '@/utils/date';
import { createClient } from '@/lib/supabase/client';
import { RecurringTransaction, Frequency, PaymentMethod, AccountType } from '@/types';
import { Plus, Loader2, Edit, Trash2, Calendar, AlertTriangle } from 'lucide-react';
import { cn } from '@/utils/currency';
import { useForm } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';

const recurringSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  category: z.string().min(1, 'Category is required'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom']),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(),
  payment_method: z.enum(['cash', 'upi', 'credit_card', 'debit_card', 'bank_transfer', 'other']),
  account: z.string().min(1, 'Account is required'),
  description: z.string().optional(),
  day_of_month: z.number().optional(),
});

type RecurringFormData = z.infer<typeof recurringSchema>;

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom' },
];

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

export default function RecurringPage() {
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | null>(null);

  const supabase = createClient();

  const form = useForm<RecurringFormData>({
    resolver: zodResolver(recurringSchema),
    defaultValues: {
      name: '',
      amount: 0,
      category: '',
      frequency: 'monthly',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      payment_method: 'upi',
      account: 'bank_account',
      description: '',
      day_of_month: new Date().getDate(),
    },
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [recRes, catRes] = await Promise.all([
        supabase.from('recurring_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('categories').select('name').eq('user_id', user.id).eq('type', 'expense'),
      ]);

      if (recRes.data) setRecurring(recRes.data);
      if (catRes.data) setCategories(catRes.data.map(c => c.name));
    } catch (err) {
      console.error('Failed to load recurring transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = (rec?: RecurringTransaction) => {
    if (rec) {
      setEditingRecurring(rec);
      form.reset({
        name: rec.name,
        amount: rec.amount,
        category: rec.category,
        frequency: rec.frequency,
        start_date: rec.start_date,
        end_date: rec.end_date || '',
        payment_method: rec.payment_method,
        account: rec.account,
        description: rec.description || '',
        day_of_month: rec.day_of_month,
      });
    } else {
      setEditingRecurring(null);
      form.reset({
        name: '',
        amount: 0,
        category: '',
        frequency: 'monthly',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        payment_method: 'upi',
        account: 'bank_account',
        description: '',
        day_of_month: new Date().getDate(),
      });
    }
    setDialogOpen(true);
  };

  const onSubmit = async (data: RecurringFormData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const payload = { ...data, user_id: user.id, is_active: true };

      if (editingRecurring) {
        const { error } = await supabase.from('recurring_transactions').update(payload).eq('id', editingRecurring.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('recurring_transactions').insert(payload);
        if (error) throw error;
      }

      setDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error('Failed to save recurring transaction:', err);
    }
  };

  const handleDelete = async (rec: RecurringTransaction) => {
    try {
      const { error } = await supabase.from('recurring_transactions').delete().eq('id', rec.id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error('Failed to delete recurring transaction:', err);
    }
  };

  const handleToggleActive = async (rec: RecurringTransaction) => {
    try {
      const { error } = await supabase
        .from('recurring_transactions')
        .update({ is_active: !rec.is_active })
        .eq('id', rec.id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error('Failed to toggle recurring transaction:', err);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const upcomingThisMonth = recurring.filter(r => r.is_active).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recurring Expenses</h1>
          <p className="text-muted-foreground">Manage recurring transactions and subscriptions</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Recurring
        </Button>
      </div>

      {upcomingThisMonth.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Upcoming This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingThisMonth.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">{r.name}</p>
                      <p className="text-sm text-muted-foreground">{r.category} · {r.frequency} · {formatCurrency(r.amount)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('px-2 py-1 rounded-full text-xs', r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700')}>
                      {r.is_active ? 'Active' : 'Paused'}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => handleToggleActive(r)}>
                      {r.is_active ? '⏸' : '▶️'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Recurring Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {recurring.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No recurring transactions yet. Add your first recurring expense or subscription.
            </div>
          ) : (
            <div className="space-y-3">
              {recurring.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: r.is_active ? '#3B82F6' : '#9CA3AF' }}>
                      <Calendar className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {r.category} · {r.frequency} · {formatCurrency(r.amount)} · {r.payment_method} · {r.account}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Starts: {formatDisplayDate(r.start_date)} {r.end_date ? `· Ends: ${formatDisplayDate(r.end_date)}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('px-3 py-1 rounded-full text-xs font-medium', r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700')}>
                      {r.is_active ? 'Active' : 'Paused'}
                    </span>
                    <Button variant="outline" size="icon" onClick={() => handleOpenDialog(r)}>
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
                          <AlertDialogTitle>Delete recurring transaction</AlertDialogTitle>
                          <AlertDialogDescription>Are you sure you want to delete this recurring transaction?</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogAction onClick={() => handleDelete(r)}>Delete</AlertDialogAction>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRecurring ? 'Edit Recurring' : 'Add Recurring Transaction'}</DialogTitle>
            <DialogDescription>Set up a recurring expense or subscription</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input placeholder="e.g., Rent, Netflix, EMI" {...form.register('name')} />
            </div>
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input type="number" step="0.01" min="0.01" {...form.register('amount', { valueAsNumber: true })} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select onValueChange={(value) => form.setValue('category', value)} defaultValue={form.getValues('category')}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select onValueChange={(value) => form.setValue('frequency', value as Frequency)} defaultValue={form.getValues('frequency')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Day of Month</Label>
                <Input type="number" min="1" max="31" {...form.register('day_of_month', { valueAsNumber: true })} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" {...form.register('start_date')} />
              </div>
              <div className="space-y-2">
                <Label>End Date (Optional)</Label>
                <Input type="date" {...form.register('end_date')} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select onValueChange={(value) => form.setValue('payment_method', value as PaymentMethod)} defaultValue={form.getValues('payment_method')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Account</Label>
                <Select onValueChange={(value) => form.setValue('account', value)} defaultValue={form.getValues('account')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Input {...form.register('description')} placeholder="Additional details" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">{editingRecurring ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}