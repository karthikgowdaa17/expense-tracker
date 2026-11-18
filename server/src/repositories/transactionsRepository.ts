import { db } from '../persistence/db.js';
import type { TransactionInput } from '../validation/schemas.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'node:crypto';

function generateFingerprint(userId: string, tx: TransactionInput) {
  // Account identity is part of the fingerprint so an identical-looking
  // transaction in two different accounts is NOT treated as a duplicate.
  const accountKey = (tx.account_id || tx.account || '').toLowerCase().trim();
  const payment = (tx.payment_method || '').toLowerCase().trim();
  const amount = Math.round(Number(tx.amount) * 100) / 100;
  const src = `${userId}|${tx.date}|${tx.type}|${amount.toFixed(2)}|${tx.description.trim().toLowerCase()}|${payment}|${accountKey}`;
  return crypto.createHash('md5').update(src).digest('hex');
}

function rowToTx(row: any) {
  return {
    id: row.id,
    user_id: row.user_id,
    date: row.date,
    type: row.type,
    amount: row.amount,
    category: row.category,
    subcategory: row.subcategory,
    description: row.description,
    payment_method: row.payment_method,
    account: row.account,
    account_id: row.account_id ?? null,
    transfer_direction: row.transfer_direction ?? 'out',
    notes: row.notes,
    is_recurring: Boolean(row.is_recurring),
    recurring_id: row.recurring_id,
    split_from: row.split_from,
    fingerprint: row.fingerprint,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const transactionsRepository = {
  listByUser(userId: string, filters: {
    dateFrom?: string;
    dateTo?: string;
    type?: string;
    category?: string;
    paymentMethod?: string;
    account?: string;
    accountId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    let sql = 'SELECT * FROM transactions WHERE user_id = ?';
    const params: any[] = [userId];
    if (filters.dateFrom) { sql += ' AND date >= ?'; params.push(filters.dateFrom); }
    if (filters.dateTo) { sql += ' AND date <= ?'; params.push(filters.dateTo); }
    if (filters.type) { sql += ' AND type = ?'; params.push(filters.type); }
    if (filters.category) { sql += ' AND category = ?'; params.push(filters.category); }
    if (filters.paymentMethod) { sql += ' AND payment_method = ?'; params.push(filters.paymentMethod); }
    if (filters.account) { sql += ' AND account = ?'; params.push(filters.account); }
    if (filters.accountId === 'unassigned') {
      sql += ' AND account_id IS NULL';
    } else if (filters.accountId) {
      sql += ' AND account_id = ?'; params.push(filters.accountId);
    }
    if (filters.search) {
      sql += ' AND (description LIKE ? OR category LIKE ? OR notes LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }
    sql += ' ORDER BY date DESC';
    if (filters.limit) { sql += ' LIMIT ?'; params.push(filters.limit); }
    if (filters.offset) { sql += ' OFFSET ?'; params.push(filters.offset); }
    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(rowToTx);
  },
  getById(id: string) {
    const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as any | undefined;
    return row ? rowToTx(row) : undefined;
  },
  getByIdForUser(id: string, userId: string) {
    const row = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(id, userId) as any | undefined;
    return row ? rowToTx(row) : undefined;
  },
  create(userId: string, data: TransactionInput) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const fingerprint = generateFingerprint(userId, data);
    const stmt = db.prepare(`
      INSERT INTO transactions (id, user_id, date, type, amount, category, subcategory, description,
        payment_method, account, account_id, transfer_direction, notes, is_recurring, recurring_id, split_from, fingerprint, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, userId, data.date, data.type, data.amount, data.category, data.subcategory ?? null,
      data.description, data.payment_method, data.account, data.account_id ?? null,
      data.type === 'transfer' ? (data.transfer_direction ?? 'out') : 'out',
      data.notes ?? null,
      data.is_recurring ? 1 : 0, data.recurring_id ?? null, data.split_from ?? null,
      fingerprint, now, now
    );
    return this.getById(id)!;
  },
  update(id: string, userId: string, data: Partial<TransactionInput>) {
    const sets: string[] = [];
    const params: any[] = [];
    const allowed = ['date','type','amount','category','subcategory','description','payment_method','account','account_id','transfer_direction','notes','is_recurring','recurring_id','split_from'];
    for (const key of allowed) {
      if ((data as any)[key] !== undefined) {
        sets.push(`${key} = ?`);
        params.push((data as any)[key]);
      }
    }
    if (!sets.length) return this.getByIdForUser(id, userId);
    sets.push('fingerprint = ?');

    const merged = { ...this.getByIdForUser(id, userId), ...data } as TransactionInput;
    params.push(generateFingerprint(userId, merged));
    sets.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id, userId);
    db.prepare(`UPDATE transactions SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...params);
    return this.getByIdForUser(id, userId);
  },
  delete(id: string, userId: string) {
    const result = db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(id, userId);
    return result.changes > 0;
  },
  getByFingerprint(userId: string, fingerprint: string) {
    const row = db.prepare('SELECT * FROM transactions WHERE user_id = ? AND fingerprint = ?').get(userId, fingerprint) as any | undefined;
    return row ? rowToTx(row) : undefined;
  },
};
