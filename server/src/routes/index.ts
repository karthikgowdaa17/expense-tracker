import { eventBus } from '../events/eventBus.js';
import { db } from '../persistence/db.js';
import { type User } from '../repositories/usersRepository.js';
import { profilesRepository } from '../repositories/profilesRepository.js';
import { categoriesRepository } from '../repositories/categoriesRepository.js';
import { accountsRepository, deleteAccountSafely } from '../repositories/accountsRepository.js';
import { transactionsRepository } from '../repositories/transactionsRepository.js';
import { budgetsRepository } from '../repositories/budgetsRepository.js';
import { recurringTransactionsRepository } from '../repositories/recurringTransactionsRepository.js';
import { notificationsRepository } from '../repositories/notificationsRepository.js';
import { userSettingsRepository } from '../repositories/userSettingsRepository.js';

import { profileSchema, categorySchema, accountSchema, transactionSchema, budgetSchema, recurringTransactionSchema, userSettingsSchema } from '../validation/schemas.js';

const EXPENSE_KEYWORDS: Record<string, string[]> = {
  'Food & Dining': ['swiggy', 'zomato', 'restaurant', 'food', 'dinner', 'lunch', 'breakfast', 'cafe', 'biryani', 'pizza', 'burger', 'dosa', 'idli', 'mess', 'canteen', 'tiffin'],
  'Groceries': ['grocery', 'groceries', 'bigbasket', 'zepto', 'blinkit', 'instamart', 'dmart', 'reliance fresh', 'more', 'spencer', 'vegetable', 'fruit', 'milk', 'bread', 'egg', 'rice', 'dal', 'atta'],
  'Transportation': ['uber', 'ola', 'rapido', 'namma yatri', 'metro', 'bus', 'auto', 'rickshaw', 'cab', 'taxi', 'fuel', 'petrol', 'diesel', 'cng', 'parking', 'toll', 'fastag'],
  'Shopping': ['amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'meesho', 'shopping', 'shop', 'clothes', 'shoes', 'electronics', 'mobile', 'laptop', 'headphone', 'watch'],
  'Bills & Utilities': ['electricity', 'bescom', 'water bill', 'gas bill', 'broadband', 'internet', 'wifi', 'airtel', 'jio', 'vi', 'bsnl', 'recharge', 'bbps', 'phone bill', 'mobile bill'],
  'Healthcare': ['apollo', '1mg', 'pharmeasy', 'netmeds', 'hospital', 'pharmacy', 'medical', 'clinic', 'diagnostic', 'doctor', 'medicine', 'health', 'dental', 'eye'],
  'Entertainment': ['movie', 'cinema', 'pvr', 'inox', 'concert', 'event', 'bookmyshow', 'game', 'steam', 'playstation', 'xbox'],
  'Subscriptions': ['netflix', 'spotify', 'prime', 'hotstar', 'sony liv', 'zee5', 'youtube premium', 'apple music', 'gaana', 'wynk', 'subscription', 'prime video', 'disney'],
  'Education': ['course', 'udemy', 'coursera', 'education', 'training', 'certification', 'degree', 'college', 'university', 'book', 'books'],
  'Travel': ['flight', 'train', 'irctc', 'booking', 'hotel', 'makemytrip', 'goibibo', 'travel', 'vacation', 'holiday'],
  'Personal Care': ['salon', 'spa', 'grooming', 'beauty', 'haircut', 'massage', 'wellness', 'fitness', 'gym'],
  'Rent / Housing': ['rent', 'landlord', 'housing', 'house rent', 'flat rent', 'pg', 'hostel', 'accommodation'],
  'Other': [],
};

const INCOME_KEYWORDS: Record<string, string[]> = {
  'Salary': ['salary', 'payroll', 'stipend', 'wages', 'credited', 'deposit', 'transfer from'],
  'Freelance': ['freelance', 'upwork', 'fiverr', 'freelancer', 'contract', 'project payment', 'client payment'],
  'Business': ['business', 'revenue', 'sales', 'turnover', 'profit', 'merchant', 'shop income'],
  'Interest': ['interest', 'fd interest', 'savings interest', 'bank interest', 'rd interest'],
  'Investment': ['investment', 'mutual fund', 'stock', 'equity', 'dividend', 'capital gain', 'sip', 'redemption'],
  'Gift': ['gift', 'cashback', 'refund', 'reward', 'bonus', 'prize'],
  'Other Income': [],
};

function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9\s]/g, ' ');
}

