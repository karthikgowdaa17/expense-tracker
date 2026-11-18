import { db } from '../persistence/db.js';
import type { CategoryInput } from '../validation/schemas.js';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Food & Dining', icon: '🍽️', color: '#EF4444' },
  { name: 'Groceries', icon: '🛒', color: '#F97316' },
  { name: 'Transportation', icon: '🚌', color: '#EAB308' },
  { name: 'Shopping', icon: '🛍️', color: '#EC4899' },
  { name: 'Bills & Utilities', icon: '📄', color: '#06B6D4' },
  { name: 'Healthcare', icon: '❤️', color: '#F43F5E' },
  { name: 'Entertainment', icon: '🎮', color: '#8B5CF6' },
  { name: 'Subscriptions', icon: '🔄', color: '#6366F1' },
  { name: 'Education', icon: '📚', color: '#14B8A6' },
  { name: 'Travel', icon: '✈️', color: '#10B981' },
  { name: 'Personal Care', icon: '💇', color: '#F43F5E' },
  { name: 'Rent / Housing', icon: '🏠', color: '#8B5CF6' },
  { name: 'Other', icon: '⋯', color: '#9CA3AF' },
];

const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salary', icon: '💼', color: '#10B981' },
  { name: 'Freelance', icon: '💻', color: '#059669' },
  { name: 'Business', icon: '🏢', color: '#0D9488' },
  { name: 'Interest', icon: '📈', color: '#0891B2' },
  { name: 'Investment', icon: '📊', color: '#7C3AED' },
  { name: 'Gift', icon: '🎁', color: '#EC4899' },
  { name: 'Other Income', icon: '➕', color: '#6B7280' },
];

function rowToCategory(row: any) {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    type: row.type,
    icon: row.icon,
    color: row.color,
    is_default: Boolean(row.is_default),
    created_at: row.created_at,
  };
}

export const categoriesRepository = {
  listByUser(userId: string) {
    const rows = db.prepare('SELECT * FROM categories WHERE user_id = ? ORDER BY type, name').all(userId) as any[];
    return rows.map(rowToCategory);
  },
  getById(id: string) {
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any | undefined;
    return row ? rowToCategory(row) : undefined;
  },
  create(userId: string, data: CategoryInput) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO categories (id, user_id, name, type, icon, color, is_default, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, userId, data.name, data.type, data.icon ?? null, data.color ?? null, data.is_default ? 1 : 0, now);
    return this.getById(id)!;
  },
  ensureDefaults(userId: string) {
    const existingRows = db.prepare('SELECT name, type FROM categories WHERE user_id = ?').all(userId) as { name: string; type: string }[];
    const existing = new Set(existingRows.map(r => `${r.type}:${r.name}`));
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO categories (id, user_id, name, type, icon, color, is_default, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
      if (!existing.has(`expense:${cat.name}`)) {
        stmt.run(uuidv4(), userId, cat.name, 'expense', cat.icon, cat.color, 1, now);
      }
    }
    for (const cat of DEFAULT_INCOME_CATEGORIES) {
      if (!existing.has(`income:${cat.name}`)) {
        stmt.run(uuidv4(), userId, cat.name, 'income', cat.icon, cat.color, 1, now);
      }
    }
  },
  update(id: string, data: Partial<CategoryInput>) {
    const sets: string[] = [];
    const params: any[] = [];
    if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
    if (data.type !== undefined) { sets.push('type = ?'); params.push(data.type); }
    if (data.icon !== undefined) { sets.push('icon = ?'); params.push(data.icon); }
    if (data.color !== undefined) { sets.push('color = ?'); params.push(data.color); }
    if (data.is_default !== undefined) { sets.push('is_default = ?'); params.push(data.is_default ? 1 : 0); }
    if (!sets.length) return this.getById(id);
    params.push(id);
    db.prepare(`UPDATE categories SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return this.getById(id);
  },
  delete(id: string) {
    const stmt = db.prepare('DELETE FROM categories WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },
};