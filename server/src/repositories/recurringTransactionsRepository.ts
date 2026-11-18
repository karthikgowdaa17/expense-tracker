import { db } from '../persistence/db.js';
import type { RecurringTransactionInput } from '../validation/schemas.js';
import { v4 as uuidv4 } from 'uuid';

function rowToRec(row: any) {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    amount: row.amount,
    category: row.category,
    subcategory: row.subcategory,
    description: row.description,
    frequency: row.frequency,
    start_date: row.start_date,
    end_date: row.end_date,
    payment_method: row.payment_method,
    account: row.account,
    day_of_month: row.day_of_month,
    day_of_week: row.day_of_week,
    is_active: Boolean(row.is_active),
    last_generated: row.last_generated,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const recurringTransactionsRepository = {
  listByUser(userId: string) {
    const rows = db.prepare('SELECT * FROM recurring_transactions WHERE user_id = ? ORDER BY created_at DESC').all(userId) as any[];
    return rows.map(rowToRec);
  },
  getById(id: string) {
    const row = db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').get(id) as any | undefined;
    return row ? rowToRec(row) : undefined;
  },
  create(userId: string, data: RecurringTransactionInput) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO recurring_transactions (id, user_id, name, amount, category, subcategory, description,
        frequency, start_date, end_date, payment_method, account, day_of_month, day_of_week, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, userId, data.name, data.amount, data.category, data.subcategory ?? null, data.description ?? null,
      data.frequency, data.start_date, data.end_date ?? null, data.payment_method, data.account,
      data.day_of_month ?? null, data.day_of_week ?? null, data.is_active ? 1 : 0, now, now
    );
    return this.getById(id)!;
  },
  update(id: string, data: Partial<RecurringTransactionInput>) {
    const sets: string[] = [];
    const params: any[] = [];
    const allowed = ['name','amount','category','subcategory','description','frequency','start_date','end_date','payment_method','account','day_of_month','day_of_week','is_active'];
    for (const key of allowed) {
      if ((data as any)[key] !== undefined) {
        sets.push(`${key} = ?`);
        params.push((data as any)[key]);
      }
    }
    if (!sets.length) return this.getById(id);
    sets.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);
    db.prepare(`UPDATE recurring_transactions SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return this.getById(id);
  },
  delete(id: string) {
    const result = db.prepare('DELETE FROM recurring_transactions WHERE id = ?').run(id);
    return result.changes > 0;
  },
  toggleActive(id: string) {
    const row = db.prepare('SELECT is_active FROM recurring_transactions WHERE id = ?').get(id) as any | undefined;
    if (!row) return undefined;
    const newVal = row.is_active ? 0 : 1;
    db.prepare('UPDATE recurring_transactions SET is_active = ?, updated_at = ? WHERE id = ?').run(newVal, new Date().toISOString(), id);
    return this.getById(id);
  },
};