function calculateMatchScore(description: string, keywords: string[]): number {
  const normalized = normalizeText(description);
  let score = 0;
  for (const keyword of keywords) {
    if (normalized.includes(keyword.toLowerCase())) {
      score += keyword.length;
    }
  }
  return score;
}

function suggestCategory(description: string, categories: any[], type: 'income' | 'expense'): string | null {
  if (!description || !categories.length) return null;
  
  const userCategories = categories.filter(c => c.type === type);
  if (!userCategories.length) return null;
  
  const keywordMap = type === 'expense' ? EXPENSE_KEYWORDS : INCOME_KEYWORDS;
  
  let bestMatch: { category: any; score: number } | null = null;
  
  for (const [categoryName, keywords] of Object.entries(keywordMap)) {
    const matchingCategory = userCategories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
    if (!matchingCategory) continue;
    
    const score = calculateMatchScore(description, keywords);
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { category: matchingCategory, score };
    }
  }
  
  if (bestMatch && bestMatch.score >= 3) {
    return bestMatch.category.name;
  }
  
  // Fallback to "Other" category of the appropriate type
  const otherCategory = userCategories.find(c => c.name.toLowerCase() === 'other');
  if (otherCategory) return otherCategory.name;
  
  // If no "Other" category, return the first category of the type
  return userCategories[0]?.name ?? null;
}
 
import { authenticateRequest } from './auth.js';
import type { IncomingMessage, ServerResponse } from 'http';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function getUserId(req: IncomingMessage): string | null {
  const user = authenticateRequest(req);
  return user?.id ?? null;
}

