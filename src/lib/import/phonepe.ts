/**
 * Shared PhonePe / generic-JSON transaction normalization.
 *
 * Extracted from the Settings page importer so the /import page and the
 * Settings → Data tab use ONE implementation (categorization, self-transfer
 * detection, learned merchant mappings).
 */
import type { Category } from '@/types';
import { isSelfTransferDescription } from '@/utils/selfTransfer';
import { extractSourceAccountLast4 } from '@/utils/accounts';

export type RawRow = Record<string, unknown>;

function strField(row: RawRow, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  return '';
}

export function parseCSV(text: string): RawRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim());
    const obj: RawRow = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    return obj;
  });
}

export function parseAmount(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]+/g, '');
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function stripCorporateSuffixes(s: string): string {
  return s
    .replace(/\b(limited|ltd|pvt|private|inc|corp|corporation|company|co|llp|india|foods|services|solutions|technologies|systems|enterprises|ventures|group|holdings)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractMerchantKey(desc: string): string {
  let cleaned = desc.toLowerCase().trim().replace(/[^a-z0-9\s]/g, ' ');
  cleaned = stripCorporateSuffixes(cleaned);
  cleaned = cleaned.replace(/\s+/g, ' ');
  const words = cleaned.split(' ').filter(w => w.length > 2);
  return words.slice(0, 2).join(' ');
}

const MERCHANT_MAP: Record<string, string> = {
  // Food
  'swiggy': 'Food', 'zomato': 'Food', 'blinkit': 'Food', 'zepto': 'Food',
  'instamart': 'Food', 'bigbasket': 'Food', 'dominos': 'Food', 'domino': 'Food',
  'pizza hut': 'Food', 'pizza': 'Food', 'biryani': 'Food', 'juice': 'Food',
  'sugar cane': 'Food', 'bakery': 'Food', 'cafe': 'Food', 'restaurant': 'Food', 'hotel': 'Food',
  // Transport
  'uber': 'Transportation', 'ola': 'Transportation', 'rapido': 'Transportation',
  'namma yatri': 'Transportation', 'metro': 'Transportation', 'bmtc': 'Transportation',
  'cab': 'Transportation', 'taxi': 'Transportation', 'parking': 'Transportation', 'fastag': 'Transportation',
  // Shopping
  'amazon': 'Shopping', 'flipkart': 'Shopping', 'myntra': 'Shopping', 'meesho': 'Shopping',
  'ajio': 'Shopping', 'nykaa': 'Shopping', 'croma': 'Shopping', 'reliance digital': 'Shopping',
  // Entertainment
  'netflix': 'Entertainment', 'spotify': 'Entertainment', 'youtube premium': 'Entertainment',
  'prime video': 'Entertainment', 'disney': 'Entertainment', 'sony liv': 'Entertainment',
  'hotstar': 'Entertainment', 'steam': 'Entertainment', 'playstation': 'Entertainment', 'xbox': 'Entertainment',
  // Bills
  'bescom': 'Bills & Utilities', 'electricity': 'Bills & Utilities', 'water bill': 'Bills & Utilities',
  'gas bill': 'Bills & Utilities', 'broadband': 'Bills & Utilities', 'airtel': 'Bills & Utilities',
  'jio': 'Bills & Utilities', 'vi': 'Bills & Utilities', 'bsnl': 'Bills & Utilities',
  'recharge': 'Bills & Utilities', 'bbps': 'Bills & Utilities',
  // Health
  'apollo': 'Health', '1mg': 'Health', 'pharmeasy': 'Health', 'netmeds': 'Health',
  'hospital': 'Health', 'pharmacy': 'Health', 'medical': 'Health', 'clinic': 'Health', 'diagnostic': 'Health',
  // Rent
  'rent': 'Rent', 'landlord': 'Rent',
  // Income
  'salary': 'Income', 'payroll': 'Income', 'employer': 'Income', 'stipend': 'Income', 'refund': 'Income',
  // Cash
  'atm': 'Cash', 'cash withdrawal': 'Cash',
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Food: ['food', 'restaurant', 'cafe', 'bakery', 'juice', 'sweets', 'biryani', 'pizza', 'hotel'],
  Transportation: ['uber', 'ola', 'rapido', 'namma yatri', 'metro', 'bmtc', 'bus', 'cab', 'taxi', 'parking', 'fastag'],
  Shopping: ['amazon', 'flipkart', 'myntra', 'meesho', 'ajio', 'nykaa', 'croma', 'reliance digital', 'shopping'],
  'Bills & Utilities': ['electricity', 'bescom', 'water', 'gas', 'broadband', 'airtel', 'jio', 'vi', 'bsnl', 'recharge', 'bbps', 'bill'],
  Entertainment: ['netflix', 'spotify', 'youtube', 'prime', 'disney', 'sony', 'hotstar', 'steam', 'playstation', 'xbox', 'gaming'],
  Health: ['apollo', '1mg', 'pharmeasy', 'netmeds', 'hospital', 'pharmacy', 'medical', 'clinic', 'diagnostic'],
  Rent: ['rent', 'landlord'],
  Income: ['salary', 'payroll', 'employer', 'stipend', 'refund', 'cashback'],
  Cash: ['atm', 'cash withdrawal', 'withdrawal'],
};

export function getCategoryForTransaction(
  description: string,
  type: 'income' | 'expense' | 'transfer',
  categories: Category[],
  learnedMap: Record<string, string> = {},
): string {
  const lookupType = type === 'transfer' ? 'expense' : type;

  // Priority 1: user-learned mappings
  const merchantKey = extractMerchantKey(description);
  if (learnedMap[merchantKey]) {
    const learnedCat = learnedMap[merchantKey];
    const catExists = categories.find(c => c.name === learnedCat && c.type === lookupType);
    if (catExists) return learnedCat;
  }

  const normDesc = stripCorporateSuffixes(description.toLowerCase());

  // Priority 2: strong merchant mappings
  for (const [merchant, cat] of Object.entries(MERCHANT_MAP)) {
    if (normDesc.includes(merchant)) {
      if (cat === 'Income' && type !== 'income') continue;
      if (cat === 'Transfer' && type !== 'transfer') continue;
      const catExists = categories.find(c => c.name === cat && c.type === lookupType);
      if (catExists) return cat;
    }
  }

  // Priority 3: broader category keywords
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => normDesc.includes(k))) {
      if (cat === 'Income' && type !== 'income') continue;
      const catExists = categories.find(c => c.name === cat && c.type === lookupType);
      if (catExists) return cat;
    }
  }

  // Priority 4: "Other" fallback
  const existingCat = categories.find(c => c.name.toLowerCase() === 'other' && c.type === lookupType);
  if (existingCat) return existingCat.name;
  const def = categories.find(c => c.is_default && c.type === lookupType);
  return def?.name || 'Other';
}

