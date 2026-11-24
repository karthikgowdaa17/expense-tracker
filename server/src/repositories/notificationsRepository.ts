import { db } from '../persistence/db.js';
import { v4 as uuidv4 } from 'uuid';

function rowToNotification(row: any) {
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    is_read: Boolean(row.is_read),
    related_entity_type: row.related_entity_type ?? null,
    related_entity_id: row.related_entity_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const notificationsRepository = {
  listByUser(userId: string, unreadOnly = false) {
    let sql = 'SELECT * FROM notifications WHERE user_id = ?';
    const params: any[] = [userId];
    if (unreadOnly) {
      sql += ' AND is_read = 0';
    }
    sql += ' ORDER BY created_at DESC';
    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(rowToNotification);
  },
  getById(id: string) {
    const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as any | undefined;
    return row ? rowToNotification(row) : undefined;
  },
  create(userId: string, data: {
    type: 'over_budget' | 'recurring_generated' | 'system';
    title: string;
    message: string;
    related_entity_type?: string | null;
    related_entity_id?: string | null;
  }) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, is_read, related_entity_type, related_entity_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
    `);
    stmt.run(
      id, userId, data.type, data.title, data.message,
      data.related_entity_type ?? null, data.related_entity_id ?? null,
      now, now
    );
    return this.getById(id)!;
  },
  markRead(id: string) {
    const now = new Date().toISOString();
    const result = db.prepare('UPDATE notifications SET is_read = 1, updated_at = ? WHERE id = ?')
      .run(now, id);
    return result.changes > 0;
  },
  markAllRead(userId: string) {
    const now = new Date().toISOString();
    const result = db.prepare('UPDATE notifications SET is_read = 1, updated_at = ? WHERE user_id = ? AND is_read = 0')
      .run(now, userId);
    return result.changes;
  },
  delete(id: string) {
    const result = db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
    return result.changes > 0;
  },
};
