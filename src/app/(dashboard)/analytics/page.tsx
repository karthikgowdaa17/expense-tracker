'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatCurrencyCompact } from '@/utils/currency';
import { createClient } from '@/lib/supabase/client';
import { Loader2, TrendingUp, TrendingDown, Minus, Wallet, BarChart2 } from 'lucide-react';
import { cn } from '@/utils/currency';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#10B981', '#EF4444', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#84CC16', '#6366F1'];

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'monthly' | 'quarterly' | 'yearly' | 'custom'>('monthly');
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      let startDate: Date;
      
      switch (timeRange) {
        case 'monthly':
          startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
          break;
        case 'quarterly':
          startDate = new Date(now.getFullYear() - 2, 0, 1);
          break;
        case 'yearly':
          startDate = new Date(now.getFullYear() - 4, 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear() - 1, 0, 1);
      }

      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (data) {
        processData(data);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const processData = (transactions: any[]) => {
    const monthlyData: Record<string, { income: number; expenses: number; savings: number }> = {};
    const categoryData: Record<string, number> = {};
    let totalIncome = 0;
    let totalExpenses = 0;

    transactions.forEach(tx => {
      const date = new Date(tx.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[key]) {
        monthlyData[key] = { income: 0, expenses: 0, savings: 0 };
      }
      
      if (tx.type === 'income') {
        monthlyData[key].income += tx.amount;
        totalIncome += tx.amount;
      } else if (tx.type === 'expense') {
        monthlyData[key].expenses += tx.amount;
        totalExpenses += tx.amount;
        categoryData[tx.category] = (categoryData[tx.category] || 0) + tx.amount;
      }
    });

    Object.keys(monthlyData).forEach(key => {
      monthlyData[key].savings = monthlyData[key].income - monthlyData[key].expenses;
    });

    const sortedMonths = Object.keys(monthlyData).sort();
    const chartData = sortedMonths.map(key => ({
      month: key,
      ...monthlyData[key],
    }));

    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
    const avgMonthlyExpenses = totalExpenses / Math.max(sortedMonths.length, 1);
    const avgMonthlyIncome = totalIncome / Math.max(sortedMonths.length, 1);

    const highestCategory = Object.entries(categoryData).sort((a, b) => b[1] - a[1])[0] || ['None', 0];

    setAnalyticsData({
      chartData,
      categoryData,
      totalIncome,
      totalExpenses,
      totalSavings: totalIncome - totalExpenses,
      savingsRate,
      avgMonthlyExpenses,
      avgMonthlyIncome,
      highestSpendingCategory: highestCategory[0],
      highestSpendingAmount: highestCategory[1],
      monthsAnalyzed: sortedMonths.length,
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="flex items-center gap-2 text-sm" style={{ color: entry.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">Insights into your spending patterns</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange as any}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Time range" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Last 12 Months</SelectItem>
            <SelectItem value="quarterly">Last 2 Years (Quarterly)</SelectItem>
            <SelectItem value="yearly">Last 5 Years</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Income" value={formatCurrency(analyticsData?.totalIncome || 0)} icon={TrendingUp} color="text-green-500" />
        <MetricCard title="Total Expenses" value={formatCurrency(analyticsData?.totalExpenses || 0)} icon={TrendingDown} color="text-red-500" />
        <MetricCard title="Net Savings" value={formatCurrency(analyticsData?.totalSavings || 0)} icon={Wallet} color="text-blue-500" />
        <MetricCard title="Savings Rate" value={`${analyticsData?.savingsRate?.toFixed(1) || 0}%`} icon={BarChart2} color="text-purple-500" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Income vs Expenses Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analyticsData?.chartData || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" tickLine={false} axisLine={false} />
                  <YAxis className="text-xs" tickFormatter={(v) => formatCurrencyCompact(v)} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="#10B981" strokeWidth={2} dot={false} name="Income" />
                  <Line type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} dot={false} name="Expenses" />
                  <Line type="monotone" dataKey="savings" stroke="#3B82F6" strokeWidth={2} dot={false} name="Savings" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Spending Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Object.entries(analyticsData?.categoryData || {}).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {Object.entries(analyticsData?.categoryData || {}).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Key Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg Monthly Income</span>
              <span className="font-semibold">{formatCurrency(analyticsData?.avgMonthlyIncome || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg Monthly Expenses</span>
              <span className="font-semibold">{formatCurrency(analyticsData?.avgMonthlyExpenses || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Months Analyzed</span>
              <span className="font-semibold">{analyticsData?.monthsAnalyzed || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Highest Spending Category</span>
              <span className="font-semibold">{analyticsData?.highestSpendingCategory || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Highest Category Amount</span>
              <span className="font-semibold">{formatCurrency(analyticsData?.highestSpendingAmount || 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Savings Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-4xl font-bold text-green-600">{formatCurrency(analyticsData?.totalSavings || 0)}</p>
              <p className="text-muted-foreground">Total Savings</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-blue-600">{analyticsData?.savingsRate?.toFixed(1) || 0}%</p>
              <p className="text-muted-foreground">Overall Savings Rate</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Monthly Bar Chart</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsData?.chartData || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" tickLine={false} axisLine={false} />
                  <YAxis className="text-xs" tickFormatter={(v) => formatCurrencyCompact(v)} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="income" fill="#10B981" name="Income" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="#EF4444" name="Expenses" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, color }: { title: string; value: string; icon: React.ComponentType<{ className?: string }>; color: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className={cn("h-4 w-4", color)} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}