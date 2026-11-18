import { db } from '../persistence/db.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'node:crypto';
function generateFingerprint(userId, tx) {
    const src = `${userId}|${tx.date}|${tx.type}|${tx.amount}|${tx.description}`;
    return crypto.createHash('md5').update(src).digest('hex');
}
function rowToTx(row) {
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
    listByUser(userId, filters = {}) {
        let sql = 'SELECT * FROM transactions WHERE user_id = ?';
        const params = [userId];
        if (filters.dateFrom) {
            sql += ' AND date >= ?';
            params.push(filters.dateFrom);
        }
        if (filters.dateTo) {
            sql += ' AND date <= ?';
            params.push(filters.dateTo);
        }
        if (filters.type) {
            sql += ' AND type = ?';
            params.push(filters.type);
        }
        if (filters.category) {
            sql += ' AND category = ?';
            params.push(filters.category);
        }
        if (filters.paymentMethod) {
            sql += ' AND payment_method = ?';
            params.push(filters.paymentMethod);
        }
        if (filters.account) {
            sql += ' AND account = ?';
            params.push(filters.account);
        }
        if (filters.search) {
            sql += ' AND (description LIKE ? OR category LIKE ? OR notes LIKE ?)';
            const term = `%${filters.search}%`;
            params.push(term, term, term);
        }
        sql += ' ORDER BY date DESC';
        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
        }
        if (filters.offset) {
            sql += ' OFFSET ?';
            params.push(filters.offset);
        }
        const rows = db.prepare(sql).all(...params);
        return rows.map(rowToTx);
    },
    getById(id) {
        const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
        return row ? rowToTx(row) : undefined;
    },
    create(userId, data) {
        const id = uuidv4();
        const now = new Date().toISOString();
        const fingerprint = generateFingerprint(userId, data);
        const stmt = db.prepare(`
      INSERT INTO transactions (id, user_id, date, type, amount, category, subcategory, description,
        payment_method, account, notes, is_recurring, recurring_id, split_from, fingerprint, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, userId, data.date, data.type, data.amount, data.category, data.subcategory ?? null, data.description, data.payment_method, data.account, data.notes ?? null, data.is_recurring ? 1 : 0, data.recurring_id ?? null, data.split_from ?? null, fingerprint, now, now);
        return this.getById(id);
    },
    update(id, data) {
        const sets = [];
        const params = [];
        const allowed = ['date', 'type', 'amount', 'category', 'subcategory', 'description', 'payment_method', 'account', 'notes', 'is_recurring', 'recurring_id', 'split_from'];
        for (const key of allowed) {
            if (data[key] !== undefined) {
                sets.push(`${key} = ?`);
                params.push(data[key]);
            }
        }
        if (!sets.length)
            return this.getById(id);
        sets.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(id);
        db.prepare(`UPDATE transactions SET ${sets.join(', ')} WHERE id = ?`).run(...params);
        return this.getById(id);
    },
    delete(id) {
        const result = db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
        return result.changes > 0;
    },
    getByFingerprint(userId, fingerprint) {
        const row = db.prepare('SELECT * FROM transactions WHERE user_id = ? AND fingerprint = ?').get(userId, fingerprint);
        return row ? rowToTx(row) : undefined;
    },
};
//# sourceMappingURL=transactionsRepository.js.map