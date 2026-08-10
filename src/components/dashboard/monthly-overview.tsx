'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/utils/currency';
import { cn } from '@/utils/currency';
import { MonthlySummary } from '@/types';

interface MonthlyOverviewProps {
  currentMonth: MonthlySummary;
  previousMonth: MonthlySummary;
}

export function MonthlyOverview({ currentMonth, previousMonth }: MonthlyOverviewProps) {
 
  const incomeChange = currentMonth.income - previousMonth.income;
  const expenseChange = currentMonth.expenses - previousMonth.expenses;
  const savingsChange = currentMonth.savings - previousMonth.savings;
  
  const incomeChangePct = previousMonth.income > 0 ? ((incomeChange / previousMonth.income) * 100).toFixed(1) : 'N/A';
  const expenseChangePct = previousMonth.expenses > 0 ? ((expenseChange / previousMonth.expenses) * 100).toFixed(1) : 'N/A';

  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle>Monthly Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Income</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(currentMonth.income)}</p>
            <p className={cn(incomeChange >= 0 ? 'text-green-500' : 'text-red-500', 'text-sm')}>
              {incomeChange >= 0 ? '↑' : '↓'} {Math.abs(incomeChangePct === 'N/A' ? 0 : Number(incomeChangePct))}% vs last month
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Expenses</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(currentMonth.expenses)}</p>
            <p className={cn(expenseChange >= 0 ? 'text-red-500' : 'text-green-500', 'text-sm')}>
              {expenseChange >= 0 ? '↑' : '↓'} {Math.abs(expenseChangePct === 'N/A' ? 0 : Number(expenseChangePct))}% vs last month
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Savings</p>
            <p className="text-2xl font-bold">{formatCurrency(currentMonth.savings)}</p>
            <p className="text-sm text-muted-foreground">
              {currentMonth.savings_rate.toFixed(1)}% savings rate
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}