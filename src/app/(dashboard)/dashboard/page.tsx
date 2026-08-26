'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp, TrendingDown, Minus, Wallet, ArrowUpRight, ArrowDownRight, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency, formatCurrencyCompact } from '@/utils/currency';
import { cn } from '@/utils/currency';
import { getMonthKey, formatMonthYear, getCurrentMonthStart, parseMonthKey } from '@/utils/date';
import { createClient } from '@/lib/supabase/client';
import { Transaction, Category, Budget, Account } from '@/types';
import { CalculationEngine } from '@/lib/calculation-engine';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';
import { CategoryBreakdown } from '@/components/dashboard/category-breakdown';
import { MonthlyOverview } from '@/components/dashboard/monthly-overview';

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(getMonthKey(getCurrentMonthStart()));

  const router = useRouter();
  const supabase = createClient();
  const engine = new CalculationEngine({ transactions, categories, budgets, accounts });

  const previousMonthKey = getMonthKey(new Date(parseMonthKey(currentMonth).getFullYear(), parseMonthKey(currentMonth).getMonth() - 1));
  const nextMonthKey = getMonthKey(new Date(parseMonthKey(currentMonth).getFullYear(), parseMonthKey(currentMonth).getMonth() + 1));

  const handlePreviousMonth = () => setCurrentMonth(previousMonthKey);
  const handleNextMonth = () => setCurrentMonth(nextMonthKey);
  const handleCurrentMonth = () => setCurrentMonth(getMonthKey(new Date()));

  useEffect(() => {
    fetchData();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchData();
    });

    const handleTransactionsUpdated = () => {
      fetchData();
    };
    window.addEventListener('transactions-updated', handleTransactionsUpdated);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('transactions-updated', handleTransactionsUpdated);
    };
  }, [currentMonth]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [txRes, catRes, budRes, accRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }),
        supabase.from('categories').select('*').eq('user_id', user.id),
        supabase.from('budgets').select('*').eq('user_id', user.id),
        supabase.from('accounts').select('*').eq('user_id', user.id),
      ]);

      if (txRes.data) setTransactions(txRes.data);
      if (catRes.data) setCategories(catRes.data);
      if (budRes.data) setBudgets(budRes.data);
      if (accRes.data) setAccounts(accRes.data);
    } catch (err) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const metrics = engine.getDashboardMetrics(currentMonth);
  const monthOverMonth = engine.calculateMonthOverMonthChange(currentMonth);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {formatMonthYear(parseMonthKey(currentMonth))} overview
          </p>
        </div>
<div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePreviousMonth} disabled={loading}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={handleCurrentMonth} disabled={loading}>
              Current Month
            </Button>
            <Button variant="outline" size="sm" onClick={handleNextMonth} disabled={loading}>
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
            <Button onClick={() => router.push('/add-transaction')}>
              <Plus className="mr-2 h-4 w-4" />
              Add Transaction
            </Button>
          </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Balance"
          value={formatCurrency(metrics.current_balance)}
          icon={Wallet}
          trend={metrics.total_savings >= 0 ? 'up' : 'down'}
          trendValue={formatCurrency(Math.abs(metrics.total_savings))}
        />
        <MetricCard
          title="Total Income"
          value={formatCurrency(metrics.total_income)}
          icon={ArrowUpRight}
          iconClass="text-green-500"
          trend="up"
          trendValue={formatCurrency(metrics.monthly_income)}
        />
        <MetricCard
          title="Total Expenses"
          value={formatCurrency(metrics.total_expenses)}
          icon={ArrowDownRight}
          iconClass="text-red-500"
          trend="down"
          trendValue={formatCurrency(metrics.monthly_expenses)}
        />
        <MetricCard
          title="Savings Rate"
          value={`${metrics.savings_rate.toFixed(1)}%`}
          icon={TrendingUp}
          iconClass="text-blue-500"
          trend={metrics.savings_rate >= 20 ? 'up' : 'down'}
          trendValue={`${Math.abs(metrics.monthly_savings_rate - metrics.savings_rate).toFixed(1)}%`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <MonthlyOverview 
          currentMonth={engine.calculateMonthlySummary(currentMonth)}
          previousMonth={engine.calculateMonthlySummary(getMonthKey(new Date(parseMonthKey(currentMonth).getFullYear(), parseMonthKey(currentMonth).getMonth() - 1)))}
        />
        <CategoryBreakdown 
          data={engine.getChartDataForCategorySpending(currentMonth)}
          title="Spending by Category"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardCharts 
          monthlyData={engine.getChartDataForMonthlyTrend(12)}
          savingsData={engine.getChartDataForSavingsTrend(12)}
        />
        <RecentTransactions 
          transactions={transactions.slice(0, 10)}
          onViewAll={() => router.push('/transactions')}
        />
      </div>
    </div>
  );
}

function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendValue,
  iconClass = "text-primary"
}: { 
  title: string; 
  value: string; 
  icon: React.ComponentType<{ className?: string }>; 
  trend: 'up' | 'down';
  trendValue: string;
  iconClass?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn("h-4 w-4", iconClass)} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className={cn("text-xs", trend === 'up' ? "text-green-500" : "text-red-500")}>
          {trend === 'up' ? '↑' : '↓'} {trendValue} vs last period
        </p>
      </CardContent>
    </Card>
  );
}