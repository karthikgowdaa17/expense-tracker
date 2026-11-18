import type { Account, Transaction } from '@/types';

/**
 * Display label for an account, e.g. "HDFC Bank ••••4521".
 * Only the last 4 digits are ever shown – never a full account number.
 */
export function formatAccountLabel(account: Pick<Account, 'name' | 'bank_name' | 'account_number_last4'>): string {
  const last4 = account.account_number_last4 ? ` ••••${account.account_number_last4}` : '';
  const base = account.bank_name || account.name;
  // Avoid "...4521 ••••4521" when the name already carries the mask
  if (account.account_number_last4 && account.name.endsWith(account.account_number_last4) && !account.bank_name) {
    return account.name;
  }
  return `${base}${last4}`;
}

/** Map account_id -> Account for fast lookups (null-safe). */
export function buildAccountMap(accounts: Account[]): Map<string, Account> {
  return new Map(accounts.map(a => [a.id, a]));
}

/**
 * Resolve the account label for a transaction, falling back to the legacy
 * free-text `account` column when the FK is not populated (pre-migration rows).
 */
export function accountLabelForTx(tx: Pick<Transaction, 'account' | 'account_id'>, accountMap: Map<string, Account>): string {
  if (tx.account_id) {
    const acc = accountMap.get(tx.account_id);
    if (acc) return formatAccountLabel(acc);
  }
  return prettyLegacyAccount(tx.account);
}

/** Render legacy account strings (often raw type values) in a friendly way. */
export function prettyLegacyAccount(value?: string | null): string {
  if (!value) return '—';
  const pretty = value.replace(/_/g, ' ').trim();
  return pretty.replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * PhonePe exports embed the funding account in notes, e.g.
 * "PhonePe import | Source account: XXXXXX8750 | Time: 08:55 pm".
 * Returns the last 4 digits when present.
 */
export function extractSourceAccountLast4(notes?: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/Source account:\s*[Xx\*]+(\d{4})/i);
  return m ? m[1] : null;
}
