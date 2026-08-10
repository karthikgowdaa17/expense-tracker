'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/currency';
import { formatDisplayDate } from '@/utils/date';
import { Transaction } from '@/types';
import { MoreHorizontal, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/currency';

interface RecentTransactionsProps {
  transactions: Transaction[];
  onViewAll: () => void;
}

export function RecentTransactions({ transactions, onViewAll }: RecentTransactionsProps) {
  const getTypeColor = (type: Transaction['type']) => {
    switch (type) {
      case 'income': return 'text-green-600';
      case 'expense': return 'text-red-600';
      case 'refund': return 'text-blue-600';
      case 'transfer': return 'text-purple-600';
      default: return 'text-muted-foreground';
    }
  };

  const getTypeIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'income': return '↑';
      case 'expense': return '↓';
      case 'refund': return '↩';
      case 'transfer': return '↔';
      default: return '•';
    }
  };

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Transactions</CardTitle>
          <Button variant="ghost" size="sm" onClick={onViewAll}>
            View All <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          No transactions yet. Add your first transaction to get started.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Transactions</CardTitle>
        <Button variant="ghost" size="sm" onClick={onViewAll}>
          View All <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex flex-col">
                  <p className="font-medium truncate">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDisplayDate(tx.date)} · {tx.category} · {tx.payment_method}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 ml-4">
                <span className={cn('font-semibold', getTypeColor(tx.type))}>
                  {tx.type === 'income' ? '+' : ''}{formatCurrency(tx.amount)}
                </span>
                <span className="text-xs text-muted-foreground">{getTypeIcon(tx.type)}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}