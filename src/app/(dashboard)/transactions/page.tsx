'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/utils/currency';
import { formatDisplayDate } from '@/utils/date';
import { useAuth } from '@/lib/auth-context';
import { Transaction, TransactionType, PaymentMethod, Account } from '@/types';
import { Plus, Search, Filter, ChevronDown, Edit, Trash2, Copy, Loader2, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/utils/currency';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { transactionsApi } from '@/lib/api/transactions';
import { categoriesApi } from '@/lib/api/categories';
import { accountsApi } from '@/lib/api/accounts';
import { accountLabelForTx, buildAccountMap, formatAccountLabel } from '@/utils/accounts';

interface TransactionFilters {
  search: string;
  type: TransactionType | 'all';
  category: string;
  paymentMethod: string;
  /** 'all' | 'unassigned' | account id */
  accountId: string;
  dateFrom: string;
  dateTo: string;
  sortBy: 'date' | 'amount';
  sortOrder: 'asc' | 'desc';
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TransactionFilters>({
    search: '',
    type: 'all',
    category: 'all',
    paymentMethod: 'all',
    accountId: 'all',
    dateFrom: '',
    dateTo: '',
    sortBy: 'date',
    sortOrder: 'desc',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);

  const router = useRouter();
  const { user } = useAuth();


  // Server applies the filters; only sorting happens client-side
  const filteredTransactions = [...transactions].sort((a, b) => {
    const aVal = a[filters.sortBy];
    const bVal = b[filters.sortBy];
    if (filters.sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  const accountMap = buildAccountMap(accounts);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        if (!user) {
          setLoading(false);
          return;
        }

        // Filter on the server (indexed columns), not in the browser
        const [txData, catData, accData] = await Promise.all([
          transactionsApi.list({
            search: filters.search || undefined,
            type: filters.type !== 'all' ? filters.type : undefined,
            category: filters.category !== 'all' ? filters.category : undefined,
            paymentMethod: filters.paymentMethod !== 'all' ? filters.paymentMethod : undefined,
            accountId: filters.accountId !== 'all' ? filters.accountId : undefined,
            dateFrom: filters.dateFrom || undefined,
            dateTo: filters.dateTo || undefined,
          }),
          categoriesApi.list(),
          accountsApi.list(),
        ]);

        if (!ignore) {
          setTransactions(txData);
          setCategories(catData.map(c => c.name));
          setAccounts(accData);
        }
      } catch (err) {
        console.error('Failed to load transactions:', err);
        if (!ignore) setError(err instanceof Error ? err.message : 'Failed to load transactions');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [user, filters.search, filters.type, filters.category, filters.paymentMethod, filters.accountId, filters.dateFrom, filters.dateTo]);

  const handleEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setEditForm({ ...tx });
  };

  const handleSaveEdit = async (tx: Transaction) => {
    try {
      if (!user) return;

      await transactionsApi.update(tx.id, editForm);
      
      setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, ...editForm } : t));
      setEditingId(null);
      setEditForm({});
    } catch (err) {
      console.error('Failed to update transaction:', err);
    }
  };

  const handleDelete = async (tx: Transaction) => {
    try {
      if (!user) {
        toast.error('Not authenticated');
        return;
      }

      await transactionsApi.delete(tx.id);

      // Refetch to keep UI in sync with DB
      await (async () => {
        try {
          setLoading(true);
          setError(null);
          if (!user) {
            setLoading(false);
            return;
          }

          const [txData, catData, accData] = await Promise.all([
            transactionsApi.list({
              search: filters.search || undefined,
              type: filters.type !== 'all' ? filters.type : undefined,
              category: filters.category !== 'all' ? filters.category : undefined,
              paymentMethod: filters.paymentMethod !== 'all' ? filters.paymentMethod : undefined,
              accountId: filters.accountId !== 'all' ? filters.accountId : undefined,
              dateFrom: filters.dateFrom || undefined,
              dateTo: filters.dateTo || undefined,
            }),
            categoriesApi.list(),
            accountsApi.list(),
          ]);

          setTransactions(txData);
          setCategories(catData.map(c => c.name));
          setAccounts(accData);
        } catch (err) {
          console.error('Failed to load transactions:', err);
          setError(err instanceof Error ? err.message : 'Failed to load transactions');
        } finally {
          setLoading(false);
        }
      })();
      toast.success('Transaction deleted');
      // Notify other components (e.g., Dashboard) to refresh
      window.dispatchEvent(new CustomEvent('transactions-updated'));
      router.refresh();
    } catch (err) {
      console.error('Failed to delete transaction:', err);
    }
  };

  const handleDuplicate = async (tx: Transaction) => {
    try {
      if (!user) return;

      const withCopyName = {
        ...tx,
        description: tx.description + ' (copy)',
      };
      // Remove fields the backend generates
      const { id: _id, user_id: _userId, created_at: _createdAt, updated_at: _updatedAt, fingerprint: _fp, ...newTx } = withCopyName;

      const data = await transactionsApi.create(newTx);
      
      setTransactions(prev => [data, ...prev]);
    } catch (err) {
      console.error('Failed to duplicate transaction:', err);
    }
  };

  const handleExport = () => {
    const headers = ['Date', 'Description', 'Category', 'Payment Method', 'Account', 'Amount', 'Type', 'Notes'];
    const rows = filteredTransactions.map(tx => [
      tx.date,
      tx.description,
      tx.category,
      tx.payment_method,
      tx.account,
      tx.amount.toString(),
      tx.type,
      tx.notes || '',
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const paymentMethods: PaymentMethod[] = ['cash', 'upi', 'credit_card', 'debit_card', 'bank_transfer', 'other'];
  const types: (TransactionType | 'all')[] = ['all', 'income', 'expense', 'transfer', 'refund'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="p-4 text-center text-destructive bg-destructive/10 rounded-lg">
          <p className="font-medium">Failed to load transactions</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
        <Button variant="outline" onClick={() => {
          (async () => {
            try {
              setLoading(true);
              setError(null);
              if (!user) {
                setLoading(false);
                return;
              }

              const [txData, catData, accData] = await Promise.all([
                transactionsApi.list({
                  search: filters.search || undefined,
                  type: filters.type !== 'all' ? filters.type : undefined,
                  category: filters.category !== 'all' ? filters.category : undefined,
                  paymentMethod: filters.paymentMethod !== 'all' ? filters.paymentMethod : undefined,
                  accountId: filters.accountId !== 'all' ? filters.accountId : undefined,
                  dateFrom: filters.dateFrom || undefined,
                  dateTo: filters.dateTo || undefined,
                }),
                categoriesApi.list(),
                accountsApi.list(),
              ]);

              setTransactions(txData);
              setCategories(catData.map(c => c.name));
              setAccounts(accData);
            } catch (err) {
              console.error('Failed to load transactions:', err);
              setError(err instanceof Error ? err.message : 'Failed to load transactions');
            } finally {
              setLoading(false);
            }
          })();
        }}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">
            Manage and view all your transactions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
          <Button onClick={() => router.push('/add-transaction')}>
            <Plus className="mr-2 h-4 w-4" />
            Add Transaction
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card className="overflow-hidden">
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transactions..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
              <Select value={filters.type} onValueChange={(v) => setFilters(prev => ({ ...prev, type: v as TransactionType | 'all' }))}>
                <SelectTrigger><SelectValue placeholder="All Types" /></SelectTrigger>
                <SelectContent>
                  {types.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filters.category} onValueChange={(v) => setFilters(prev => ({ ...prev, category: v }))}>
                <SelectTrigger><SelectValue placeholder="All Categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filters.paymentMethod} onValueChange={(v) => setFilters(prev => ({ ...prev, paymentMethod: v }))}>
                <SelectTrigger><SelectValue placeholder="All Methods" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  {paymentMethods.map(m => <SelectItem key={m} value={m}>{m.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filters.accountId} onValueChange={(v) => setFilters(prev => ({ ...prev, accountId: v }))}>
                <SelectTrigger><SelectValue placeholder="All Accounts" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{formatAccountLabel(a)}</SelectItem>)}
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input type="date" placeholder="From" value={filters.dateFrom} onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))} className="w-1/2" />
                <Input type="date" placeholder="To" value={filters.dateTo} onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))} className="w-1/2" />
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <Select value={`${filters.sortBy}-${filters.sortOrder}`} onValueChange={(v) => {
                const [sortBy, sortOrder] = v.split('-');
                setFilters(prev => ({ ...prev, sortBy: sortBy as 'date' | 'amount', sortOrder: sortOrder as 'asc' | 'desc' }));
              }}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Date (Newest)</SelectItem>
                  <SelectItem value="date-asc">Date (Oldest)</SelectItem>
                  <SelectItem value="amount-desc">Amount (Highest)</SelectItem>
                  <SelectItem value="amount-asc">Amount (Lowest)</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleExport}>
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[140px]">Category</TableHead>
                  <TableHead className="w-[140px]">Payment Method</TableHead>
                  <TableHead className="w-[120px]">Account</TableHead>
                  <TableHead className="w-[120px] text-right">Amount</TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No transactions found. Adjust your filters or add a new transaction.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((tx) => (
                    <TableRow key={tx.id} className={editingId === tx.id ? 'bg-accent/50' : ''}>
                      <TableCell className="font-mono text-sm">{formatDisplayDate(tx.date)}</TableCell>
                      <TableCell>
                        {editingId === tx.id ? (
                          <Input value={editForm.description || ''} onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))} className="w-full" />
                        ) : (
                          tx.description
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === tx.id ? (
                          <Select value={editForm.category || tx.category} onValueChange={(v) => setEditForm(prev => ({ ...prev, category: v }))}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          tx.category
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === tx.id ? (
                          <Select value={editForm.payment_method || tx.payment_method} onValueChange={(v) => setEditForm(prev => ({ ...prev, payment_method: v as PaymentMethod }))}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {paymentMethods.map(m => <SelectItem key={m} value={m}>{m.replace('_', ' ')}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          tx.payment_method.replace('_', ' ')
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === tx.id ? (
                          <Select
                            value={editForm.account_id ?? tx.account_id ?? 'unassigned'}
                            onValueChange={(v) => {
                              const accountId = v === 'unassigned' ? null : v;
                              const acc = accounts.find(a => a.id === accountId);
                              setEditForm(prev => ({
                                ...prev,
                                account_id: accountId,
                                account: acc ? formatAccountLabel(acc) : prev.account,
                              }));
                            }}
                          >
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {accounts.map(a => <SelectItem key={a.id} value={a.id}>{formatAccountLabel(a)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          accountLabelForTx(tx, accountMap)
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {editingId === tx.id ? (
                          <Input type="number" step="0.01" value={editForm.amount || tx.amount} onChange={(e) => setEditForm(prev => ({ ...prev, amount: parseFloat(e.target.value) }))} className="w-[100px] text-right" />
                        ) : (
                          <span className={cn(tx.type === 'income' ? 'text-green-600' : tx.type === 'expense' ? 'text-red-600' : 'text-muted-foreground')}>
                            {tx.type === 'income' ? '+' : ''}{formatCurrency(tx.amount)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === tx.id ? (
                          <Select value={editForm.type || tx.type} onValueChange={(v) => setEditForm(prev => ({ ...prev, type: v as TransactionType }))}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {types.filter(t => t !== 'all').map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={cn('capitalize px-2 py-1 rounded-full text-xs', tx.type === 'income' ? 'bg-green-100 text-green-700' : tx.type === 'expense' ? 'bg-red-100 text-red-700' : tx.type === 'refund' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700')}>
                            {tx.type}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === tx.id ? (
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="secondary" onClick={() => handleSaveEdit(tx)}><ChevronDown className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => { setEditingId(null); setEditForm({}); }}><MoreHorizontal className="h-4 w-4" /></Button>
                          </div>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(tx)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicate(tx)}>
                                <Copy className="mr-2 h-4 w-4" /> Duplicate
                              </DropdownMenuItem>
<DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setTransactionToDelete(tx)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-muted-foreground">
            <span>Showing {filteredTransactions.length} of {transactions.length} transactions</span>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!transactionToDelete} onOpenChange={(open) => { if (!open) setTransactionToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this transaction? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction onClick={() => { if (transactionToDelete) handleDelete(transactionToDelete); }}>Delete</AlertDialogAction>
          <AlertDialogCancel onClick={() => setTransactionToDelete(null)}>Cancel</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}