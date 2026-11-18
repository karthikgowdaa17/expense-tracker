'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/utils/currency';
import { cn } from '@/utils/currency';
import { getMonthKey, formatMonthYear, parseMonthKey, getPreviousMonth, getNextMonth, getMonthRange } from '@/utils/date';
import { useAuth } from '@/lib/auth-context';
import { Transaction } from '@/types';
import { Loader2, ChevronLeft, ChevronRight, CreditCard, Smartphone, Banknote, Building2, PieChart, Wallet } from 'lucide-react';
import { paymentsApi, PaymentMethodStats } from '@/lib/api/payments';

const PAYMENT_METHODS_INFO: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  upi: { label: 'UPI', icon: Smartphone },
  credit_card: { label: 'Credit Card', icon: CreditCard },
  debit_card: { label: 'Debit Card', icon: CreditCard },
  bank_transfer: { label: 'Bank Transfer', icon: Building2 },
  cash: { label: 'Cash', icon: Banknote },
  other: { label: 'Other', icon: Wallet },
};

export default function PaymentsPage() {
  const [currentMonth, setCurrentMonth] = useState(getMonthKey(new Date()));
  const [summary, setSummary] = useState<{
    totalExpenses: number;
    totalIncome: number;
    netFlow: number;
    byMethod: PaymentMethodStats[];
  } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  const { user } = useAuth();

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      if (!user) return;

      const { start, end } = getMonthRange(parseMonthKey(currentMonth));
      const data = await paymentsApi.getSummary({
        dateFrom: start.toISOString().split('T')[0],
        dateTo: end.toISOString().split('T')[0],
      });

      if (data) {
        setSummary(data);
      }
    } catch (err) {
      console.error('Failed to load payment summary:', err);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, user]);

  const fetchTransactions = useCallback(async () => {
    try {
      setTransactionsLoading(true);
      if (!user) return;

      const { start, end } = getMonthRange(parseMonthKey(currentMonth));
      const data = await paymentsApi.getTransactions({
        dateFrom: start.toISOString().split('T')[0],
        dateTo: end.toISOString().split('T')[0],
        method: selectedMethod === 'all' ? undefined : selectedMethod,
      });

      if (data) {
        setTransactions(data);
      }
    } catch (err) {
      console.error('Failed to load payment transactions:', err);
    } finally {
      setTransactionsLoading(false);
    }
  }, [currentMonth, user, selectedMethod]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handlePreviousMonth = () => setCurrentMonth(prev => getMonthKey(getPreviousMonth(parseMonthKey(prev))));
  const handleNextMonth = () => setCurrentMonth(prev => getMonthKey(getNextMonth(parseMonthKey(prev))));

  const filteredTransactions = transactions;

  const methodEntries = summary?.byMethod || [];

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">Payment method analytics for {formatMonthYear(parseMonthKey(currentMonth))}</p>
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
            <div className="text-3xl font-bold text-green-600">{formatCurrency(summary?.totalIncome || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-red-500" />
              Total Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{formatCurrency(summary?.totalExpenses || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PieChart className="h-4 w-4 text-blue-500" />
              Net Flow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-3xl font-bold", (summary && summary.netFlow >= 0) ? 'text-green-600' : 'text-red-600')}>
              {formatCurrency(summary?.netFlow || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Methods Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {methodEntries.length > 0 ? (
            <div className="space-y-4">
              {methodEntries.map((data) => {
                const methodInfo = PAYMENT_METHODS_INFO[data.method];
                const total = data.expense + data.income;
                
                return (
                  <div key={data.method} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        {methodInfo && <methodInfo.icon className="h-6 w-6 text-primary" />}
                      </div>
                      <div>
                        <p className="font-medium">{methodInfo?.label || data.method}</p>
                        <p className="text-sm text-muted-foreground">{data.count} transactions</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="text-sm text-muted-foreground">Expenses</p>
                        <p className="font-semibold text-red-600">{formatCurrency(data.expense)} <span className="text-xs font-normal">({data.expensePercent}%)</span></p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Income</p>
                        <p className="font-semibold text-green-600">{formatCurrency(data.income)} <span className="text-xs font-normal">({data.incomePercent}%)</span></p>
                      </div>
                      <div className="w-24">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-red-500" 
                            style={{ width: `${data.expensePercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No payment data for this month</p>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Transactions</h2>
        <Select value={selectedMethod} onValueChange={setSelectedMethod} disabled={transactionsLoading}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Methods" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            {Object.entries(PAYMENT_METHODS_INFO).map(([value, info]) => (
              <SelectItem key={value} value={value}>{info.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-medium text-muted-foreground">Date</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Description</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Method</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Category</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Amount</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Type</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 && !transactionsLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">No transactions found</td>
                  </tr>
                ) : (
                  filteredTransactions.slice(0, 50).map((tx) => (
                    <tr key={tx.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="p-4 font-mono text-sm">{tx.date}</td>
                      <td className="p-4">{tx.description}</td>
                      <td className="p-4">
                        <span className="capitalize">{tx.payment_method.replace('_', ' ')}</span>
                      </td>
                      <td className="p-4">{tx.category}</td>
                      <td className="p-4 text-right font-mono font-semibold">
                        <span className={cn(tx.type === 'income' ? 'text-green-600' : 'text-red-600')}>
                          {tx.type === 'income' ? '+' : ''}{formatCurrency(tx.amount)}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={cn('capitalize px-2 py-1 rounded-full text-xs', tx.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                          {tx.type}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
                {transactionsLoading && (
                  <tr>
                    <td colSpan={6} className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {(filteredTransactions.length > 50 || transactionsLoading) && (
            <div className="px-4 py-3 border-t text-sm text-muted-foreground text-center">
              {transactionsLoading ? 'Loading...' : `Showing 50 of ${filteredTransactions.length} transactions`}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}