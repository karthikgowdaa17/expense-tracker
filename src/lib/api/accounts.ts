import { api } from './client';
import type { Account } from '@/types';

export type AccountCreateInput = Omit<Account, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'current_balance'>;

export type AccountDeleteMode = 'unassign' | 'reassign' | 'delete';

export interface AccountDeleteResult {
  deleted: boolean;
  mode: AccountDeleteMode;
  affected_transactions: number;
}

export const accountsApi = {
  list: () => api.get<Account[]>('/api/accounts'),
  create: (data: AccountCreateInput) =>
    api.post<Account>('/api/accounts', data),
  update: (id: string, data: Partial<Account>) =>
    api.patch<Account>(`/api/accounts/${id}`, data),
  /**
   * Delete an account without silently losing its transactions.
   *  - unassign (default): keep transactions, clear their account link
   *  - reassign: move transactions to `reassignTo`
   *  - delete: explicitly delete the account's transactions too
   */
  remove: (id: string, mode: AccountDeleteMode = 'unassign', reassignTo?: string) => {
    const params = new URLSearchParams({ mode });
    if (reassignTo) params.set('reassign_to', reassignTo);
    return api.delete<AccountDeleteResult>(`/api/accounts/${id}?${params.toString()}`);
  },
  delete: (id: string) => api.delete<void>(`/api/accounts/${id}`),
};
