'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { formatCurrency, calculatePercentage } from '@/utils/currency';
import { createClient } from '@/lib/supabase/client';
import { Budget, Category } from '@/types';
import { Plus, Loader2, Edit, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/utils/currency';
import { useForm } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { getMonthKey, formatMonthYear, parseMonthKey, getCurrentMonthStart, getMonthRange } from '@/utils/date';

const budgetSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  amount: z.number().min(1, 'Budget must be greater than 0'),
  month: z.string().min(1, 'Month is required'),
  notes: z.string().optional(),
});

type BudgetFormData = z.infer<typeof budgetSchema>;

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentMonth, setCurrentMonth] = useState(getMonthKey(getCurrentMonthStart()));
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  const supabase = createClient();

  const form = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      category: '',
      amount: 0,
      month: currentMonth,
      notes: '',
    },
  });

  useEffect(() => {
    fetchData();
  }, [currentMonth]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [budRes, catRes] = await Promise.all([
        supabase.from('budgets').select('*').eq('user_id', user.id).eq('month', currentMonth),
        supabase.from('categories').select('*').eq('user_id', user.id).eq('type', 'expense'),
      ]);

      if (budRes.data) setBudgets(budRes.data);
      if (catRes.data) setCategories(catRes.data);
    } catch (err) {
      console.error('Failed to load budgets:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSpendingForCategory = async (category: string): Promise<number> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { start, end } = getMonthRange(parseMonthKey(currentMonth));
    const { data } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .eq('category', category)
      .gte('date', start.toISOString().split('T')[0])
      .lte('date', end.toISOString().split('T')[0]);

    return data?.reduce((sum, t) => sum + t.amount, 0) || 0;
  };

  const handleOpenDialog = (budget?: Budget) => {
    if (budget) {
      setEditingBudget(budget);
      form.reset({
        category: budget.category_id,
        amount: budget.amount,
        month: budget.month,
        notes: budget.notes || '',
      });
    } else {
      setEditingBudget(null);
      form.reset({
        category: '',
        amount: 0,
        month: currentMonth,
        notes: '',
      });
    }
    setDialogOpen(true);
  };

  const onSubmit = async (data: BudgetFormData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (editingBudget) {
        const { error } = await supabase
          .from('budgets')
          .update({ amount: data.amount, notes: data.notes })
          .eq('id', editingBudget.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('budgets')
          .insert({ ...data, user_id: user.id });
        if (error) throw error;
      }

      setDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error('Failed to save budget:', err);
    }
  };

  const handleDelete = async (budget: Budget) => {
    try {
      const { error } = await supabase.from('budgets').delete().eq('id', budget.id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error('Failed to delete budget:', err);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Budgets</h1>
          <p className="text-muted-foreground">Set and track budgets for {formatMonthYear(parseMonthKey(currentMonth))}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={currentMonth} onValueChange={setCurrentMonth}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => {
                const date = new Date(2026, i, 1);
                return <SelectItem key={getMonthKey(date)} value={getMonthKey(date)}>{formatMonthYear(date)}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Budget
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {categories.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No expense categories found. Add categories in Settings.
            </div>
          ) : (
            <div className="divide-y">
              {categories.map((cat) => {
                const budget = budgets.find(b => b.category_id === cat.id);
                const budgetAmount = budget?.amount || 0;
                
                return (
                  <div key={cat.id} className="p-4 flex items-center justify-between gap-4" style={{ backgroundColor: cat.color ? `${cat.color}10` : 'transparent' }}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: cat.color || '#9CA3AF' }}>
                        {cat.icon || '📁'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{cat.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {budgetAmount > 0 
                            ? `Budget: ${formatCurrency(budgetAmount)}`
                            : 'No budget set'}
                        </p>
                      </div>
                    </div>
                    
                    {budgetAmount > 0 && (
                      <div className="w-48">
                        <Progress value={0} className="h-2 mb-1" />
                        <p className="text-xs text-muted-foreground text-right">Loading...</p>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" onClick={() => handleOpenDialog(budget!)}>
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
                            <AlertDialogTitle>Delete budget</AlertDialogTitle>
                            <AlertDialogDescription>Are you sure you want to delete this budget?</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogAction onClick={() => handleDelete(budget!)}>Delete</AlertDialogAction>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBudget ? 'Edit Budget' : 'Add Budget'}</DialogTitle>
            <DialogDescription>Set a monthly budget for a category</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select onValueChange={(value) => form.setValue('category', value)} defaultValue={form.getValues('category')}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input type="number" step="0.01" min="1" {...form.register('amount', { valueAsNumber: true })} />
            </div>
            <div className="space-y-2">
              <Label>Month</Label>
              <Select onValueChange={(value) => form.setValue('month', value)} defaultValue={form.getValues('month')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => {
                    const date = new Date(2026, i, 1);
                    return <SelectItem key={getMonthKey(date)} value={getMonthKey(date)}>{formatMonthYear(date)}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Input {...form.register('notes')} placeholder="Any notes about this budget" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">{editingBudget ? 'Update' : 'Create'} Budget</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}