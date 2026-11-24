import { db } from '../persistence/db.js';
import { v4 as uuidv4 } from 'uuid';
function rowToAccount(row) {
    return {
        id: row.id,
        user_id: row.user_id,
        name: row.name,
        type: row.type,
        bank_name: row.bank_name ?? null,
        account_number_last4: row.account_number_last4 ?? null,
        opening_balance: row.opening_balance,
        currency: row.currency,
        is_active: Boolean(row.is_active),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}
const DEFAULT_ACCOUNTS = [
    { name: 'Cash', type: 'cash' },
    { name: 'Bank Account', type: 'bank_account' },
    { name: 'Credit Card', type: 'credit_card' },
];
export const accountsRepository = {
    listByUser(userId) {
        const rows = db.prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at').all(userId);
        return rows.map(rowToAccount);
    },
    getById(id) {
        const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
        return row ? rowToAccount(row) : undefined;
    },
    /** Same as getById but proves the account belongs to the user. */
    getByIdForUser(id, userId) {
        const row = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(id, userId);
        return row ? rowToAccount(row) : undefined;
    },
    /** Find an account by exact name (case-insensitive) for a user. */
    findByName(userId, name) {
        const row = db.prepare('SELECT * FROM accounts WHERE user_id = ? AND lower(name) = lower(?)').get(userId, name);
        return row ? rowToAccount(row) : undefined;
    },
    /** Find a bank account by bank + last four digits of the account number. */
    findByBankAndLast4(userId, bankName, last4) {
        if (!last4)
            return undefined;
        let row;
        if (bankName) {
            row = db.prepare('SELECT * FROM accounts WHERE user_id = ? AND account_number_last4 = ? AND lower(bank_name) = lower(?)').get(userId, last4, bankName);
            if (row)
                return rowToAccount(row);
        }
        row = db.prepare('SELECT * FROM accounts WHERE user_id = ? AND account_number_last4 = ?').get(userId, last4);
        return row ? rowToAccount(row) : undefined;
    },
    /** Provision the same default accounts the app has always used, once per user. */
    ensureDefaults(userId) {
        const now = new Date().toISOString();
        const stmt = db.prepare('INSERT OR IGNORE INTO accounts (id, user_id, name, type, opening_balance, currency, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, 1, ?, ?)');
        for (const acc of DEFAULT_ACCOUNTS) {
            stmt.run(uuidv4(), userId, acc.name, acc.type, 'INR', now, now);
        }
    },
    create(userId, data) {
        const id = uuidv4();
        const now = new Date().toISOString();
        const stmt = db.prepare(`
      INSERT INTO accounts (id, user_id, name, type, bank_name, account_number_last4, opening_balance, currency, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, userId, data.name, data.type, data.bank_name ?? null, data.account_number_last4 ?? null, data.opening_balance ?? 0, data.currency ?? 'INR', data.is_active ? 1 : 0, now, now);
        return this.getById(id);
    },
    /** Returns the existing account or creates it. Never duplicates per user. */
    findOrCreate(userId, data) {
        const byIdentity = this.findByBankAndLast4(userId, data.bank_name ?? null, data.account_number_last4 ?? null);
        if (byIdentity)
            return byIdentity;
        const byName = this.findByName(userId, data.name);
        if (byName)
            return byName;
        try {
            return this.create(userId, data);
        }
        catch (err) {
            // UNIQUE(user_id, name) race – another request created it first
            const existing = this.findByName(userId, data.name);
            if (existing)
                return existing;
            throw err;
        }
    },
    update(id, userId, data) {
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
        if (data.bank_name !== undefined) {
            sets.push('bank_name = ?');
            params.push(data.bank_name);
        }
        if (data.account_number_last4 !== undefined) {
            sets.push('account_number_last4 = ?');
            params.push(data.account_number_last4);
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
            return this.getByIdForUser(id, userId);
        sets.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(id, userId);
        db.prepare(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...params);
        return this.getByIdForUser(id, userId);
    },
    delete(id, userId) {
        const result = db.prepare('DELETE FROM accounts WHERE id = ? AND user_id = ?').run(id, userId);
        return result.changes > 0;
    },
};
/**
 * Remove an account without silently losing its transactions.
 *  - unassign (default): transactions keep all data, account link is cleared
 *  - reassign: transactions move to another account of the same user
 *  - delete:  transactions of the account are deleted explicitly by the caller's choice
 */
export function deleteAccountSafely(userId, accountId, mode, reassignTo) {
    const account = accountsRepository.getByIdForUser(accountId, userId);
    if (!account)
        return { ok: false, affected: 0, error: 'not_found' };
    if (mode === 'reassign') {
        if (!reassignTo || reassignTo === accountId)
            return { ok: false, affected: 0, error: 'invalid_target' };
        const target = accountsRepository.getByIdForUser(reassignTo, userId);
        if (!target)
            return { ok: false, affected: 0, error: 'target_not_found' };
    }
    const run = db.transaction(() => {
        let affected = 0;
        if (mode === 'reassign') {
            const r = db.prepare('UPDATE transactions SET account_id = ?, account = ?, updated_at = ? WHERE user_id = ? AND account_id = ?')
                .run(reassignTo, accountsRepository.getByIdForUser(reassignTo, userId).name, new Date().toISOString(), userId, accountId);
            affected = r.changes;
        }
        else if (mode === 'delete') {
            const r = db.prepare('DELETE FROM transactions WHERE user_id = ? AND account_id = ?').run(userId, accountId);
            affected = r.changes;
        }
        else {
            // unassign: clear the FK, keep the legacy account label untouched
            const r = db.prepare('UPDATE transactions SET account_id = NULL, updated_at = ? WHERE user_id = ? AND account_id = ?')
                .run(new Date().toISOString(), userId, accountId);
            affected = r.changes;
        }
        accountsRepository.delete(accountId, userId);
        return affected;
    });
    const affected = run();
    return { ok: true, affected };
}
//# sourceMappingURL=accountsRepository.js.map