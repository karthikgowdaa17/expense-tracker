import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
const dataDir = path.resolve(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'expense-tracker.db');
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
export function closeDatabase() {
    if (db.open) {
        db.close();
    }
}
//# sourceMappingURL=db.js.map