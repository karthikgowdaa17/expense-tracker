import { eventBus } from '../events/eventBus.js';
import {} from '../repositories/usersRepository.js';
import { profilesRepository } from '../repositories/profilesRepository.js';
import { categoriesRepository } from '../repositories/categoriesRepository.js';
import { accountsRepository } from '../repositories/accountsRepository.js';
import { transactionsRepository } from '../repositories/transactionsRepository.js';
import { budgetsRepository } from '../repositories/budgetsRepository.js';
import { recurringTransactionsRepository } from '../repositories/recurringTransactionsRepository.js';
import { userSettingsRepository } from '../repositories/userSettingsRepository.js';
import { profileSchema, categorySchema, accountSchema, transactionSchema, budgetSchema, recurringTransactionSchema, userSettingsSchema } from '../validation/schemas.js';
const EXPENSE_KEYWORDS = {
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
const INCOME_KEYWORDS = {
    'Salary': ['salary', 'payroll', 'stipend', 'wages', 'credited', 'deposit', 'transfer from'],
    'Freelance': ['freelance', 'upwork', 'fiverr', 'freelancer', 'contract', 'project payment', 'client payment'],
    'Business': ['business', 'revenue', 'sales', 'turnover', 'profit', 'merchant', 'shop income'],
    'Interest': ['interest', 'fd interest', 'savings interest', 'bank interest', 'rd interest'],
    'Investment': ['investment', 'mutual fund', 'stock', 'equity', 'dividend', 'capital gain', 'sip', 'redemption'],
    'Gift': ['gift', 'cashback', 'refund', 'reward', 'bonus', 'prize'],
    'Other Income': [],
};
function normalizeText(text) {
    return text.toLowerCase().trim().replace(/[^a-z0-9\s]/g, ' ');
}
function calculateMatchScore(description, keywords) {
    const normalized = normalizeText(description);
    let score = 0;
    for (const keyword of keywords) {
        if (normalized.includes(keyword.toLowerCase())) {
            score += keyword.length;
        }
    }
    return score;
}
function suggestCategory(description, categories, type) {
    if (!description || !categories.length)
        return null;
    const userCategories = categories.filter(c => c.type === type);
    if (!userCategories.length)
        return null;
    const keywordMap = type === 'expense' ? EXPENSE_KEYWORDS : INCOME_KEYWORDS;
    let bestMatch = null;
    for (const [categoryName, keywords] of Object.entries(keywordMap)) {
        const matchingCategory = userCategories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
        if (!matchingCategory)
            continue;
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
    if (otherCategory)
        return otherCategory.name;
    // If no "Other" category, return the first category of the type
    return userCategories[0]?.name ?? null;
}
import { authenticateRequest } from './auth.js';
export class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
export function getUserId(req) {
    const user = authenticateRequest(req);
    return user?.id ?? null;
}
export function requireAuth(req) {
    const user = authenticateRequest(req);
    if (!user) {
        throw new ValidationError('Authentication required');
    }
    return user;
}
function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => {
            try {
                resolve(data ? JSON.parse(data) : {});
            }
            catch {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}
function sendJson(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
}
function validate(schema, data) {
    const result = schema.safeParse(data);
    if (!result.success) {
        const msg = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        throw new ValidationError(msg);
    }
    return result.data;
}
export async function handleProfiles(req, res) {
    const userId = getUserId(req);
    if (!userId)
        return sendJson(res, 401, { error: 'Authentication required' });
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
export async function handleCategories(req, res) {
    const userId = getUserId(req);
    if (!userId)
        return sendJson(res, 401, { error: 'Authentication required' });
    const url = new URL(req.url, `http://${req.headers.host}`);
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
        if (!updated)
            return sendJson(res, 404, { error: 'Not found' });
        eventBus.publish({ type: 'category.updated', payload: updated });
        return sendJson(res, 200, updated);
    }
    if (req.method === 'DELETE' && id && url.pathname.startsWith('/api/categories/')) {
        const ok = categoriesRepository.delete(id);
        if (!ok)
            return sendJson(res, 404, { error: 'Not found' });
        eventBus.publish({ type: 'category.deleted', payload: { id } });
        return sendJson(res, 204, null);
    }
    sendJson(res, 405, { error: 'Method not allowed' });
}
export async function handleAccounts(req, res) {
    const userId = getUserId(req);
    if (!userId)
        return sendJson(res, 401, { error: 'Authentication required' });
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'GET' && url.pathname === '/api/accounts') {
        const list = accountsRepository.listByUser(userId);
        return sendJson(res, 200, list);
    }
    if (req.method === 'POST' && url.pathname === '/api/accounts') {
        const body = await readBody(req);
        const data = validate(accountSchema, body);
        const created = accountsRepository.create(userId, data);
        eventBus.publish({ type: 'account.created', payload: created });
        return sendJson(res, 201, created);
    }
    const id = url.pathname.split('/').pop();
    if (req.method === 'PATCH' && id && url.pathname.startsWith('/api/accounts/')) {
        const body = await readBody(req);
        const data = validate(accountSchema.partial(), body);
        const updated = accountsRepository.update(id, data);
        if (!updated)
            return sendJson(res, 404, { error: 'Not found' });
        eventBus.publish({ type: 'account.updated', payload: updated });
        return sendJson(res, 200, updated);
    }
    if (req.method === 'DELETE' && id && url.pathname.startsWith('/api/accounts/')) {
        const ok = accountsRepository.delete(id);
        if (!ok)
            return sendJson(res, 404, { error: 'Not found' });
        eventBus.publish({ type: 'account.deleted', payload: { id } });
        return sendJson(res, 204, null);
    }
    sendJson(res, 405, { error: 'Method not allowed' });
}
export async function handleTransactions(req, res) {
    const userId = getUserId(req);
    if (!userId)
        return sendJson(res, 401, { error: 'Authentication required' });
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'GET' && url.pathname === '/api/transactions') {
        const filters = {
            dateFrom: url.searchParams.get('dateFrom') || undefined,
            dateTo: url.searchParams.get('dateTo') || undefined,
            type: url.searchParams.get('type') || undefined,
            category: url.searchParams.get('category') || undefined,
            paymentMethod: url.searchParams.get('paymentMethod') || undefined,
            account: url.searchParams.get('account') || undefined,
            search: url.searchParams.get('search') || undefined,
            limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit'), 10) : undefined,
            offset: url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset'), 10) : undefined,
        };
        const list = transactionsRepository.listByUser(userId, filters);
        return sendJson(res, 200, list);
    }
    if (req.method === 'POST' && url.pathname === '/api/transactions') {
        const body = await readBody(req);
        const data = validate(transactionSchema, body);
        // Auto-categorize if no category provided
        if (!data.category) {
            const categories = categoriesRepository.listByUser(userId);
            const suggested = suggestCategory(data.description, categories, data.type);
            if (suggested) {
                data.category = suggested;
            }
        }
        const created = transactionsRepository.create(userId, data);
        eventBus.publish({ type: 'transaction.created', payload: created });
        return sendJson(res, 201, created);
    }
    const id = url.pathname.split('/').pop();
    if (req.method === 'PATCH' && id && url.pathname.startsWith('/api/transactions/')) {
        const body = await readBody(req);
        const data = validate(transactionSchema.partial(), body);
        const updated = transactionsRepository.update(id, data);
        if (!updated)
            return sendJson(res, 404, { error: 'Not found' });
        eventBus.publish({ type: 'transaction.updated', payload: updated });
        return sendJson(res, 200, updated);
    }
    if (req.method === 'DELETE' && id && url.pathname.startsWith('/api/transactions/')) {
        const ok = transactionsRepository.delete(id);
        if (!ok)
            return sendJson(res, 404, { error: 'Not found' });
        eventBus.publish({ type: 'transaction.deleted', payload: { id } });
        return sendJson(res, 204, null);
    }
    sendJson(res, 405, { error: 'Method not allowed' });
}
export async function handleBudgets(req, res) {
    const userId = getUserId(req);
    if (!userId)
        return sendJson(res, 401, { error: 'Authentication required' });
    const url = new URL(req.url, `http://${req.headers.host}`);
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
        return sendJson(res, 201, created);
    }
    const id = url.pathname.split('/').pop();
    if (req.method === 'PATCH' && id && url.pathname.startsWith('/api/budgets/')) {
        const body = await readBody(req);
        const data = validate(budgetSchema.partial(), body);
        const updated = budgetsRepository.update(id, data);
        if (!updated)
            return sendJson(res, 404, { error: 'Not found' });
        eventBus.publish({ type: 'budget.updated', payload: updated });
        return sendJson(res, 200, updated);
    }
    if (req.method === 'DELETE' && id && url.pathname.startsWith('/api/budgets/')) {
        const ok = budgetsRepository.delete(id);
        if (!ok)
            return sendJson(res, 404, { error: 'Not found' });
        eventBus.publish({ type: 'budget.deleted', payload: { id } });
        return sendJson(res, 204, null);
    }
    sendJson(res, 405, { error: 'Method not allowed' });
}
export async function handleRecurring(req, res) {
    const userId = getUserId(req);
    if (!userId)
        return sendJson(res, 401, { error: 'Authentication required' });
    const url = new URL(req.url, `http://${req.headers.host}`);
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
        if (!updated)
            return sendJson(res, 404, { error: 'Not found' });
        eventBus.publish({ type: 'recurring_transaction.updated', payload: updated });
        return sendJson(res, 200, updated);
    }
    if (req.method === 'DELETE' && id && url.pathname.startsWith('/api/recurring/')) {
        const ok = recurringTransactionsRepository.delete(id);
        if (!ok)
            return sendJson(res, 404, { error: 'Not found' });
        eventBus.publish({ type: 'recurring_transaction.deleted', payload: { id } });
        return sendJson(res, 204, null);
    }
    if (req.method === 'POST' && url.pathname === '/api/recurring/toggle') {
        const body = await readBody(req);
        const { id: recId } = body;
        const updated = recurringTransactionsRepository.toggleActive(recId);
        if (!updated)
            return sendJson(res, 404, { error: 'Not found' });
        eventBus.publish({ type: 'recurring_transaction.updated', payload: updated });
        return sendJson(res, 200, updated);
    }
    sendJson(res, 405, { error: 'Method not allowed' });
}
export async function handleUserSettings(req, res) {
    const userId = getUserId(req);
    if (!userId)
        return sendJson(res, 401, { error: 'Authentication required' });
    const url = new URL(req.url, `http://${req.headers.host}`);
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
//# sourceMappingURL=index.js.map