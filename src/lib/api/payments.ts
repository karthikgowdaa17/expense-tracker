import { api } from './client';
import type { Transaction } from '@/types';

export interface PaymentMethodStats {
  method: string;
  expense: number;
  income: number;
  count: number;
  expensePercent: number;
  incomePercent: number;
}

export interface PaymentsSummary {
  totalExpenses: number;
  totalIncome: number;
  netFlow: number;
  byMethod: PaymentMethodStats[];
}

export interface PaymentsFilters {
  dateFrom?: string;
  dateTo?: string;
  method?: string;
  limit?: number;
  offset?: number;
}

function buildQuery(filters: PaymentsFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null) params.set(k, String(v));
  });
  return params.toString() ? `?${params.toString()}` : '';
}

export const paymentsApi = {
  getSummary: (filters?: PaymentsFilters) =>
    api.get<PaymentsSummary>(`/api/payments/summary${buildQuery(filters)}`),

  getTransactions: (filters?: PaymentsFilters) =>
    api.get<Transaction[]>(`/api/payments/transactions${buildQuery(filters)}`),

  getMethods: () =>
    api.get<{ value: string; label: string; icon: string }[]>('/api/payments/methods'),
};