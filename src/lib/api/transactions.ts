import { api } from './client';
import { API_BASE_URL } from './config';
import { getAccessToken } from './auth';
import type { Transaction } from '@/types';

export interface TransactionFilters {
  dateFrom?: string;
  dateTo?: string;
  type?: string;
  category?: string;
  paymentMethod?: string;
  account?: string;
  /** Account UUID to filter by, or 'unassigned' for rows without a linked account. */
  accountId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

function buildQuery(filters: TransactionFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null) params.set(k, String(v));
  });
  return params.toString() ? `?${params.toString()}` : '';
}

export type TransactionCreateInput = Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'fingerprint'>;

export const transactionsApi = {
  list: (filters?: TransactionFilters) =>
    api.get<Transaction[]>(`/api/transactions${buildQuery(filters)}`),
  create: (data: TransactionCreateInput) =>
    api.post<Transaction>('/api/transactions', data),
  update: (id: string, data: Partial<Transaction>) =>
    api.patch<Transaction>(`/api/transactions/${id}`, data),
  delete: (id: string) => api.delete<void>(`/api/transactions/${id}`),
  exportTransactions: (filters: TransactionFilters, format: ExportFormat) =>
    exportTransactions(filters, format),
};

export type ExportFormat = 'csv' | 'pdf';

export const exportTransactions = async (
  filters: TransactionFilters,
  format: ExportFormat,
): Promise<Blob> => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null) params.set(k, String(v));
  });
  params.set('format', format);

  const token = getAccessToken();
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}/api/transactions/export?${params}`, {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `Export failed (HTTP ${res.status})`);
  }

  return res.blob();
};
