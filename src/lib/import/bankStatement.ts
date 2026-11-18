/**
 * Bank statement PDF parser.
 *
 * Pure functions over "positioned text lines" (extracted by ./pdfText.ts) so the
 * whole pipeline is unit-testable in Node without a browser or PDF library.
 *
 * The parser is bank-agnostic at its core: it detects statement table columns
 * ("Withdrawal/Debit" / "Deposit/Credit" / "Balance") from their header
 * positions and reads rows by x-coordinate. Bank profiles only provide
 * detection keywords and account-number patterns, so adding a bank means
 * adding a small profile entry.
 */

import { isSelfTransferDescription, referencesOwnAccountNumber } from '@/utils/selfTransfer';

export interface StatementItem { x: number; str: string }
export interface StatementLine { page: number; items: StatementItem[]; text: string }

export interface DetectedStatementAccount {
  /** Stable key within one parse run, e.g. "acct-0" */
  key: string;
  bank_name: string | null;
  account_number_last4: string | null;
  type: 'bank_account' | 'credit_card' | 'savings';
  /** Proposed account name used when creating the account. */
  name: string;
}

export interface ParsedStatementRow {
  /** Temporary client-side id */
  id: string;
  date: string; // ISO yyyy-mm-dd
  description: string;
  amount: number;
  direction: 'debit' | 'credit';
  type: 'income' | 'expense' | 'transfer';
  /** references DetectedStatementAccount.key; null = needs manual assignment */
  accountKey: string | null;
  balanceAfter: number | null;
  rawLine: string;
}

