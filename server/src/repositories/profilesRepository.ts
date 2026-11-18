import { db } from '../persistence/db.js';
import type { ProfileInput } from '../validation/schemas.js';

export const profilesRepository = {
  getById(id: string) {
    return db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as any | undefined;
  },
  upsert(id: string, data: ProfileInput) {
    const now = new Date().toISOString();
    const existing = this.getById(id);
    if (existing) {
      const stmt = db.prepare(`
        UPDATE profiles SET
          full_name = COALESCE(?, full_name),
          avatar_url = COALESCE(?, avatar_url),
          currency = COALESCE(?, currency),
          theme = COALESCE(?, theme),
          financial_year_start_month = COALESCE(?, financial_year_start_month),
          updated_at = ?
        WHERE id = ?
      `);
      stmt.run(
        data.full_name ?? null,
        data.avatar_url ?? null,
        data.currency ?? 'INR',
        data.theme ?? 'system',
        data.financial_year_start_month ?? 4,
        now,
        id
      );
    } else {
      const stmt = db.prepare(`
        INSERT INTO profiles (id, full_name, avatar_url, currency, theme, financial_year_start_month, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        id,
        data.full_name ?? null,
        data.avatar_url ?? null,
        data.currency ?? 'INR',
        data.theme ?? 'system',
        data.financial_year_start_month ?? 4,
        now,
        now
      );
    }
    return this.getById(id);
  },
};