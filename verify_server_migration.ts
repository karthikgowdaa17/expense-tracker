/**
 * Offline verification of migration 004 (multi-account support) against a
 * throwaway SQLite database seeded with legacy-style data.
 *
 * Run: server/node_modules/.bin/tsx verify_server_migration.ts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const serverMigrations = path.join(repoRoot, 'server/src/persistence/migrations');

interface AccountRow {
  id: string;
  user_id: string;
  name: string;
  account_number_last4: string | null;
  created_at: string;
}
interface TxRow {
  id: string;
  account_id: string | null;
  transfer_direction: string;
}

let failures = 0;
function check(label: string, cond: boolean, extra?: unknown) {
  if (cond) console.log(`  ok  ${label}`);
  else { console.error(`FAIL  ${label}`, extra ?? ''); failures++; }
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'expense-tracker-mig-'));
  // Layout expected by db.ts / migrationRunner.ts: <cwd>/src/persistence/migrations
  const targetMigDir = path.join(tmp, 'src/persistence/migrations');
  fs.mkdirSync(targetMigDir, { recursive: true });
  for (const f of fs.readdirSync(serverMigrations).filter(f => f <= '003')) {
    fs.copyFileSync(path.join(serverMigrations, f), path.join(targetMigDir, f));
  }
  process.chdir(tmp);

  const { runMigrations } = await import('./server/src/persistence/migrationRunner');
  const { db } = await import('./server/src/persistence/db');

  // --- Phase 1: run 001-003, then seed legacy data -------------------------
  runMigrations();

  const uidA = '11111111-1111-1111-1111-111111111111';
  const uidB = '22222222-2222-2222-2222-222222222222';
  const now = new Date().toISOString();

  const insUser = db.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, 'x')");
  insUser.run(uidA, 'a@example.com');
  insUser.run(uidB, 'b@example.com');

  const insTx = db.prepare(`INSERT INTO transactions
    (id, user_id, date, type, amount, category, description, payment_method, account, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'upi', ?, ?, ?, ?)`);

  insTx.run('t-a1', uidA, '2026-08-01', 'expense', 59, 'Bills & Utilities', 'Payment to Google', 'bank_account',
    'PhonePe import | Source account: XXXXXX8750 | Time: 08:55 pm', now, now);
  insTx.run('t-a2', uidA, '2026-08-02', 'expense', 20, 'Food & Dining', 'Sugar Cane Juice', 'bank_account',
    'PhonePe import | Source account: XXXXXX7832 | Time: 08:12 pm', now, now);
  insTx.run('t-a3', uidA, '2026-08-03', 'expense', 140, 'Food & Dining', 'Madhabi', 'bank_account',
    'PhonePe import | Source account: XXXXXX8750 | Time: 08:11 pm', now, now);
  insTx.run('t-a4', uidA, '2026-08-04', 'expense', 300, 'Shopping', 'Street vendor', 'cash', '', now, now);
  insTx.run('t-a5', uidA, '2026-08-05', 'transfer', 10000, 'Other', 'Self transfer to ICICI', 'bank_account', '', now, now);

  insTx.run('t-b1', uidB, '2026-08-01', 'expense', 99, 'Other', 'B row', 'bank_account', '', now, now);

  // --- Phase 2: add 004 and re-run -----------------------------------------
  fs.copyFileSync(
    path.join(serverMigrations, '004_multi_account_support.sql'),
    path.join(targetMigDir, '004_multi_account_support.sql'),
  );
  runMigrations();

  // --- Assertions: accounts ------------------------------------------------
  const accA = db.prepare('SELECT * FROM accounts WHERE user_id = ?').all(uidA) as AccountRow[];
  const accB = db.prepare('SELECT * FROM accounts WHERE user_id = ?').all(uidB) as AccountRow[];

  const namesA = accA.map(a => a.name).sort();
  check('user A has PhonePe 8750 account', namesA.includes('PhonePe ••••8750'), namesA);
  check('user A has PhonePe 7832 account', namesA.includes('PhonePe ••••7832'), namesA);
  check('user A has Cash account', namesA.includes('Cash'), namesA);
  check('user A has Bank Account account', namesA.includes('Bank Account'), namesA);
  const acc7832 = accA.find(a => a.name === 'PhonePe ••••7832');
  check('phonepe account stores last4 only', acc7832?.account_number_last4 === '7832', acc7832);
  check('user B got its own Bank Account (tenant isolation)', accB.length === 1 && accB[0].name === 'Bank Account', accB);

  // --- Assertions: transaction links ----------------------------------------
  const txOf = (id: string) => db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as TxRow | undefined;
  const accId = (n: string) => accA.find(a => a.name === n)?.id ?? '';

  check('t-a1 linked to PhonePe 8750', txOf('t-a1')?.account_id === accId('PhonePe ••••8750'), txOf('t-a1')?.account_id);
  check('t-a2 linked to PhonePe 7832', txOf('t-a2')?.account_id === accId('PhonePe ••••7832'), txOf('t-a2')?.account_id);
  check('t-a3 linked to PhonePe 8750', txOf('t-a3')?.account_id === accId('PhonePe ••••8750'), txOf('t-a3')?.account_id);
  check('t-a4 (cash) linked to Cash', txOf('t-a4')?.account_id === accId('Cash'), txOf('t-a4')?.account_id);
  check('t-a5 (bank_account, no notes) linked to Bank Account', txOf('t-a5')?.account_id === accId('Bank Account'), txOf('t-a5')?.account_id);
  check('t-b1 linked within user B only', txOf('t-b1')?.account_id === accB[0].id, txOf('t-b1')?.account_id);
  check('transfer_direction defaults to out', txOf('t-a5')?.transfer_direction === 'out', txOf('t-a5')?.transfer_direction);

  // --- Idempotency: running everything again must not duplicate accounts ----
  runMigrations();
  const accAAfter = db.prepare('SELECT * FROM accounts WHERE user_id = ?').all(uidA) as AccountRow[];
  check('re-running migrations is idempotent', accAAfter.length === accA.length, { before: accA.length, after: accAAfter.length });

  // --- Repositories ----------------------------------------------------------
  const { accountsRepository, deleteAccountSafely } = await import('./server/src/repositories/accountsRepository');
  accountsRepository.ensureDefaults(uidA);
  const afterDefaults = db.prepare('SELECT * FROM accounts WHERE user_id = ?').all(uidA) as AccountRow[];
  check('ensureDefaults adds only the missing Credit Card default',
    afterDefaults.length === accAAfter.length + 1 && afterDefaults.some(a => a.name === 'Credit Card'),
    { before: accAAfter.length, after: afterDefaults.length });
  accountsRepository.ensureDefaults(uidA);
  const afterSecondRun = db.prepare('SELECT COUNT(*) c FROM accounts WHERE user_id = ?').get(uidA) as { c: number };
  check('ensureDefaults is idempotent', afterSecondRun.c === afterDefaults.length, afterSecondRun);

  // safe delete: unassign keeps the transaction
  const del1 = deleteAccountSafely(uidA, accId('PhonePe ••••7832'), 'unassign');
  check('unassign mode succeeds', del1.ok && del1.affected === 1, del1);
  check('transaction survives unassign, link cleared',
    txOf('t-a2') !== undefined && txOf('t-a2')?.account_id === null, txOf('t-a2')?.account_id);

  // reassign mode
  const del2 = deleteAccountSafely(uidA, accId('PhonePe ••••8750'), 'reassign', accId('Bank Account'));
  check('reassign mode succeeds', del2.ok && del2.affected === 2, del2);
  check('t-a1 reassign target', txOf('t-a1')?.account_id === accId('Bank Account'), txOf('t-a1')?.account_id);

  // delete mode
  const txCountBefore = (db.prepare('SELECT COUNT(*) c FROM transactions WHERE user_id = ?').get(uidA) as { c: number }).c;
  const del3 = deleteAccountSafely(uidA, accId('Bank Account'), 'delete');
  const txCountAfter = (db.prepare('SELECT COUNT(*) c FROM transactions WHERE user_id = ?').get(uidA) as { c: number }).c;
  check('delete mode removes its transactions', del3.ok && txCountAfter === txCountBefore - del3.affected, { del3, txCountBefore, txCountAfter });

  // cross-user protections
  const delBad = deleteAccountSafely(uidA, accB[0]?.id ?? 'nope', 'delete');
  check('cannot delete another user\'s account', !delBad.ok && delBad.error === 'not_found', delBad);
  check('user B account still exists', !!accountsRepository.getById(accB[0].id));

  console.log(failures === 0 ? '\nALL MIGRATION CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
