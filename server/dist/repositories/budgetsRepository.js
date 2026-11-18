import { db } from '../persistence/db.js';
import { v4 as uuidv4 } from 'uuid';
function rowToBudget(row) {
    return {
        id: row.id,
        user_id: row.user_id,
        category_id: row.category_id,
        month: row.month,
        amount: row.amount,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}
export const budgetsRepository = {
    listByUser(userId, month) {
        let sql = 'SELECT * FROM budgets WHERE user_id = ?';
        const params = [userId];
        if (month) {
            sql += ' AND month = ?';
            params.push(month);
        }
        sql += ' ORDER BY month DESC';
        const rows = db.prepare(sql).all(...params);
        return rows.map(rowToBudget);
    },
    getById(id) {
        const row = db.prepare('SELECT * FROM budgets WHERE id = ?').get(id);
        return row ? rowToBudget(row) : undefined;
    },
    create(userId, data) {
        const id = uuidv4();
        const now = new Date().toISOString();
        const stmt = db.prepare(`
      INSERT INTO budgets (id, user_id, category_id, month, amount, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, userId, data.category_id, data.month, data.amount, data.notes ?? null, now, now);
        return this.getById(id);
    },
    update(id, data) {
        const sets = [];
        const params = [];
        if (data.amount !== undefined) {
            sets.push('amount = ?');
            params.push(data.amount);
        }
        if (data.notes !== undefined) {
            sets.push('notes = ?');
            params.push(data.notes);
        }
        if (!sets.length)
            return this.getById(id);
        sets.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(id);
        db.prepare(`UPDATE budgets SET ${sets.join(', ')} WHERE id = ?`).run(...params);
        return this.getById(id);
    },
    delete(id) {
        const result = db.prepare('DELETE FROM budgets WHERE id = ?').run(id);
        return result.changes > 0;
    },
};
//# sourceMappingURL=budgetsRepository.js.map