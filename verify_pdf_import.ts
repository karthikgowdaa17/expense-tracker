/**
 * Offline verification for the bank-statement parser (no browser/PDF needed).
 * Run: server/node_modules/.bin/tsx verify_pdf_import.ts
 */
import { parseBankStatement, type StatementLine } from './src/lib/import/bankStatement';

let failures = 0;
function check(label: string, cond: boolean, extra?: unknown) {
  if (cond) console.log(`  ok  ${label}`);
  else { console.error(`FAIL  ${label}`, extra ?? ''); failures++; }
}

function line(page: number, parts: [number, string][]): StatementLine {
  const items = parts.map(([x, str]) => ({ x, str }));
  return {
    page,
    items,
    // emulate pdfText.joinItems (tokens joined by single spaces)
    text: parts.map(p => p[1]).join(' '),
  };
}

// A layout matching a two-account consolidated statement
const HEADER: [number, string][] = [[10, 'Date'], [80, 'Narration'], [360, 'Withdrawal Amt.'], [450, 'Deposit Amt.'], [560, 'Closing Balance']];

const lines: StatementLine[] = [
  line(1, [[10, 'HDFC BANK LTD'], [300, 'Statement of accounts']]),
  line(1, [[10, 'Account No : 5010045210001']]),

  line(1, HEADER),
  line(1, [[10, 'Opening Balance'], [560, '10,000.00']]),

  // account 1: salary credit
  line(1, [[10, '01/08/2026'], [80, 'SALARY CRED - ACME CORP'], [450, '65,000.00'], [560, '75,000.00']]),
  // account 1: debit via columns
  line(1, [[10, '02/08/2026'], [80, 'UPI-SWIGGY-ORDER 1234'], [360, '450.00'], [560, '74,550.00']]),
  // account 1: self transfer out referencing the other account 7832
  line(1, [[10, '03/08/2026'], [80, 'NEFT TO SELF A/C XXXXX7832'], [360, '10,000.00'], [560, '64,550.00']]),
  // continuation narration line (no date)
  line(1, [[80, 'Ref IMPS/123456789']]),

  // second account section
  line(1, [[10, 'Account Number: XXXXX7832']]),
  line(1, HEADER),
  // credit leg of the transfer (self)
  line(1, [[10, '03/08/2026'], [80, 'NEFT FROM SELF XXXXX0001'], [450, '10,000.00'], [560, '20,000.00']]),
  // debit, no anchors changed: should still use columns
  line(1, [[10, '04/08/2026'], [80, 'UPI-UBER RIDES'], [360, '220.00'], [560, '19,780.00']]),
  // single amount with Dr marker
  line(1, [[10, '05/08/2026'], [80, 'ATM CASH WITHDRAWAL'], [360, '2,000.00'], [365, 'Dr'], [560, '17,780.00']]),
];

const result = parseBankStatement(lines);

console.log('\nAccounts detected:', result.accounts.map(a => a.name));
console.log('Transactions parsed:', result.transactions.length);
for (const warnings of result.warnings) console.log('warning:', warnings);

check('bank detected as HDFC Bank', result.bank_name === 'HDFC Bank', result.bank_name);
check('2 accounts detected', result.accounts.length === 2, result.accounts);
check(
  'accounts last4 are 0001 and 7832',
  result.accounts.map(a => a.account_number_last4).sort().join(',') === '0001,7832',
  result.accounts.map(a => a.account_number_last4),
);
check('full account numbers are never stored', result.accounts.every(a => !/5010045210001/.test(JSON.stringify(a))));

const rows = result.transactions;
check('6 transactions parsed', rows.length === 6, rows.length);

const salary = rows.find(r => r.description.includes('SALARY CRED'));
check('salary assigned to acct-0', !!salary && salary.accountKey === 'acct-0', salary);
check('salary is credit/income 65000', !!salary && salary.direction === 'credit' && salary.type === 'income' && salary.amount === 65000, salary);

const swiggy = rows.find(r => r.description.startsWith('UPI-SWIGGY'));
check('swiggy debit expense 450 on acct-0', !!swiggy && swiggy.direction === 'debit' && swiggy.type === 'expense' && swiggy.amount === 450 && swiggy.accountKey === 'acct-0', swiggy);

const tfrOut = rows.find(r => r.description.includes('NEFT TO SELF'));
check('transfer out flagged as transfer on acct-0', !!tfrOut && tfrOut.type === 'transfer' && tfrOut.direction === 'debit' && tfrOut.accountKey === 'acct-0', tfrOut);

const tfrIn = rows.find(r => r.description.includes('NEFT FROM SELF'));
check('transfer in flagged as transfer on acct-1', !!tfrIn && tfrIn.type === 'transfer' && tfrIn.direction === 'credit' && tfrIn.accountKey === 'acct-1', tfrIn);

const uber = rows.find(r => r.description.includes('UBER'));
check('uber debit expense on acct-1', !!uber && uber.direction === 'debit' && uber.type === 'expense' && uber.accountKey === 'acct-1' && uber.amount === 220, uber);

const atm = rows.find(r => r.description.includes('ATM CASH'));
check('atm row uses Dr marker as debit', !!atm && atm.direction === 'debit' && atm.amount === 2000, atm);

check('continuation line did not create a transaction', !rows.some(r => r.description === 'Ref IMPS/123456789'));
check('balance tracked', !!swiggy && swiggy.balanceAfter === 74550, swiggy);

console.log(failures === 0 ? '\nALL PDF PARSER CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
