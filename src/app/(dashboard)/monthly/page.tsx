'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatCurrency, calculatePercentage } from '@/utils/currency';
import { useAuth } from '@/lib/auth-context';
import { MonthlySummary, CategoryBreakdown, Budget } from '@/types';
import { ChevronLeft, ChevronRight, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/utils/currency';
import { getMonthKey, formatMonthYear, parseMonthKey, getMonthRange, getPreviousMonth, getNextMonth } from '@/utils/date';
import { CalculationEngine } from '@/lib/calculation-engine';
import { transactionsApi } from '@/lib/api/transactions';
import { budgetsApi } from '@/lib/api/budgets';
import { categoriesApi } from '@/lib/api/categories';

export default function MonthlyPage() {
  const [currentMonth, setCurrentMonth] = useState(getMonthKey(new Date()));
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();
  const engine = new CalculationEngine({ budgets });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      if (!user) return;

      const { start, end } = getMonthRange(parseMonthKey(currentMonth));
      
      const [txRes, budRes, catRes] = await Promise.all([
        transactionsApi.list({
          dateFrom: start.toISOString().split('T')[0],
          dateTo: end.toISOString().split('T')[0],
        }),
        budgetsApi.list(currentMonth),
        categoriesApi.list(),
      ]);

      if (txRes) {
        const transactions = txRes;
        const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        
        const categorySpending: Record<string, number> = {};
        transactions.filter(t => t.type === 'expense').forEach(t => {
          categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
        });

        const expenseCategories = catRes.filter(c => c.type === 'expense');
        const categoryBreakdown: CategoryBreakdown[] = Object.entries(categorySpending).map(([category, actual]) => {
          const budget = budRes.find(b => {
            const cat = expenseCategories.find(c => c.id === b.category_id);
            return cat && cat.name === category;
          });
          const budgetAmount = budget?.amount || 0;
          return {
            category,
            budget: budgetAmount,
            actual,
            remaining: budgetAmount - actual,
            percentage: budgetAmount > 0 ? calculatePercentage(actual, budgetAmount) : 0,
            is_over_budget: actual > budgetAmount && budgetAmount > 0,
          };
        });

        setSummary({
          month: formatMonthYear(parseMonthKey(currentMonth)),
          year: parseMonthKey(currentMonth).getFullYear(),
          income,
          expenses,
          savings: income - expenses,
          savings_rate: income > 0 ? calculatePercentage(income - expenses, income) : 0,
          category_breakdown: categoryBreakdown,
        });
      }

      setBudgets(budRes);
      setCategories(catRes.filter(c => c.type === 'expense').map(c => c.name));
    } catch (err) {
      console.error('Failed to load monthly data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePreviousMonth = () => setCurrentMonth(prev => getMonthKey(getPreviousMonth(parseMonthKey(prev))));
  const handleNextMonth = () => setCurrentMonth(prev => getMonthKey(getNextMonth(parseMonthKey(prev))));

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monthly Expenses</h1>
          <p className="text-muted-foreground">Budget vs actual spending for {formatMonthYear(parseMonthKey(currentMonth))}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePreviousMonth}><ChevronLeft className="mr-1 h-4 w-4" /> Previous</Button>
          <Button variant="outline" onClick={handleNextMonth}>Next <ChevronRight className="ml-1 h-4 w-4" /></Button>
        </div>
      </div>

      {summary && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Income</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.income)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{formatCurrency(summary.expenses)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Savings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(summary.savings)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Savings Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.savings_rate.toFixed(1)}%</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Category Budget vs Actual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {summary.category_breakdown.map((cat) => (
                  <div key={cat.category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn('h-3 w-3 rounded-full', cat.is_over_budget ? 'bg-red-500' : 'bg-green-500')} />
                        <span className="font-medium">{cat.category}</span>
                        {cat.is_over_budget && <AlertTriangle className="h-4 w-4 text-red-500" />}
                        {!cat.is_over_budget && cat.budget > 0 && <CheckCircle className="h-4 w-4 text-green-500" />}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(cat.actual)} / {formatCurrency(cat.budget)}</p>
                        <p className="text-sm text-muted-foreground">{cat.percentage.toFixed(1)}% used</p>
                      </div>
                    </div>
                    {cat.budget > 0 && (
                      <Progress value={Math.min(cat.percentage, 100)} className="h-2" />
                    )}
                    <p className="text-sm text-right">
                      {cat.is_over_budget 
                        ? `Over budget by ${formatCurrency(Math.abs(cat.remaining))}` 
                        : cat.budget > 0 
                          ? `${formatCurrency(cat.remaining)} remaining` 
                          : 'No budget set'}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}