export interface StatementParseResult {
  bank_name: string | null;
  accounts: DetectedStatementAccount[];
  transactions: ParsedStatementRow[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Bank profiles (extend here to support more banks)
// ---------------------------------------------------------------------------

interface BankProfile {
  id: string;
  displayName: string;
  keywords: string[];
}

export const BANK_PROFILES: BankProfile[] = [
  { id: 'hdfc', displayName: 'HDFC Bank', keywords: ['hdfc bank', 'hdfcbank', 'www.hdfcbank'] },
  { id: 'icici', displayName: 'ICICI Bank', keywords: ['icici bank', 'icicibank', 'www.icicibank'] },
  { id: 'sbi', displayName: 'SBI', keywords: ['state bank of india', 'onlinesbi', 'sbi.co.in', 'www.sbi'] },
  { id: 'axis', displayName: 'Axis Bank', keywords: ['axis bank', 'axisbank'] },
  { id: 'kotak', displayName: 'Kotak Mahindra Bank', keywords: ['kotak mahindra', 'kotak bank', 'kotak.com'] },
  { id: 'idfc', displayName: 'IDFC FIRST Bank', keywords: ['idfc first', 'idfc bank', 'idfcfirst'] },
  { id: 'yes', displayName: 'Yes Bank', keywords: ['yes bank', 'yesbank'] },
  { id: 'indusind', displayName: 'IndusInd Bank', keywords: ['indusind bank', 'indusindbank'] },
  { id: 'federal', displayName: 'Federal Bank', keywords: ['federal bank', 'federalbank'] },
];

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

const DATE_TOKEN = /^\d{2}[\/-]\d{2}[\/-]\d{2,4}$/;
const DATE_WORD = /^\d{1,2}\s*[A-Za-z]{3,9}\s*\d{2,4}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Amounts: require decimals or thousands separators so plain ids/descriptions don't match
const AMOUNT_TOKEN = /^-?\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?$|^-?\d+\.\d{1,2}$/;
const AMOUNT_WITH_DRCR = /^(-?\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?)\s*(dr|cr)$/i;
const DRCR_TOKEN = /^(dr|cr)\.?$/i;

const ACCT_PATTERNS: RegExp[] = [
  /a\/c\s*(?:no\.?|number|num)?\s*[:\-]?\s*([xX\*\d][xX\*\d\s]{3,}?\d{4})\b/i,
  /account\s*(?:no\.?|number|num|#)?\s*[:\-]\s*([xX\*\d][xX\*\d\s]{3,}?\d{4})\b/i,
  /account\s*(?:no\.?|number)\s+([xX\*\d][xX\*\d\s]{3,}?\d{4})\b/i,
  /card\s*(?:no\.?|number)?\s*[:\-]?\s*([xX\*]{2,}\s*\d{4})\b/i,
  /\b([xX\*]{4,}\s*\d{4})\b/,
];

const OPENING_BALANCE = /opening\s+balance/i;
const CLOSING_BALANCE = /closing\s+balance/i;

const CREDIT_HINTS = [
  'salary', 'interest', 'deposit', 'refund', 'cashback', 'reversal', 'received',
  'cr by', 'by transfer', 'neft cr', 'imps cr', 'upi cr', 'rtgs cr', 'credit',
  ' /income', 'reimbursement', 'redemption', 'dividend',
];
const DEBIT_HINTS = [
  'withdrawal', 'upi dr', 'neft dr', 'imps dr', 'rtgs dr', 'pos ', 'pos-', 'atm',
  'paid to', 'payment to', 'purchase', 'debit', 'chg', 'charge', 'fee',
  'self transfer', 'billpay', 'ecs', 'nach ',
];

const DEBIT_HEADERS = ['withdrawal amt', 'withdrawal', 'withdrawals', 'debit amount', 'debit amt', 'debit', 'dr', 'withdrawl'];
const CREDIT_HEADERS = ['deposit amt', 'deposit', 'deposits', 'credit amount', 'credit amt', 'credit', 'cr'];
const BALANCE_HEADERS = ['closing balance', 'balance', 'running balance', 'bal'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function norm(s: string): string {
  return s.toLowerCase().replace(/[.]/g, '').replace(/\s+/g, ' ').trim();
}

function parseAmountToken(token: string): number | null {
  const m = token.match(AMOUNT_WITH_DRCR);
  let cleaned = token;
  if (m) cleaned = m[1];
  else if (!AMOUNT_TOKEN.test(token)) return null;
  cleaned = cleaned.replace(/,/g, '');
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.abs(n);
}

function parseDateToken(token: string): string | null {
  const m = token.match(/^(\d{2})[\/-](\d{2})[\/-](\d{2,4})$/);
  if (m) {
    const [, d, mo, yr] = m;
    const y = yr.length === 2 ? `20${yr}` : yr;
    const month = parseInt(mo, 10);
    const day = parseInt(d, 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${y}-${mo}-${d}`;
  }
  const iso = token.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return iso[0];
  const wm = token.match(/^(\d{1,2})\s*([A-Za-z]{3,9})\s*(\d{2,4})$/);
  if (wm) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const mi = months.indexOf(wm[2].slice(0, 3).toLowerCase());
    if (mi === -1) return null;
    let y = wm[3];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${String(mi + 1).padStart(2, '0')}-${wm[1].padStart(2, '0')}`;
  }
  return null;
}

function isDateishToken(t: string): boolean {
  return DATE_TOKEN.test(t) || DATE_WORD.test(t) || ISO_DATE.test(t);
}

interface ColAnchors { debitX: number | null; creditX: number | null; balanceX: number | null }

function headerAnchors(line: StatementLine): ColAnchors | null {
  let debitX: number | null = null;
  let creditX: number | null = null;
  let balanceX: number | null = null;

  const texts = line.items.map(i => norm(i.str));
  for (let i = 0; i < line.items.length; i++) {
    const t = texts[i];
    const pair = i + 1 < texts.length ? `${t} ${texts[i + 1]}` : t;

    if (DEBIT_HEADERS.includes(t) || DEBIT_HEADERS.includes(pair)) {
      if (debitX === null) debitX = line.items[i].x;
      if (DEBIT_HEADERS.includes(pair)) i++;
      continue;
    }
    if (CREDIT_HEADERS.includes(t) || CREDIT_HEADERS.includes(pair)) {
      if (creditX === null) creditX = line.items[i].x;
      if (CREDIT_HEADERS.includes(pair)) i++;
      continue;
    }
    if (BALANCE_HEADERS.includes(t) || BALANCE_HEADERS.includes(pair)) {
      if (balanceX === null) balanceX = line.items[i].x;
      if (BALANCE_HEADERS.includes(pair)) i++;
      continue;
    }
  }

  // A plausible table header needs at least one money column and either balance or the other money column
  const moneyCols = [debitX, creditX].filter(x => x !== null).length;
  if (moneyCols >= 1 && (balanceX !== null || moneyCols === 2)) {
    return { debitX, creditX, balanceX };
  }
  return null;
}

/** Assign a token x-position to the nearest amount column using midpoint regions. */
function assignToColumn(x: number, anchors: ColAnchors): 'debit' | 'credit' | 'balance' | null {
  const cols: { kind: 'debit' | 'credit' | 'balance'; x: number }[] = [];
  if (anchors.debitX !== null) cols.push({ kind: 'debit', x: anchors.debitX });
  if (anchors.creditX !== null) cols.push({ kind: 'credit', x: anchors.creditX });
  if (anchors.balanceX !== null) cols.push({ kind: 'balance', x: anchors.balanceX });
  if (!cols.length) return null;
  cols.sort((a, b) => a.x - b.x);

  let best = cols[0];
  let bestDist = Math.abs(x - best.x);
  for (const c of cols.slice(1)) {
    const d = Math.abs(x - c.x);
    if (d < bestDist) { best = c; bestDist = d; }
  }
  // sanity: too far from every column → untrusted
  if (bestDist > 120) return null;
  return best.kind;
}

function isDateLeadingLine(line: StatementLine): boolean {
  const first = line.items[0]?.str ?? '';
  if (isDateishToken(first)) return true;
  const joined3 = line.items.slice(0, 3).map(it => it.str).join(' ').trim();
  return DATE_WORD.test(joined3) && !!parseDateToken(joined3);
}

function extractAccountMarkers(lines: StatementLine[]): { lineIndex: number; last4: string; type: 'bank_account' | 'credit_card' | 'savings' }[] {
  const markers: { lineIndex: number; last4: string; type: 'bank_account' | 'credit_card' | 'savings' }[] = [];
  for (let i = 0; i < lines.length; i++) {
    // Statement section headers never start with a date; transaction rows do.
    // Narrations may reference "A/C XXXXX7832" (e.g. self transfers) – those
    // are transactions, not account markers.
    if (isDateLeadingLine(lines[i])) continue;
    const text = lines[i].text;
    for (const pattern of ACCT_PATTERNS) {
      const m = text.match(pattern);
      if (!m) continue;
      const digits = m[1].replace(/\D/g, '');
      if (digits.length < 4) continue;
      const last4 = digits.slice(-4);
      const isCard = /card/i.test(text) && !/account/i.test(text);
      // de-dupe same account marker
      if (markers.some(mk => mk.last4 === last4)) continue;
      markers.push({ lineIndex: i, last4, type: isCard ? 'credit_card' : 'bank_account' });
      break;
    }
  }
  return markers;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

let tmpIdCounter = 0;
function tmpId(): string {
  return `pdf-${Date.now().toString(36)}-${(tmpIdCounter++).toString(36)}`;
}

export function parseBankStatement(lines: StatementLine[]): StatementParseResult {
  const warnings: string[] = [];
  tmpIdCounter = 0;

  if (!lines.length) {
    return { bank_name: null, accounts: [], transactions: [], warnings: ['No readable text found in the PDF.'] };
  }

  // 1. Bank detection (scan whole document, first match wins)
  const fullText = lines.map(l => l.text).join('\n').toLowerCase();
  let bankName: string | null = null;
  for (const profile of BANK_PROFILES) {
    if (profile.keywords.some(k => fullText.includes(k))) {
      bankName = profile.displayName;
      break;
    }
  }

  // 2. Account markers
  const markers = extractAccountMarkers(lines);

  const accounts: DetectedStatementAccount[] = markers.map((m, idx) => {
    const name = bankName
      ? `${bankName} ••••${m.last4}`
      : `Account ••••${m.last4}`;
    return {
      key: `acct-${idx}`,
      bank_name: bankName,
      account_number_last4: m.last4,
      type: m.type,
      name,
    };
  });

  // 3. Parse transaction rows with a small state machine
  interface RowDraft {
    date: string;
    items: { x: number; str: string }[]; // non-date items
    dateTokens: number;
    lineIndex: number;
    text: string;
  }

  const rows: ParsedStatementRow[] = [];
  let anchors: ColAnchors | null = null;
  let currentAccountKey: string | null = null;
  let markerCursor = 0;
  let prevBalance: number | null = null;
  let prevRow: ParsedStatementRow | null = null;

  const sortedMarkers = [...markers].sort((a, b) => a.lineIndex - b.lineIndex);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.text;
    const lower = text.toLowerCase();

    // Advance account context when reaching a marker line
    while (markerCursor < sortedMarkers.length && sortedMarkers[markerCursor].lineIndex === i) {
      const accIdx = sortedMarkers.findIndex(
        m => m.last4 === sortedMarkers[markerCursor].last4
      );
      currentAccountKey = accounts[accIdx]?.key ?? null;
      // New statement section: reset running-balance tracking, keep column anchors
      prevBalance = null;
      prevRow = null;
      markerCursor++;
    }
    if (sortedMarkers.some(m => m.lineIndex === i) && !isRowCandidate(line)) {
      // A pure account-marker heading line – consumed, not a transaction
      continue;
    }

    // Table headers update the column anchors
    const newAnchors = headerAnchors(line);
    if (newAnchors) {
      anchors = newAnchors;
      continue;
    }

    // Skip pure noise lines
    if (/page \d+ of \d+/i.test(text) || /^statement (period|of|date)/i.test(lower)) {
      continue;
    }

    // Opening balance line seeds the running balance
    if (OPENING_BALANCE.test(lower)) {
      const amts = line.items.map(it => parseAmountToken(it.str)).filter((n): n is number => n !== null);
      if (amts.length) {
        prevBalance = amts[amts.length - 1];
      }
      continue;
    }
    if (CLOSING_BALANCE.test(lower)) {
      continue;
    }

    if (!isRowCandidate(line)) {
      // Maybe a narration continuation line of the previous row
      const hasAmount = line.items.some(it => parseAmountToken(it.str) !== null);
      if (prevRow && !hasAmount && looksLikeContinuation(line)) {
        prevRow.description = `${prevRow.description} ${line.text}`.replace(/\s+/g, ' ').slice(0, 400);
      }
      continue;
    }

    const parsedRow = parseRow(line, anchors, {
      directionFromDelta: prevBalance,
    });

    if (!parsedRow) continue;

    // Account assignment: current marker context
    if (currentAccountKey) {
      parsedRow.accountKey = currentAccountKey;
    } else if (accounts.length === 1) {
      parsedRow.accountKey = accounts[0].key;
    } else if (accounts.length > 1) {
      parsedRow.accountKey = null; // appears before any account marker
    } else {
      parsedRow.accountKey = null; // no account detected at all
    }

    // Update running balance from this row's trailing balance, if present
    if (parsedRow.balanceAfter !== null) {
      prevBalance = parsedRow.balanceAfter;
    } else if (prevBalance !== null) {
      prevBalance = parsedRow.direction === 'credit'
        ? prevBalance + parsedRow.amount
        : prevBalance - parsedRow.amount;
    }

    rows.push(parsedRow);
    prevRow = parsedRow;
  }

  // 4. Single-account PDFs with a detected bank but no account number: still
  //    provide one account so rows don't need manual assignment.
  if (accounts.length === 0 && rows.length > 0 && bankName) {
    accounts.push({
      key: 'acct-0',
      bank_name: bankName,
      account_number_last4: null,
      type: 'bank_account',
      name: bankName,
    });
    rows.forEach(r => { if (r.accountKey === null) r.accountKey = 'acct-0'; });
  }

  // 5. Transfer classification (needs account list for cross-reference)
  const last4ByKey = new Map(accounts.map(a => [a.key, a.account_number_last4] as const));
  for (const row of rows) {
    const ownLast4 = row.accountKey ? last4ByKey.get(row.accountKey) ?? null : null;
    const otherAccountsLast4 = accounts
      .map(a => a.account_number_last4)
      .filter((l4): l4 is string => !!l4 && l4 !== ownLast4);
    row.type = classifyType(row, otherAccountsLast4);
  }

  // 6. Warnings
  if (rows.length === 0) {
    warnings.push('No transactions could be read from this statement.');
  }
  const unassigned = rows.filter(r => r.accountKey === null).length;
  if (unassigned > 0) {
    warnings.push(`${unassigned} transaction(s) could not be matched to an account and need review before import.`);
  }

  return { bank_name: bankName, accounts, transactions: rows, warnings };
}

// ---------------------------------------------------------------------------
// Row parsing
// ---------------------------------------------------------------------------

/** Merge split-token dates ("01" "/" "08" "/" "2026") and parse the row. */
function parseRow(
  line: StatementLine,
  anchors: ColAnchors | null,
  ctx: { directionFromDelta: number | null },
): ParsedStatementRow | null {
  const items = line.items;
  let dateStr: string | null = null;
  let consumed = 0;

  for (let take = Math.min(3, items.length); take >= 1; take--) {
    const candidate = items.slice(0, take).map(i => i.str).join(take === 3 ? ' ' : '').trim();
    const parsed = parseDateToken(candidate);
    if (parsed) {
      dateStr = parsed;
      consumed = take;
      break;
    }
  }
  if (!dateStr) return null;

  const rest = items.slice(consumed).map(i => ({ x: i.x, str: i.str }));
  if (!rest.length) return null;

  return parseRowItems(dateStr, rest, line.text, anchors, ctx);
}

function isRowCandidate(line: StatementLine): boolean {
  if (!line.items.length) return false;
  const first = line.items[0].str;
  if (isDateishToken(first)) return true;
  // Some statements render "01" "/" "08" "/" "2026" as separate tokens; try joining first 1-3 items
  const joined2 = `${line.items[0].str}${line.items[1]?.str ?? ''}`;
  if (isDateishToken(joined2)) return true;
  const joined3 = `${line.items[0].str} ${line.items[1]?.str ?? ''} ${line.items[2]?.str ?? ''}`.trim();
  return DATE_WORD.test(joined3) && !!parseDateToken(joined3);
}

function looksLikeContinuation(line: StatementLine): boolean {
  const t = line.text;
  if (!t) return false;
  if (/page \d+ of \d+/i.test(t)) return false;
  if (headerAnchors(line)) return false;
  if (OPENING_BALANCE.test(t) || CLOSING_BALANCE.test(t)) return false;
  // not an account marker line
  for (const p of ACCT_PATTERNS) if (p.test(t)) return false;
  return true;
}

function parseRowItems(
  date: string,
  items: { x: number; str: string }[],
  rawText: string,
  anchors: ColAnchors | null,
  ctx: { directionFromDelta: number | null },
): ParsedStatementRow | null {
  // Collect amount tokens with positions and optional Dr/Cr markers
  interface Amt { value: number; x: number; index: number; drcr: 'dr' | 'cr' | null }
  const amounts: Amt[] = [];
  const skipIdx = new Set<number>();

  for (let i = 0; i < items.length; i++) {
    const tok = items[i].str;
    const drcrMatch = tok.match(AMOUNT_WITH_DRCR);
    let value: number | null = null;
    let marker: 'dr' | 'cr' | null = null;

    if (drcrMatch) {
      value = parseAmountToken(tok);
      marker = drcrMatch[2].toLowerCase() as 'dr' | 'cr';
    } else {
      value = parseAmountToken(tok);
      if (value !== null && i + 1 < items.length) {
        const next = items[i + 1].str;
        if (DRCR_TOKEN.test(next)) {
          marker = next.replace('.', '').toLowerCase() as 'dr' | 'cr';
          skipIdx.add(i + 1);
        }
      }
    }
    if (value !== null) {
      amounts.push({ value, x: items[i].x, index: i, drcr: marker });
    }
  }

  if (!amounts.length) return null;

  // Identify transaction amount vs running balance
  let txAmount: Amt | null = null;
  let balanceAfter: number | null = null;
  let direction: 'debit' | 'credit' | null = null;

  // Column-based assignment first (anchor x positions)
  if (anchors) {
    let debitAmt: Amt | null = null;
    let creditAmt: Amt | null = null;
    let balanceAmt: Amt | null = null;
    for (const a of amounts) {
      const kind = assignToColumn(a.x, anchors);
      if (kind === 'debit') debitAmt = debitAmt ?? a;
      else if (kind === 'credit') creditAmt = creditAmt ?? a;
      else if (kind === 'balance') balanceAmt = balanceAmt ?? a;
    }
    if ((debitAmt || creditAmt) && !(debitAmt && creditAmt)) {
      // exactly one side populated: unambiguous
      if (debitAmt) { txAmount = debitAmt; direction = 'debit'; }
      else if (creditAmt) { txAmount = creditAmt; direction = 'credit'; }
      if (balanceAmt) balanceAfter = balanceAmt.value;
    } else if (debitAmt && creditAmt) {
      // both columns have values: take the non-zero one
      if (debitAmt.value > 0 && creditAmt.value === 0) { txAmount = debitAmt; direction = 'debit'; }
      else if (creditAmt.value > 0 && debitAmt.value === 0) { txAmount = creditAmt; direction = 'credit'; }
      else { txAmount = debitAmt.value >= creditAmt.value ? debitAmt : creditAmt; direction = txAmount === debitAmt ? 'debit' : 'credit'; }
      if (balanceAmt) balanceAfter = balanceAmt.value;
    }
  }

  // Fallback: last amount = running balance, first = transaction amount
  if (!txAmount) {
    if (amounts.length >= 2) {
      txAmount = amounts[0];
      const last = amounts[amounts.length - 1];
      if (last !== txAmount) balanceAfter = last.value;
    } else {
      txAmount = amounts[0];
    }
  }

  // Direction fallbacks: explicit Dr/Cr marker on the transaction amount
  if (!direction && txAmount.drcr) {
    direction = txAmount.drcr === 'cr' ? 'credit' : 'debit';
  }

  // Running-balance delta
  if (!direction && balanceAfter !== null && ctx.directionFromDelta !== null) {
    if (balanceAfter > ctx.directionFromDelta + 1e-9) direction = 'credit';
    else if (balanceAfter < ctx.directionFromDelta - 1e-9) direction = 'debit';
  }

  // Keyword hints from the narration
  const descTokens = items
    .filter((it, idx) => !amounts.some(a => a.index === idx) && !skipIdx.has(idx))
    .filter(it => !isDateishToken(it.str))
    .map(it => it.str);
  const description = descTokens.join(' ').replace(/\s+/g, ' ').trim().slice(0, 400);

  if (!direction) {
    const lower = description.toLowerCase();
    if (CREDIT_HINTS.some(h => lower.includes(h))) direction = 'credit';
    else if (DEBIT_HINTS.some(h => lower.includes(h))) direction = 'debit';
  }

  // Statements are mostly debits; default to debit but note it via balance tracking.
  // (Preview always shows the type selector, so the user can flip it.)
  if (!direction) direction = 'debit';

  if (!description) return null;

  return {
    id: tmpId(),
    date,
    description,
    amount: Math.round(txAmount.value * 100) / 100,
    direction,
    type: direction === 'credit' ? 'income' : 'expense', // refined later
    accountKey: null,
    balanceAfter,
    rawLine: rawText,
  };
}

function classifyType(row: ParsedStatementRow, otherAccountsLast4: string[]): 'income' | 'expense' | 'transfer' {
  const desc = row.description;
  if (isSelfTransferDescription(desc)) return 'transfer';
  if (referencesOwnAccountNumber(desc, otherAccountsLast4)) return 'transfer';
  return row.direction === 'credit' ? 'income' : 'expense';
}
