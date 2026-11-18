import { db } from '../persistence/db.js';
import { v4 as uuidv4 } from 'uuid';
function rowToSettings(row) {
    return {
        id: row.id,
        user_id: row.user_id,
        currency: row.currency,
        theme: row.theme,
        financial_year_start_month: row.financial_year_start_month,
        default_categories: row.default_categories,
        default_payment_methods: row.default_payment_methods,
        default_accounts: row.default_accounts,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}
export const userSettingsRepository = {
    getByUser(userId) {
        const row = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
        return row ? rowToSettings(row) : undefined;
    },
    getOrCreate(userId) {
        let settings = this.getByUser(userId);
        if (settings)
            return settings;
        const now = new Date().toISOString();
        const id = uuidv4();
        const stmt = db.prepare(`
      INSERT INTO user_settings (id, user_id, currency, theme, financial_year_start_month, default_categories, default_payment_methods, default_accounts, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, userId, 'INR', 'system', 4, '[]', '[]', '[]', now, now);
        return this.getByUser(userId);
    },
    upsert(userId, data) {
        const now = new Date().toISOString();
        const existing = this.getByUser(userId);
        if (existing) {
            const stmt = db.prepare(`
        UPDATE user_settings SET
          currency = COALESCE(?, currency),
          theme = COALESCE(?, theme),
          financial_year_start_month = COALESCE(?, financial_year_start_month),
          default_categories = COALESCE(?, default_categories),
          default_payment_methods = COALESCE(?, default_payment_methods),
          default_accounts = COALESCE(?, default_accounts),
          updated_at = ?
        WHERE user_id = ?
      `);
            stmt.run(data.currency ?? null, data.theme ?? null, data.financial_year_start_month ?? null, JSON.stringify(data.default_categories ?? []), JSON.stringify(data.default_payment_methods ?? []), JSON.stringify(data.default_accounts ?? []), now, userId);
        }
        else {
            const id = uuidv4();
            const stmt = db.prepare(`
        INSERT INTO user_settings (id, user_id, currency, theme, financial_year_start_month, default_categories, default_payment_methods, default_accounts, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            stmt.run(id, userId, data.currency ?? 'INR', data.theme ?? 'system', data.financial_year_start_month ?? 4, JSON.stringify(data.default_categories ?? []), JSON.stringify(data.default_payment_methods ?? []), JSON.stringify(data.default_accounts ?? []), now, now);
        }
        return this.getByUser(userId);
    },
};
//# sourceMappingURL=userSettingsRepository.js.map