'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Loader2, ChevronLeft, ChevronRight, Repeat } from 'lucide-react';
import { formatCurrency, formatCurrencyCompact } from '@/utils/currency';
import { cn } from '@/utils/currency';
import { getMonthKey, formatMonthYear, getCurrentMonthStart, parseMonthKey } from '@/utils/date';
import { useAuth } from '@/lib/auth-context';
import { Transaction, Category, Budget, Account } from '@/types';
import { CalculationEngine } from '@/lib/calculation-engine';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';
import { CategoryBreakdown } from '@/components/dashboard/category-breakdown';
import { MonthlyOverview } from '@/components/dashboard/monthly-overview';
import { transactionsApi } from '@/lib/api/transactions';
import { categoriesApi } from '@/lib/api/categories';
import { budgetsApi } from '@/lib/api/budgets';
import { accountsApi } from '@/lib/api/accounts';
import { formatAccountLabel } from '@/utils/accounts';

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(getMonthKey(getCurrentMonthStart()));
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');

  const router = useRouter();
  const { user } = useAuth();

  const filteredTransactions = selectedAccountId === 'all'
    ? transactions
    : transactions.filter(t => t.account_id === selectedAccountId);
  const filteredAccounts = selectedAccountId === 'all'
    ? accounts
    : accounts.filter(a => a.id === selectedAccountId);
  const engine = new CalculationEngine({ transactions: filteredTransactions, categories, budgets, accounts: filteredAccounts });

  const previousMonthKey = getMonthKey(new Date(parseMonthKey(currentMonth).getFullYear(), parseMonthKey(currentMonth).getMonth() - 1));
  const nextMonthKey = getMonthKey(new Date(parseMonthKey(currentMonth).getFullYear(), parseMonthKey(currentMonth).getMonth() + 1));

  const handlePreviousMonth = () => setCurrentMonth(previousMonthKey);
  const handleNextMonth = () => setCurrentMonth(nextMonthKey);
  const handleCurrentMonth = () => setCurrentMonth(getMonthKey(new Date()));

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        if (!user) return;

        const [txRes, catRes, budRes, accRes] = await Promise.all([
          transactionsApi.list(),
          categoriesApi.list(),
          budgetsApi.list(),
          accountsApi.list(),
        ]);

        if (!ignore) {
          setTransactions(txRes);
          setCategories(catRes);
          setBudgets(budRes);
          setAccounts(accRes);
        }
      } catch (err) {
        if (!ignore) setError('Failed to load dashboard data');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    const handleTransactionsUpdated = async () => {
      try {
        setLoading(true);
        if (!user) return;

        const [txRes, catRes, budRes, accRes] = await Promise.all([
          transactionsApi.list(),
          categoriesApi.list(),
          budgetsApi.list(),
          accountsApi.list(),
        ]);

        if (!ignore) {
          setTransactions(txRes);
          setCategories(catRes);
          setBudgets(budRes);
          setAccounts(accRes);
        }
      } catch (err) {
        if (!ignore) setError('Failed to load dashboard data');
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    window.addEventListener('transactions-updated', handleTransactionsUpdated);
    return () => {
      ignore = true;
      window.removeEventListener('transactions-updated', handleTransactionsUpdated);
    };
  }, [currentMonth, user]);

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
<div className="flex flex-wrap items-center gap-2">
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All Accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {accounts.map(a => (
                  <SelectItem key={a.id} value={a.id}>{formatAccountLabel(a)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
          title="Transfers"
          value={formatCurrency(metrics.total_transfers)}
          icon={Repeat}
          iconClass="text-purple-500"
          trend="up"
          trendValue={formatCurrency(metrics.monthly_transfers)}
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
          transactions={filteredTransactions.slice(0, 10)}
          accounts={accounts}
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