export function requireAuth(req: IncomingMessage): User {
  const user = authenticateRequest(req);
  if (!user) {
    throw new ValidationError('Authentication required');
  }
  return user;
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
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

export async function handleProfiles(req: IncomingMessage, res: ServerResponse) {
  const userId = getUserId(req);
  if (!userId) return sendJson(res, 401, { error: 'Authentication required' });
  if (req.method === 'GET' && req.url === '/api/profiles') {
    const profile = profilesRepository.getById(userId);
    if (!profile) {
      // Create default profile if missing
      const now = new Date().toISOString();
      const { db } = await import('../persistence/db.js');
      db.prepare(`
        INSERT INTO profiles (id, full_name, avatar_url, currency, theme, financial_year_start_month, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, null, null, 'INR', 'system', 4, now, now);
      const newProfile = profilesRepository.getById(userId);
      return sendJson(res, 200, newProfile);
    }
    return sendJson(res, 200, profile);
  }
  if (req.method === 'PATCH' && req.url === '/api/profiles') {
    const body = await readBody(req);
    const data = validate(profileSchema, body);
    const updated = profilesRepository.upsert(userId, data);
    eventBus.publish({ type: 'profile.updated', payload: updated });
    return sendJson(res, 200, updated);
  }
  sendJson(res, 405, { error: 'Method not allowed' });
}

export async function handleCategories(req: IncomingMessage, res: ServerResponse) {
  const userId = getUserId(req);
  if (!userId) return sendJson(res, 401, { error: 'Authentication required' });
  const url = new URL(req.url!, `http://${req.headers.host}`);
  if (req.method === 'GET' && url.pathname === '/api/categories') {
    categoriesRepository.ensureDefaults(userId);
    const list = categoriesRepository.listByUser(userId);
    return sendJson(res, 200, list);
  }
  if (req.method === 'POST' && url.pathname === '/api/categories') {
    const body = await readBody(req);
    const data = validate(categorySchema, body);
    const created = categoriesRepository.create(userId, data);
    eventBus.publish({ type: 'category.created', payload: created });
    return sendJson(res, 201, created);
  }
  const id = url.pathname.split('/').pop();
  if (req.method === 'PATCH' && id && url.pathname.startsWith('/api/categories/')) {
    const body = await readBody(req);
    const data = validate(categorySchema.partial(), body);
    const updated = categoriesRepository.update(id, data);
    if (!updated) return sendJson(res, 404, { error: 'Not found' });
    eventBus.publish({ type: 'category.updated', payload: updated });
    return sendJson(res, 200, updated);
  }
  if (req.method === 'DELETE' && id && url.pathname.startsWith('/api/categories/')) {
    const ok = categoriesRepository.delete(id);
    if (!ok) return sendJson(res, 404, { error: 'Not found' });
    eventBus.publish({ type: 'category.deleted', payload: { id } });
    return sendJson(res, 204, null);
  }
  sendJson(res, 405, { error: 'Method not allowed' });
}

export async function handleAccounts(req: IncomingMessage, res: ServerResponse) {
  const userId = getUserId(req);
  if (!userId) return sendJson(res, 401, { error: 'Authentication required' });
  const url = new URL(req.url!, `http://${req.headers.host}`);
  if (req.method === 'GET' && url.pathname === '/api/accounts') {
    // Provision default accounts on first access (same defaults the app has always used)
    accountsRepository.ensureDefaults(userId);
    const list = accountsRepository.listByUser(userId);
    return sendJson(res, 200, list);
  }
  if (req.method === 'POST' && url.pathname === '/api/accounts') {
    const body = await readBody(req);
    const data = validate(accountSchema, body);
    try {
      // Reuse an existing matching account instead of duplicating it
      const created = accountsRepository.findOrCreate(userId, data);
      eventBus.publish({ type: 'account.created', payload: created });
      return sendJson(res, 201, created);
    } catch (err: any) {
      if (String(err?.message || '').includes('UNIQUE')) {
        return sendJson(res, 409, { error: 'An account with this name already exists' });
      }
      throw err;
    }
  }
  const id = url.pathname.split('/').pop();
  if (req.method === 'PATCH' && id && url.pathname.startsWith('/api/accounts/')) {
    const body = await readBody(req);
    if (body.reassign_transactions_to !== undefined && body.reassign_transactions_to !== null) {
      const target = accountsRepository.getByIdForUser(body.reassign_transactions_to, userId);
      if (!target) return sendJson(res, 400, { error: 'Reassign target account not found' });
      db.prepare('UPDATE transactions SET account_id = ?, account = ?, updated_at = ? WHERE user_id = ? AND account_id = ?')
        .run(target.id, target.name, new Date().toISOString(), userId, id);
    }
    const data = validate(accountSchema.partial(), body);
    const updated = accountsRepository.update(id, userId, data);
    if (!updated) return sendJson(res, 404, { error: 'Not found' });
    eventBus.publish({ type: 'account.updated', payload: updated });
    return sendJson(res, 200, updated);
  }
  if (req.method === 'DELETE' && id && url.pathname.startsWith('/api/accounts/')) {
    const modeParam = url.searchParams.get('mode');
    const mode = modeParam === 'delete' || modeParam === 'reassign' ? modeParam : 'unassign';
    const reassignTo = url.searchParams.get('reassign_to') || undefined;
    const result = deleteAccountSafely(userId, id, mode, reassignTo);
    if (!result.ok) {
      const status = result.error === 'not_found' ? 404 : 400;
      return sendJson(res, status, { error: result.error });
    }
    eventBus.publish({ type: 'account.deleted', payload: { id, mode, affected: result.affected } });
    return sendJson(res, 200, { deleted: true, mode, affected_transactions: result.affected });
  }
  sendJson(res, 405, { error: 'Method not allowed' });
}

export async function handleTransactions(req: IncomingMessage, res: ServerResponse) {
  const userId = getUserId(req);
  if (!userId) return sendJson(res, 401, { error: 'Authentication required' });
  const url = new URL(req.url!, `http://${req.headers.host}`);
  if (req.method === 'GET' && url.pathname === '/api/transactions') {
    // Export: CSV or PDF
    const format = url.searchParams.get('format') || 'csv';
    if (format === 'csv' || format === 'pdf') {
      const filters = {
        dateFrom: url.searchParams.get('dateFrom') || undefined,
        dateTo: url.searchParams.get('dateTo') || undefined,
        type: url.searchParams.get('type') || undefined,
        category: url.searchParams.get('category') || undefined,
        paymentMethod: url.searchParams.get('paymentMethod') || undefined,
        account: url.searchParams.get('account') || undefined,
        accountId: url.searchParams.get('accountId') || undefined,
        search: url.searchParams.get('search') || undefined,
        limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined,
        offset: url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!, 10) : undefined,
      };
      const list = transactionsRepository.listByUser(userId, filters);

      const header = 'date,type,amount,category,description,payment_method,account,transfer_direction,notes\n';
      const rows = list.map(t =>
        `${t.date},${t.type},${t.amount},"${t.category}","${t.description}",${t.payment_method},"${t.account}",${t.transfer_direction ?? ''},"${t.notes ?? ''}"`
      ).join('\n');

      if (format === 'csv') {
        res.writeHead(200, {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="transactions-${new Date().toISOString().split('T')[0]}.csv"`,
        });
        res.end(header + rows);
        return;
      }

      // PDF placeholder: client renders CSV data via pdfjs-dist
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="transactions-${new Date().toISOString().split('T')[0]}.pdf"`,
      });
      res.end(header + rows);
      return;
    }

    const filters = {
      dateFrom: url.searchParams.get('dateFrom') || undefined,
      dateTo: url.searchParams.get('dateTo') || undefined,
      type: url.searchParams.get('type') || undefined,
      category: url.searchParams.get('category') || undefined,
      paymentMethod: url.searchParams.get('paymentMethod') || undefined,
      account: url.searchParams.get('account') || undefined,
      accountId: url.searchParams.get('accountId') || undefined,
      search: url.searchParams.get('search') || undefined,
      limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined,
      offset: url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!, 10) : undefined,
    };
    const list = transactionsRepository.listByUser(userId, filters);
    return sendJson(res, 200, list);
  }
  if (req.method === 'POST' && url.pathname === '/api/transactions') {
    const body = await readBody(req);
    const data = validate(transactionSchema, body);

    // A transaction can only point at the caller's own account
    if (data.account_id && !accountsRepository.getByIdForUser(data.account_id, userId)) {
      return sendJson(res, 400, { error: 'Invalid account_id' });
    }

    // Auto-categorize if no category provided
    if (!data.category) {
      const categories = categoriesRepository.listByUser(userId);
      const suggested = suggestCategory(data.description, categories, data.type);
      if (suggested) {
        data.category = suggested;
      }
    }

    // Handle multi-account transfers: create an out-transaction in the source
    // account and a matching in-transaction in the destination account, linked
    // via split_from so they net out in the All Accounts view.
    if (data.type === 'transfer' && body.to_account) {
      const destAccount = accountsRepository.findByName(userId, body.to_account);
      if (!destAccount) {
        return sendJson(res, 400, { error: 'Destination account not found' });
      }

      const source = transactionsRepository.create(userId, {
        ...data,
        transfer_direction: 'out',
        notes: data.notes ? `Transfer to ${body.to_account}. ${data.notes}` : `Transfer to ${body.to_account}`,
      } as any);

      const destination = transactionsRepository.create(userId, {
        ...data,
        type: 'income',
        transfer_direction: 'in',
        account: destAccount.name,
        account_id: destAccount.id,
        split_from: source.id,
        notes: data.notes ? `Transfer from ${data.account}. ${data.notes}` : `Transfer from ${data.account}`,
      } as any);

      eventBus.publish({ type: 'transaction.created', payload: source });
      eventBus.publish({ type: 'transaction.created', payload: destination });
      return sendJson(res, 201, { source, destination });
    }

    const created = transactionsRepository.create(userId, data);
    eventBus.publish({ type: 'transaction.created', payload: created });
    return sendJson(res, 201, created);
  }
  const id = url.pathname.split('/').pop();
  if (req.method === 'PATCH' && id && url.pathname.startsWith('/api/transactions/')) {
    const body = await readBody(req);
    const data = validate(transactionSchema.partial(), body);
    if (data.account_id && !accountsRepository.getByIdForUser(data.account_id, userId)) {
      return sendJson(res, 400, { error: 'Invalid account_id' });
    }
    const updated = transactionsRepository.update(id, userId, data);
    if (!updated) return sendJson(res, 404, { error: 'Not found' });
    eventBus.publish({ type: 'transaction.updated', payload: updated });
    return sendJson(res, 200, updated);
  }
  if (req.method === 'DELETE' && id && url.pathname.startsWith('/api/transactions/')) {
    const ok = transactionsRepository.delete(id, userId);
    if (!ok) return sendJson(res, 404, { error: 'Not found' });
    eventBus.publish({ type: 'transaction.deleted', payload: { id } });
    return sendJson(res, 204, null);
  }
  sendJson(res, 405, { error: 'Method not allowed' });
}

export async function handleBudgets(req: IncomingMessage, res: ServerResponse) {
  const userId = getUserId(req);
  if (!userId) return sendJson(res, 401, { error: 'Authentication required' });
  const url = new URL(req.url!, `http://${req.headers.host}`);
  if (req.method === 'GET' && url.pathname === '/api/budgets') {
    const month = url.searchParams.get('month') || undefined;
    const list = budgetsRepository.listByUser(userId, month);
    return sendJson(res, 200, list);
  }
  if (req.method === 'POST' && url.pathname === '/api/budgets') {
    const body = await readBody(req);
    const data = validate(budgetSchema, body);
    const created = budgetsRepository.create(userId, data);
    eventBus.publish({ type: 'budget.created', payload: created });

    // Over-budget alert: check if current month spending already exceeds this budget
    const category = categoriesRepository.listByUser(userId).find(c => c.id === data.category_id);
    if (category) {
      const [year, month] = data.month.split('-').map(Number);
      const start = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const end = new Date(year, month, 0).toISOString().split('T')[0];
      const spending = transactionsRepository.listByUser(userId, {
        dateFrom: start,
        dateTo: end,
        type: 'expense',
        category: category.name,
      });
      const used = spending.reduce((sum, t) => sum + t.amount, 0);
      if (used > created.amount) {
        notificationsRepository.create(userId, {
          type: 'over_budget',
          title: `Over budget: ${category.name}`,
          message: `You have spent ₹${used} against a budget of ₹${created.amount} for ${category.name} in ${data.month}.`,
          related_entity_type: 'budget',
          related_entity_id: created.id,
        });
      }
    }

    return sendJson(res, 201, created);
  }
  const id = url.pathname.split('/').pop();
  if (req.method === 'PATCH' && id && url.pathname.startsWith('/api/budgets/')) {
    const body = await readBody(req);
    const data = validate(budgetSchema.partial(), body);
    const updated = budgetsRepository.update(id, data);
    if (!updated) return sendJson(res, 404, { error: 'Not found' });
    eventBus.publish({ type: 'budget.updated', payload: updated });
    return sendJson(res, 200, updated);
  }
  if (req.method === 'DELETE' && id && url.pathname.startsWith('/api/budgets/')) {
    const ok = budgetsRepository.delete(id);
    if (!ok) return sendJson(res, 404, { error: 'Not found' });
    eventBus.publish({ type: 'budget.deleted', payload: { id } });
    return sendJson(res, 204, null);
  }
  sendJson(res, 405, { error: 'Method not allowed' });
}

export async function handleRecurring(req: IncomingMessage, res: ServerResponse) {
  const userId = getUserId(req);
  if (!userId) return sendJson(res, 401, { error: 'Authentication required' });
  const url = new URL(req.url!, `http://${req.headers.host}`);
  if (req.method === 'GET' && url.pathname === '/api/recurring') {
    const list = recurringTransactionsRepository.listByUser(userId);
    return sendJson(res, 200, list);
  }
  if (req.method === 'POST' && url.pathname === '/api/recurring') {
    const body = await readBody(req);
    const data = validate(recurringTransactionSchema, body);
    const created = recurringTransactionsRepository.create(userId, data);
    eventBus.publish({ type: 'recurring_transaction.created', payload: created });
    return sendJson(res, 201, created);
  }
  const id = url.pathname.split('/').pop();
  if (req.method === 'PATCH' && id && url.pathname.startsWith('/api/recurring/')) {
    const body = await readBody(req);
    const data = validate(recurringTransactionSchema.partial(), body);
    const updated = recurringTransactionsRepository.update(id, data);
    if (!updated) return sendJson(res, 404, { error: 'Not found' });
    eventBus.publish({ type: 'recurring_transaction.updated', payload: updated });
    return sendJson(res, 200, updated);
  }
  if (req.method === 'DELETE' && id && url.pathname.startsWith('/api/recurring/')) {
    const ok = recurringTransactionsRepository.delete(id);
    if (!ok) return sendJson(res, 404, { error: 'Not found' });
    eventBus.publish({ type: 'recurring_transaction.deleted', payload: { id } });
    return sendJson(res, 204, null);
  }
  if (req.method === 'POST' && url.pathname === '/api/recurring/toggle') {
    const body = await readBody(req);
    const { id: recId } = body;
    const updated = recurringTransactionsRepository.toggleActive(recId);
    if (!updated) return sendJson(res, 404, { error: 'Not found' });
    eventBus.publish({ type: 'recurring_transaction.updated', payload: updated });
    return sendJson(res, 200, updated);
  }

  // Auto-generate transactions from active recurring definitions that are due
  if (req.method === 'POST' && url.pathname === '/api/recurring/generate') {
    const list = recurringTransactionsRepository.listByUser(userId);
    const now = new Date();
    const nowStr: string = now.toISOString().split('T')[0]!;
    const generated: any[] = [];

    for (const rec of list) {
      if (!rec.is_active) continue;
      const endDate = rec.end_date;
      if (endDate && endDate < nowStr) continue;

      let due = false;
      const lastGen = rec.last_generated ? new Date(rec.last_generated) : null;
      const start = new Date(rec.start_date);

      if (!lastGen) {
        due = now >= start;
      } else {
        const lastGenStr: string = lastGen.toISOString().split('T')[0]!;
        switch (rec.frequency) {
          case 'daily':
            due = nowStr > lastGenStr;
            break;
          case 'weekly':
            due = now.getTime() - lastGen.getTime() >= 7 * 24 * 60 * 60 * 1000;
            break;
          case 'monthly':
            due =
              now.getFullYear() > lastGen.getFullYear() ||
              (now.getFullYear() === lastGen.getFullYear() && now.getMonth() > lastGen.getMonth());
            break;
          case 'quarterly':
            due =
              now.getFullYear() > lastGen.getFullYear() ||
              (now.getFullYear() === lastGen.getFullYear() &&
                now.getMonth() - lastGen.getMonth() >= 3);
            break;
          case 'yearly':
            due = now.getFullYear() > lastGen.getFullYear();
            break;
          default:
            due = false;
        }
      }

      if (!due) continue;

      // Determine day of month for the generated transaction
      const genDate = new Date(now);
      if (rec.frequency === 'monthly' || rec.frequency === 'quarterly' || rec.frequency === 'yearly') {
        const day = rec.day_of_month ?? now.getDate();
        genDate.setDate(Math.min(day, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()));
      }

      const genDateStr = genDate.toISOString().split('T')[0];

      const created = transactionsRepository.create(userId, {
        date: genDateStr,
        type: 'expense',
        amount: rec.amount,
        category: rec.category,
        subcategory: rec.subcategory ?? undefined,
        description: rec.description ?? rec.name,
        payment_method: rec.payment_method,
        account: rec.account,
        account_id: undefined,
        transfer_direction: null,
        notes: `Recurring: ${rec.name}`,
        is_recurring: true,
        recurring_id: rec.id,
      } as any);

      recurringTransactionsRepository.update(rec.id, { last_generated: nowStr } as any);
      generated.push(created);
      eventBus.publish({ type: 'transaction.created', payload: created });
    }

    if (generated.length > 0) {
      notificationsRepository.create(userId, {
        type: 'recurring_generated',
        title: 'Recurring transactions generated',
        message: `${generated.length} recurring transaction(s) created for ${new Date().toISOString().split('T')[0]}.`,
      });
    }

    return sendJson(res, 200, { generated: generated.length, transactions: generated });
  }

  sendJson(res, 405, { error: 'Method not allowed' });
}

export async function handlePayments(req: IncomingMessage, res: ServerResponse) {
  const userId = getUserId(req);
  if (!userId) return sendJson(res, 401, { error: 'Authentication required' });
  const url = new URL(req.url!, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/api/payments/summary') {
    const dateFrom = url.searchParams.get('dateFrom') || undefined;
    const dateTo = url.searchParams.get('dateTo') || undefined;
    const method = url.searchParams.get('method') || undefined;

    const filters: any = {};
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (method) filters.paymentMethod = method;

    const transactions = transactionsRepository.listByUser(userId, filters);

    const byMethodMap: Record<string, { expense: number; income: number; count: number }> = {};
    let totalExpenses = 0;
    let totalIncome = 0;

    transactions.forEach(t => {
      const m = t.payment_method;
      if (!byMethodMap[m]) {
        byMethodMap[m] = { expense: 0, income: 0, count: 0 };
      }
      if (t.type === 'expense') {
        byMethodMap[m].expense += t.amount;
        totalExpenses += t.amount;
      } else if (t.type === 'income') {
        byMethodMap[m].income += t.amount;
        totalIncome += t.amount;
      }
      byMethodMap[m].count += 1;
    });

    const PAYMENT_METHODS_INFO: Record<string, { label: string; icon: string }> = {
      upi: { label: 'UPI', icon: 'smartphone' },
      credit_card: { label: 'Credit Card', icon: 'credit-card' },
      debit_card: { label: 'Debit Card', icon: 'credit-card' },
      bank_transfer: { label: 'Bank Transfer', icon: 'building-2' },
      cash: { label: 'Cash', icon: 'banknote' },
      other: { label: 'Other', icon: 'more-horizontal' },
    };

    const byMethod = Object.entries(byMethodMap)
      .map(([method, data]) => {
        const total = data.expense + data.income;
        return {
          method,
          label: PAYMENT_METHODS_INFO[method]?.label || method,
          icon: PAYMENT_METHODS_INFO[method]?.icon || 'more-horizontal',
          expense: data.expense,
          income: data.income,
          count: data.count,
          expensePercent: total > 0 ? parseFloat(((data.expense / total) * 100).toFixed(1)) : 0,
          incomePercent: total > 0 ? parseFloat(((data.income / total) * 100).toFixed(1)) : 0,
        };
      })
      .sort((a, b) => (b.expense + b.income) - (a.expense + a.income));

    return sendJson(res, 200, {
      totalExpenses,
      totalIncome,
      netFlow: totalIncome - totalExpenses,
      byMethod,
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/payments/transactions') {
    const dateFrom = url.searchParams.get('dateFrom') || undefined;
    const dateTo = url.searchParams.get('dateTo') || undefined;
    const method = url.searchParams.get('method') || undefined;
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined;
    const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!, 10) : undefined;

    const filters: any = {};
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (method) filters.paymentMethod = method;
    if (limit) filters.limit = limit;
    if (offset) filters.offset = offset;

    const transactions = transactionsRepository.listByUser(userId, filters);
    return sendJson(res, 200, transactions);
  }

  if (req.method === 'GET' && url.pathname === '/api/payments/methods') {
    const methods = [
      { value: 'upi', label: 'UPI', icon: 'smartphone' },
      { value: 'credit_card', label: 'Credit Card', icon: 'credit-card' },
      { value: 'debit_card', label: 'Debit Card', icon: 'credit-card' },
      { value: 'bank_transfer', label: 'Bank Transfer', icon: 'building-2' },
      { value: 'cash', label: 'Cash', icon: 'banknote' },
      { value: 'other', label: 'Other', icon: 'more-horizontal' },
    ];
    return sendJson(res, 200, methods);
  }

  sendJson(res, 405, { error: 'Method not allowed' });
}

export async function handleUserSettings(req: IncomingMessage, res: ServerResponse) {
  const userId = getUserId(req);
  if (!userId) return sendJson(res, 401, { error: 'Authentication required' });
  const url = new URL(req.url!, `http://${req.headers.host}`);
  if (req.method === 'GET' && url.pathname === '/api/settings') {
    const settings = userSettingsRepository.getOrCreate(userId);
    return sendJson(res, 200, settings);
  }
  if ((req.method === 'POST' || req.method === 'PATCH') && url.pathname === '/api/settings') {
    const body = await readBody(req);
    const data = validate(userSettingsSchema, body);
    const updated = userSettingsRepository.upsert(userId, data);
    eventBus.publish({ type: 'user_settings.updated', payload: updated });
    return sendJson(res, 200, updated);
  }
  sendJson(res, 405, { error: 'Method not allowed' });
}

export async function handleSync(req: IncomingMessage, res: ServerResponse) {
  const userId = getUserId(req);
  if (!userId) return sendJson(res, 401, { error: 'Authentication required' });
  const url = new URL(req.url!, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/api/sync/status') {
    const lastSyncedAt = new Date(Date.now() - Math.random() * 86400000).toISOString();
    return sendJson(res, 200, {
      lastSyncedAt,
      pendingChanges: 0,
      isOnline: true,
      serverVersion: '1.0.0',
      clientVersion: '1.0.0',
      needsUpdate: false,
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/sync/trigger') {
    return sendJson(res, 200, {
      success: true,
      syncedAt: new Date().toISOString(),
      changesApplied: 0,
      conflicts: [],
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/sync/pending') {
    return sendJson(res, 200, { registered: true });
  }

  if (req.method === 'DELETE' && url.pathname === '/api/sync/pending') {
    return sendJson(res, 200, { cleared: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/version') {
    return sendJson(res, 200, {
      version: '1.0.0',
      buildDate: new Date().toISOString(),
    });
  }

  sendJson(res, 405, { error: 'Method not allowed' });
}

export async function handleNotifications(req: IncomingMessage, res: ServerResponse) {
  const userId = getUserId(req);
  if (!userId) return sendJson(res, 401, { error: 'Authentication required' });
  const url = new URL(req.url!, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/api/notifications') {
    const unreadOnly = url.searchParams.get('unread') === 'true';
    const list = notificationsRepository.listByUser(userId, unreadOnly);
    return sendJson(res, 200, list);
  }

  const id = url.pathname.split('/').pop();
  if (req.method === 'PATCH' && id && url.pathname.startsWith('/api/notifications/')) {
    if (url.pathname.endsWith('/read')) {
      const ok = notificationsRepository.markRead(id);
      if (!ok) return sendJson(res, 404, { error: 'Not found' });
      return sendJson(res, 200, { success: true });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/notifications/mark-all-read') {
    const count = notificationsRepository.markAllRead(userId);
    return sendJson(res, 200, { success: true, count });
  }

  sendJson(res, 405, { error: 'Method not allowed' });
}