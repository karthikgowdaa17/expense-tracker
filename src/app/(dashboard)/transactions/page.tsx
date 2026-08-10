'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/utils/currency';
import { formatDisplayDate } from '@/utils/date';
import { createClient } from '@/lib/supabase/client';
import { Transaction, TransactionType, PaymentMethod, AccountType } from '@/types';
import { Plus, Search, Filter, ChevronDown, Edit, Trash2, Copy, Loader2, MoreHorizontal } from 'lucide-react';
import { cn } from '@/utils/currency';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';

interface TransactionFilters {
  search: string;
  type: TransactionType | 'all';
  category: string;
  paymentMethod: string;
  account: string;
  dateFrom: string;
  dateTo: string;
  sortBy: 'date' | 'amount';
  sortOrder: 'asc' | 'desc';
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<TransactionFilters>({
    search: '',
    type: 'all',
    category: 'all',
    paymentMethod: 'all',
    account: 'all',
    dateFrom: '',
    dateTo: '',
    sortBy: 'date',
    sortOrder: 'desc',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});

  const router = useRouter();
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      const { data: catData } = await supabase
        .from('categories')
        .select('name')
        .eq('user_id', user.id);

      if (txData) setTransactions(txData);
      if (catData) setCategories(catData.map(c => c.name));
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const applyFilters = useCallback(() => {
    let result = [...transactions];

    if (filters.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(tx => 
        tx.description.toLowerCase().includes(search) ||
        tx.category.toLowerCase().includes(search) ||
        tx.notes?.toLowerCase().includes(search)
      );
    }

    if (filters.type !== 'all') {
      result = result.filter(tx => tx.type === filters.type);
    }

    if (filters.category !== 'all') {
      result = result.filter(tx => tx.category === filters.category);
    }

    if (filters.paymentMethod !== 'all') {
      result = result.filter(tx => tx.payment_method === filters.paymentMethod);
    }

    if (filters.account !== 'all') {
      result = result.filter(tx => tx.account === filters.account);
    }

    if (filters.dateFrom) {
      result = result.filter(tx => tx.date >= filters.dateFrom);
    }

    if (filters.dateTo) {
      result = result.filter(tx => tx.date <= filters.dateTo);
    }

    result.sort((a, b) => {
      const aVal = a[filters.sortBy];
      const bVal = b[filters.sortBy];
      if (filters.sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    setFilteredTransactions(result);
  }, [transactions, filters]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setEditForm({ ...tx });
  };

  const handleSaveEdit = async (tx: Transaction) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update(editForm)
        .eq('id', tx.id);

      if (error) throw error;
      
      setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, ...editForm } : t));
      setEditingId(null);
      setEditForm({});
    } catch (err) {
      console.error('Failed to update transaction:', err);
    }
  };

  const handleDelete = async (tx: Transaction) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', tx.id);

      if (error) throw error;
      
      setTransactions(prev => prev.filter(t => t.id !== tx.id));
    } catch (err) {
      console.error('Failed to delete transaction:', err);
    }
  };

  const handleDuplicate = async (tx: Transaction) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newTx = { ...tx, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      delete (newTx as any).id;

      const { data, error } = await supabase
        .from('transactions')
        .insert({ ...newTx, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      
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
  const accountTypes: AccountType[] = ['cash', 'bank_account', 'credit_card', 'savings', 'investment', 'other'];
  const types: (TransactionType | 'all')[] = ['all', 'income', 'expense', 'transfer', 'refund'];

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
              <Select value={filters.account} onValueChange={(v) => setFilters(prev => ({ ...prev, account: v }))}>
                <SelectTrigger><SelectValue placeholder="All Accounts" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accountTypes.map(a => <SelectItem key={a} value={a}>{a.replace('_', ' ')}</SelectItem>)}
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
                          <Select value={editForm.account || tx.account} onValueChange={(v) => setEditForm(prev => ({ ...prev, account: v }))}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {accountTypes.map(a => <SelectItem key={a} value={a}>{a.replace('_', ' ')}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          tx.account.replace('_', ' ')
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
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem className="text-destructive focus:text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete transaction</AlertDialogTitle>
                                    <AlertDialogDescription>Are you sure you want to delete this transaction? This action cannot be undone.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogAction onClick={() => handleDelete(tx)}>Delete</AlertDialogAction>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                </AlertDialogContent>
                              </AlertDialog>
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
    </div>
  );
}