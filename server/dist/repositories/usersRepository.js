import { db } from '../persistence/db.js';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
function hashToken(token) {
    return createHash('sha256').update(token).digest('hex');
}
export const usersRepository = {
    getByEmail(email) {
        return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    },
    getById(id) {
        return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    },
    create(data) {
        const id = randomUUID();
        const now = new Date().toISOString();
        const stmt = db.prepare(`
      INSERT INTO users (id, email, password_hash, email_verified, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, data.email, data.password_hash, 0, now, now);
        return this.getById(id);
    },
    updatePassword(userId, passwordHash) {
        const now = new Date().toISOString();
        db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(passwordHash, now, userId);
    },
    setEmailVerified(userId) {
        const now = new Date().toISOString();
        db.prepare('UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?').run(now, userId);
    },
};
export const refreshTokensRepository = {
    create(userId, tokenHash, expiresAt) {
        const id = randomUUID();
        const now = new Date().toISOString();
        const stmt = db.prepare(`
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
        stmt.run(id, userId, tokenHash, expiresAt, now);
        return this.getById(id);
    },
    getById(id) {
        return db.prepare('SELECT * FROM refresh_tokens WHERE id = ?').get(id);
    },
    getByTokenHash(tokenHash) {
        return db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(tokenHash);
    },
    delete(id) {
        const result = db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(id);
        return result.changes > 0;
    },
    deleteByUserId(userId) {
        db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
    },
    deleteExpired() {
        const now = new Date().toISOString();
        db.prepare('DELETE FROM refresh_tokens WHERE expires_at < ?').run(now);
    },
};
export const passwordResetTokensRepository = {
    create(userId, rawToken, expiresAt) {
        const id = randomUUID();
        const tokenHash = hashToken(rawToken);
        const now = new Date().toISOString();
        const stmt = db.prepare(`
      INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, userId, tokenHash, expiresAt, 0, now);
        return this.getById(id);
    },
    getById(id) {
        return db.prepare('SELECT * FROM password_reset_tokens WHERE id = ?').get(id);
    },
    getByTokenHash(tokenHash) {
        return db.prepare('SELECT * FROM password_reset_tokens WHERE token_hash = ?').get(tokenHash);
    },
    markUsed(id) {
        db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(id);
    },
    deleteExpired() {
        const now = new Date().toISOString();
        db.prepare('DELETE FROM password_reset_tokens WHERE expires_at < ?').run(now);
    },
};
export const emailVerificationTokensRepository = {
    create(userId, rawToken, expiresAt) {
        const id = randomUUID();
        const tokenHash = hashToken(rawToken);
        const now = new Date().toISOString();
        const stmt = db.prepare(`
      INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, used, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, userId, tokenHash, expiresAt, 0, now);
        return this.getById(id);
    },
    getById(id) {
        return db.prepare('SELECT * FROM email_verification_tokens WHERE id = ?').get(id);
    },
    getByTokenHash(tokenHash) {
        return db.prepare('SELECT * FROM email_verification_tokens WHERE token_hash = ?').get(tokenHash);
    },
    markUsed(id) {
        db.prepare('UPDATE email_verification_tokens SET used = 1 WHERE id = ?').run(id);
    },
    deleteExpired() {
        const now = new Date().toISOString();
        db.prepare('DELETE FROM email_verification_tokens WHERE expires_at < ?').run(now);
    },
};
//# sourceMappingURL=usersRepository.js.map