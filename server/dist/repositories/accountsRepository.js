import { db } from '../persistence/db.js';
import { v4 as uuidv4 } from 'uuid';
function rowToAccount(row) {
    return {
        id: row.id,
        user_id: row.user_id,
        name: row.name,
        type: row.type,
        opening_balance: row.opening_balance,
        currency: row.currency,
        is_active: Boolean(row.is_active),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}
export const accountsRepository = {
    listByUser(userId) {
        const rows = db.prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at').all(userId);
        return rows.map(rowToAccount);
    },
    getById(id) {
        const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
        return row ? rowToAccount(row) : undefined;
    },
    create(userId, data) {
        const id = uuidv4();
        const now = new Date().toISOString();
        const stmt = db.prepare(`
      INSERT INTO accounts (id, user_id, name, type, opening_balance, currency, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, userId, data.name, data.type, data.opening_balance ?? 0, data.currency ?? 'INR', data.is_active ? 1 : 0, now, now);
        return this.getById(id);
    },
    update(id, data) {
        const sets = [];
        const params = [];
        if (data.name !== undefined) {
            sets.push('name = ?');
            params.push(data.name);
        }
        if (data.type !== undefined) {
            sets.push('type = ?');
            params.push(data.type);
        }
        if (data.opening_balance !== undefined) {
            sets.push('opening_balance = ?');
            params.push(data.opening_balance);
        }
        if (data.currency !== undefined) {
            sets.push('currency = ?');
            params.push(data.currency);
        }
        if (data.is_active !== undefined) {
            sets.push('is_active = ?');
            params.push(data.is_active ? 1 : 0);
        }
        if (!sets.length)
            return this.getById(id);
        sets.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(id);
        db.prepare(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ?`).run(...params);
        return this.getById(id);
    },
    delete(id) {
        const result = db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
        return result.changes > 0;
    },
};
//# sourceMappingURL=accountsRepository.js.map