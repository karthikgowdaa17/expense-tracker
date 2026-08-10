'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/currency';
import { createClient } from '@/lib/supabase/client';
import { Loader2, ChevronLeft, ChevronRight, Wallet } from 'lucide-react';
import { cn } from '@/utils/currency';
import { getMonthKey, formatMonthYear, parseMonthKey, getPreviousMonth, getNextMonth, getMonthRange } from '@/utils/date';
import { Transaction } from '@/types';

export default function IncomePage() {
  const [currentMonth, setCurrentMonth] = useState(getMonthKey(new Date()));
  const [incomeData, setIncomeData] = useState<{
    total: number;
    byCategory: Record<string, number>;
    transactions: Transaction[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { start, end } = getMonthRange(parseMonthKey(currentMonth));
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'income')
        .gte('date', start.toISOString().split('T')[0])
        .lte('date', end.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (data) {
        const total = data.reduce((sum, t) => sum + t.amount, 0);
        const byCategory: Record<string, number> = {};
        data.forEach(t => {
          byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
        });
        setIncomeData({ total, byCategory, transactions: data });
      }
    } catch (err) {
      console.error('Failed to load income data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, supabase]);

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
          <h1 className="text-3xl font-bold tracking-tight">Income</h1>
          <p className="text-muted-foreground">Track your income sources for {formatMonthYear(parseMonthKey(currentMonth))}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePreviousMonth}><ChevronLeft className="mr-1 h-4 w-4" /> Previous</Button>
          <Button variant="outline" onClick={handleNextMonth}>Next <ChevronRight className="ml-1 h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4 text-green-500" />
              Total Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{formatCurrency(incomeData?.total || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{Object.keys(incomeData?.byCategory || {}).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{incomeData?.transactions.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Income by Source</CardTitle>
        </CardHeader>
        <CardContent>
          {incomeData && Object.entries(incomeData.byCategory).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(incomeData.byCategory).map(([category, amount]) => (
                <div key={category} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">{category}</p>
                      <p className="text-sm text-muted-foreground">{(amount / incomeData.total * 100).toFixed(1)}% of total</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">{formatCurrency(amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No income recorded for this month</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Income Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {incomeData && incomeData.transactions.length > 0 ? (
            <div className="space-y-3">
              {incomeData.transactions.slice(0, 10).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div>
                    <p className="font-medium">{tx.description}</p>
                    <p className="text-sm text-muted-foreground">{tx.category} · {tx.payment_method}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">+{formatCurrency(tx.amount)}</p>
                    <p className="text-xs text-muted-foreground">{tx.date}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No income transactions yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}