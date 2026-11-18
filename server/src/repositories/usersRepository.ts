import { db } from '../persistence/db.js';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import type { SignupInput } from '../validation/schemas.js';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  email_verified: number;
  created_at: string;
  updated_at: string;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
}

export interface PasswordResetToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used: number;
  created_at: string;
}

export interface EmailVerificationToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used: number;
  created_at: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export const usersRepository = {
  getByEmail(email: string): User | undefined {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
  },

  getById(id: string): User | undefined {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  },

  create(data: SignupInput & { password_hash: string }): User {
    const id = randomUUID();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO users (id, email, password_hash, email_verified, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, data.email, data.password_hash, 0, now, now);
    return this.getById(id)!;
  },

  updatePassword(userId: string, passwordHash: string): void {
    const now = new Date().toISOString();
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(passwordHash, now, userId);
  },

  setEmailVerified(userId: string): void {
    const now = new Date().toISOString();
    db.prepare('UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?').run(now, userId);
  },
};

export const refreshTokensRepository = {
  create(userId: string, tokenHash: string, expiresAt: string): RefreshToken {
    const id = randomUUID();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, userId, tokenHash, expiresAt, now);
    return this.getById(id)!;
  },

  getById(id: string): RefreshToken | undefined {
    return db.prepare('SELECT * FROM refresh_tokens WHERE id = ?').get(id) as RefreshToken | undefined;
  },

  getByTokenHash(tokenHash: string): RefreshToken | undefined {
    return db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(tokenHash) as RefreshToken | undefined;
  },

  delete(id: string): boolean {
    const result = db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(id);
    return result.changes > 0;
  },

  deleteByUserId(userId: string): void {
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
  },

  deleteExpired(): void {
    const now = new Date().toISOString();
    db.prepare('DELETE FROM refresh_tokens WHERE expires_at < ?').run(now);
  },
};

export const passwordResetTokensRepository = {
  create(userId: string, rawToken: string, expiresAt: string): PasswordResetToken {
    const id = randomUUID();
    const tokenHash = hashToken(rawToken);
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, userId, tokenHash, expiresAt, 0, now);
    return this.getById(id)!;
  },

  getById(id: string): PasswordResetToken | undefined {
    return db.prepare('SELECT * FROM password_reset_tokens WHERE id = ?').get(id) as PasswordResetToken | undefined;
  },

  getByTokenHash(tokenHash: string): PasswordResetToken | undefined {
    return db.prepare('SELECT * FROM password_reset_tokens WHERE token_hash = ?').get(tokenHash) as PasswordResetToken | undefined;
  },

  markUsed(id: string): void {
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(id);
  },

  deleteExpired(): void {
    const now = new Date().toISOString();
    db.prepare('DELETE FROM password_reset_tokens WHERE expires_at < ?').run(now);
  },
};

export const emailVerificationTokensRepository = {
  create(userId: string, rawToken: string, expiresAt: string): EmailVerificationToken {
    const id = randomUUID();
    const tokenHash = hashToken(rawToken);
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, used, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, userId, tokenHash, expiresAt, 0, now);
    return this.getById(id)!;
  },

  getById(id: string): EmailVerificationToken | undefined {
    return db.prepare('SELECT * FROM email_verification_tokens WHERE id = ?').get(id) as EmailVerificationToken | undefined;
  },

  getByTokenHash(tokenHash: string): EmailVerificationToken | undefined {
    return db.prepare('SELECT * FROM email_verification_tokens WHERE token_hash = ?').get(tokenHash) as EmailVerificationToken | undefined;
  },

  markUsed(id: string): void {
    db.prepare('UPDATE email_verification_tokens SET used = 1 WHERE id = ?').run(id);
  },

  deleteExpired(): void {
    const now = new Date().toISOString();
    db.prepare('DELETE FROM email_verification_tokens WHERE expires_at < ?').run(now);
  },
};