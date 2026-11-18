import { eventBus } from '../events/eventBus.js';
import { usersRepository, refreshTokensRepository, passwordResetTokensRepository, emailVerificationTokensRepository, type User } from '../repositories/usersRepository.js';
import { profilesRepository } from '../repositories/profilesRepository.js';
import { categoriesRepository } from '../repositories/categoriesRepository.js';
import { userSettingsRepository } from '../repositories/userSettingsRepository.js';
import { db } from '../persistence/db.js';
import { loginSchema, signupSchema, refreshSchema, forgotPasswordSchema, resetPasswordSchema, verifyEmailSchema } from '../validation/schemas.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { createHash, randomBytes } from 'crypto';
import { ValidationError } from './index.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateAccessToken(user: User): string {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function generateRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

function verifyAccessToken(token: string): { sub: string; email: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { sub: string; email: string };
  } catch {
    return null;
  }
}

function getBearerToken(req: IncomingMessage): string | null {
  const auth = req.headers['authorization'];
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return null;
}

function sendJson(res: ServerResponse, status: number, body: any) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function validate(schema: any, data: any) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const msg = result.error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw new ValidationError(msg);
  }
  return result.data;
}

async function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

export async function handleAuthLogin(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  if (req.method !== 'POST' || url.pathname !== '/api/auth/login') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const body = await readBody(req);
  const data = validate(loginSchema, body);

  const user = usersRepository.getByEmail(data.email);
  if (!user) {
    sendJson(res, 401, { error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(data.password, user.password_hash);
  if (!valid) {
    sendJson(res, 401, { error: 'Invalid credentials' });
    return;
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  refreshTokensRepository.create(user.id, refreshTokenHash, expiresAt);

  const profile = profilesRepository.getById(user.id);

  sendJson(res, 200, {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: 15 * 60,
    user: {
      id: user.id,
      email: user.email,
      email_verified: user.email_verified === 1,
      profile: profile ?? null,
    },
  });
}

export async function handleAuthSignup(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  if (req.method !== 'POST' || url.pathname !== '/api/auth/signup') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const body = await readBody(req);
  const data = validate(signupSchema, body);

  const existing = usersRepository.getByEmail(data.email);
  if (existing) {
    sendJson(res, 409, { error: 'Email already registered' });
    return;
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = usersRepository.create({ ...data, password_hash: passwordHash });

  // Create default profile for new user
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO profiles (id, full_name, avatar_url, currency, theme, financial_year_start_month, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(user.id, data.full_name ?? null, null, 'INR', 'system', 4, now, now);

  // Create default settings for new user
  userSettingsRepository.getOrCreate(user.id);

  // Create default categories for new user
  categoriesRepository.ensureDefaults(user.id);

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  refreshTokensRepository.create(user.id, refreshTokenHash, expiresAt);

  const profile = profilesRepository.getById(user.id);

  eventBus.publish({ type: 'user.created', payload: { id: user.id, email: user.email } });

  sendJson(res, 201, {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: 15 * 60,
    user: {
      id: user.id,
      email: user.email,
      email_verified: user.email_verified === 1,
      profile: profile ?? null,
    },
  });
}

export async function handleAuthRefresh(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  if (req.method !== 'POST' || url.pathname !== '/api/auth/refresh') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const body = await readBody(req);
  const data = validate(refreshSchema, body);

  const tokenHash = hashToken(data.refresh_token);
  const stored = refreshTokensRepository.getByTokenHash(tokenHash);

  if (!stored || new Date(stored.expires_at) < new Date()) {
    if (stored) refreshTokensRepository.delete(stored.id);
    sendJson(res, 401, { error: 'Invalid or expired refresh token' });
    return;
  }

  const user = usersRepository.getById(stored.user_id);
  if (!user) {
    sendJson(res, 401, { error: 'User not found' });
    return;
  }

  refreshTokensRepository.delete(stored.id);

  const accessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken();
  const newRefreshTokenHash = hashToken(newRefreshToken);
  const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  refreshTokensRepository.create(user.id, newRefreshTokenHash, newExpiresAt);

  sendJson(res, 200, {
    access_token: accessToken,
    refresh_token: newRefreshToken,
    token_type: 'Bearer',
    expires_in: 15 * 60,
  });
}

export async function handleAuthMe(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  if (req.method !== 'GET' || url.pathname !== '/api/auth/me') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const token = getBearerToken(req);
  if (!token) {
    sendJson(res, 401, { error: 'Missing authorization header' });
    return;
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    sendJson(res, 401, { error: 'Invalid or expired access token' });
    return;
  }

  const user = usersRepository.getById(payload.sub);
  if (!user) {
    sendJson(res, 401, { error: 'User not found' });
    return;
  }

  const profile = profilesRepository.getById(user.id);

  sendJson(res, 200, {
    id: user.id,
    email: user.email,
    email_verified: user.email_verified === 1,
    profile: profile ?? null,
  });
}

export function authenticateRequest(req: IncomingMessage): User | null {
  const token = getBearerToken(req);
  if (!token) return null;

  const payload = verifyAccessToken(token);
  if (!payload) return null;

  const user = usersRepository.getById(payload.sub);
  return user || null;
}

const PASSWORD_RESET_EXPIRY_HOURS = 1;
const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;

function generateRawToken(): string {
  return randomBytes(32).toString('hex');
}

export async function handleAuthForgotPassword(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  if (req.method !== 'POST' || url.pathname !== '/api/auth/forgot-password') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const body = await readBody(req);
  const data = validate(forgotPasswordSchema, body);

  const user = usersRepository.getByEmail(data.email);
  // Always return success to prevent email enumeration
  if (!user) {
    sendJson(res, 200, { message: 'If the email exists, a password reset link has been sent' });
    return;
  }

  const rawToken = generateRawToken();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
  passwordResetTokensRepository.create(user.id, rawToken, expiresAt);

  // TODO: Send email with reset link containing rawToken
  // For now, return the token in response (dev only)
  console.log(`[DEV] Password reset token for ${user.email}: ${rawToken}`);

  sendJson(res, 200, { 
    message: 'If the email exists, a password reset link has been sent',
    // Dev only - remove in production
    dev_token: rawToken 
  });
}

export async function handleAuthResetPassword(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  if (req.method !== 'POST' || url.pathname !== '/api/auth/reset-password') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const body = await readBody(req);
  const data = validate(resetPasswordSchema, body);

  const tokenHash = hashToken(data.token);
  const stored = passwordResetTokensRepository.getByTokenHash(tokenHash);

  if (!stored || new Date(stored.expires_at) < new Date() || stored.used === 1) {
    sendJson(res, 400, { error: 'Invalid or expired reset token' });
    return;
  }

  const user = usersRepository.getById(stored.user_id);
  if (!user) {
    sendJson(res, 400, { error: 'Invalid or expired reset token' });
    return;
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  usersRepository.updatePassword(user.id, passwordHash);
  passwordResetTokensRepository.markUsed(stored.id);
  // Invalidate all refresh tokens for security
  refreshTokensRepository.deleteByUserId(user.id);

  sendJson(res, 200, { message: 'Password has been reset successfully' });
}

export async function handleAuthVerifyEmail(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  if (req.method !== 'POST' || url.pathname !== '/api/auth/verify-email') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const body = await readBody(req);
  const data = validate(verifyEmailSchema, body);

  const tokenHash = hashToken(data.token);
  const stored = emailVerificationTokensRepository.getByTokenHash(tokenHash);

  if (!stored || new Date(stored.expires_at) < new Date() || stored.used === 1) {
    sendJson(res, 400, { error: 'Invalid or expired verification token' });
    return;
  }

  const user = usersRepository.getById(stored.user_id);
  if (!user) {
    sendJson(res, 400, { error: 'Invalid or expired verification token' });
    return;
  }

  usersRepository.setEmailVerified(user.id);
  emailVerificationTokensRepository.markUsed(stored.id);

  sendJson(res, 200, { message: 'Email verified successfully' });
}

export async function handleAuthResendVerification(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  if (req.method !== 'POST' || url.pathname !== '/api/auth/resend-verification') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const body = await readBody(req);
  const data = validate(forgotPasswordSchema, body); // Reuse email schema

  const user = usersRepository.getByEmail(data.email);
  // Always return success to prevent email enumeration
  if (!user || user.email_verified === 1) {
    sendJson(res, 200, { message: 'If the email exists and is unverified, a verification link has been sent' });
    return;
  }

  const rawToken = generateRawToken();
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
  emailVerificationTokensRepository.create(user.id, rawToken, expiresAt);

  // TODO: Send email with verification link containing rawToken
  // For now, return the token in response (dev only)
  console.log(`[DEV] Email verification token for ${user.email}: ${rawToken}`);

  sendJson(res, 200, { 
    message: 'If the email exists and is unverified, a verification link has been sent',
    // Dev only - remove in production
    dev_token: rawToken 
  });
}

export { generateAccessToken, hashToken, verifyAccessToken }; 