export interface NormalizedPhonePeRow {
  date: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  category: string;
  description: string;
  payment_method: 'cash' | 'upi' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'other';
  /** Legacy free-text account value (preserved for backward compatibility). */
  account: string;
  notes: string;
  /** Last 4 of the funding account when present in notes, else null. */
  source_account_last4: string | null;
}

export function normalizePhonePeRow(
  row: RawRow,
  categories: Category[],
  learnedMap: Record<string, string> = {},
): NormalizedPhonePeRow {
  const date = strField(row, 'date', 'transaction_date', 'txn_date');
  const description = strField(row, 'description', 'narration', 'merchant', 'details');
  const amountRaw = row.amount ?? row.txn_amount ?? row.debit ?? row.credit ?? 0;
  const typeRaw = strField(row, 'type', 'txn_type', 'cr_dr').toLowerCase();

  const amount = parseAmount(amountRaw);
  let type: 'income' | 'expense' | 'transfer' = 'expense';

  if (isSelfTransferDescription(description)) {
    type = 'transfer';
  } else if (typeRaw.includes('credit') || typeRaw.includes('cr') || typeRaw.includes('received')) {
    type = 'income';
  } else if (typeRaw.includes('debit') || typeRaw.includes('dr') || typeRaw.includes('paid')) {
    type = 'expense';
  } else {
    if (amount > 0 && /salary|credit|received|refund|cashback/i.test(description)) type = 'income';
  }

  const category = getCategoryForTransaction(description, type, categories, learnedMap);

  const rawNotes = strField(row, 'notes', 'note');
  const lowerNotes = String(rawNotes).toLowerCase();
  let accountType: 'cash' | 'bank_account' | 'credit_card' | 'savings' | 'investment' | 'other' = 'bank_account';
  if (lowerNotes.includes('credit card') || lowerNotes.includes('slice') || lowerNotes.includes('credit_card')) {
    accountType = 'credit_card';
  } else if (lowerNotes.includes('cash')) {
    accountType = 'cash';
  }

  return {
    date: String(date).split('T')[0],
    type,
    amount: Math.abs(amount),
    category,
    description: String(description).slice(0, 200),
    payment_method: 'upi',
    account: accountType,
    notes: rawNotes,
    source_account_last4: extractSourceAccountLast4(String(rawNotes)),
  };
}
