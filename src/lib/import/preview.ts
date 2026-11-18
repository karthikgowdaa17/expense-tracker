/**
 * Shared helpers for import previews (Import page + Settings → Data).
 * Pure functions only – no React state, usable identically in both places.
 */
import { generateTransactionFingerprint } from '@/utils/fingerprint';
import { formatAccountLabel } from '@/utils/accounts';
import type { Account, PaymentMethod } from '@/types';
import type { NormalizedPhonePeRow } from './phonepe';

/** An account detected from an uploaded file (may or may not exist yet). */
export interface DetectedAccount {
  key: string;
  name: string;
  bank_name: string | null;
  account_number_last4: string | null;
  type: Account['type'];
  /** existing account id this detection maps to (null = created on import) */
  existingId: string | null;
}

/** '' = needs assignment | 'new:<detectedKey>' | 'acc:<accountId>' */
export type AccountRef = string;

export interface ImportPreviewRow {
  id: string;
  date: string;
  type: 'income' | 'expense' | 'transfer' | 'refund';
  amount: number;
  category: string;
  description: string;
  payment_method: PaymentMethod;
  accountRef: AccountRef;
  notes: string;
  transfer_direction: 'in' | 'out' | null;
  isDuplicate: boolean;
}

export function detectedLabel(d: DetectedAccount): string {
  return d.bank_name
    ? `${d.bank_name}${d.account_number_last4 ? ` ••••${d.account_number_last4}` : ''}`
    : d.name;
}

export function resolveRefLabel(ref: AccountRef, detected: DetectedAccount[], accounts: Account[]): string {
  if (!ref) return 'Needs assignment';
  if (ref.startsWith('acc:')) {
    const acc = accounts.find(a => a.id === ref.slice(4));
    return acc ? formatAccountLabel(acc) : 'Account';
  }
  const det = detected.find(d => d.key === ref.slice(4));
  return det ? detectedLabel(det) : 'New account';
}

/** Existing account id stored for this ref (null for accounts that will be created). */
export function refExistingId(ref: AccountRef): string | null {
  return ref.startsWith('acc:') ? ref.slice(4) : null;
}

export function rowFingerprint(
  row: Pick<ImportPreviewRow, 'date' | 'type' | 'amount' | 'description' | 'payment_method' | 'accountRef'>,
  ctx: { userId: string; detected: DetectedAccount[]; accounts: Account[] },
): string {
  return generateTransactionFingerprint({
    userId: ctx.userId,
    date: row.date,
    type: row.type,
    amount: row.amount,
    description: row.description,
    payment_method: row.payment_method,
    account: resolveRefLabel(row.accountRef, ctx.detected, ctx.accounts),
    account_id: refExistingId(row.accountRef),
  });
}

/**
 * Resolve the account reference for a normalized PhonePe/JSON row:
 * PhonePe notes ("Source account: XXXXXX8750") → per-account group;
 * structured backups' account name → existing/new account;
 * nothing → the default "Bank Account" (previous behaviour preserved).
 */
export function refForJsonRow(
  n: { row: NormalizedPhonePeRow; accountName: string | null },
  detectedByKey: Map<string, DetectedAccount>,
  accounts: Account[],
  defaultRef: AccountRef = '',
): AccountRef {
  const last4 = n.row.source_account_last4;
  if (last4) {
    const key = `phonepe-${last4}`;
    if (!detectedByKey.has(key)) {
      const match = accounts.find(a => a.account_number_last4 === last4) || null;
      detectedByKey.set(key, {
        key, name: `PhonePe ••••${last4}`, bank_name: null, account_number_last4: last4,
        type: 'bank_account', existingId: match?.id ?? null,
      });
    }
    const det = detectedByKey.get(key)!;
    return det.existingId ? `acc:${det.existingId}` : `new:${key}`;
  }
  if (n.accountName) {
    const match = accounts.find(a => a.name.toLowerCase() === n.accountName!.toLowerCase());
    if (match) return `acc:${match.id}`;
    const key = `name-${n.accountName.toLowerCase()}`;
    if (!detectedByKey.has(key)) {
      const knownTypes = ['cash', 'bank_account', 'credit_card', 'savings', 'investment', 'other'];
      const isType = knownTypes.includes(n.accountName);
      detectedByKey.set(key, {
        key,
        name: isType ? n.accountName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : n.accountName,
        bank_name: null,
        account_number_last4: null,
        type: (isType ? n.accountName : 'bank_account') as DetectedAccount['type'],
        existingId: null,
      });
    }
    return `new:${key}`;
  }
  if (defaultRef) return defaultRef;
  const def = accounts.find(a => a.name === 'Bank Account') || accounts[0];
  return def ? `acc:${def.id}` : '';
}
