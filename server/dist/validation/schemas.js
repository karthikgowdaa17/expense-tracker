import { z } from 'zod';
export const profileSchema = z.object({
    full_name: z.string().optional(),
    avatar_url: z.string().url().optional().or(z.literal('')),
    currency: z.string().default('INR'),
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    financial_year_start_month: z.number().int().min(1).max(12).default(4),
});
export const categorySchema = z.object({
    name: z.string().min(1),
    type: z.enum(['income', 'expense', 'transfer', 'refund']),
    icon: z.string().optional(),
    color: z.string().optional(),
    is_default: z.boolean().optional(),
});
export const accountSchema = z.object({
    name: z.string().min(1),
    type: z.enum(['cash', 'bank_account', 'credit_card', 'savings', 'investment', 'other']),
    bank_name: z.string().optional().nullable(),
    account_number_last4: z.string().regex(/^\d{4}$/, 'Must be exactly 4 digits').optional().nullable(),
    opening_balance: z.number().default(0),
    currency: z.string().default('INR'),
    is_active: z.boolean().default(true),
});
export const transactionSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    type: z.enum(['income', 'expense', 'transfer', 'refund']),
    amount: z.number().positive(),
    category: z.string().min(1).optional(),
    subcategory: z.string().optional(),
    description: z.string().min(1),
    payment_method: z.enum(['cash', 'upi', 'credit_card', 'debit_card', 'bank_transfer', 'other']),
    account: z.string().min(1),
    account_id: z.string().uuid().optional().nullable(),
    transfer_direction: z.enum(['in', 'out']).optional().nullable(),
    notes: z.string().optional(),
    is_recurring: z.boolean().optional(),
    recurring_id: z.string().uuid().optional().nullable(),
    split_from: z.string().uuid().optional().nullable(),
});
export const budgetSchema = z.object({
    category_id: z.string().uuid(),
    month: z.string().regex(/^\d{4}-\d{2}$/),
    amount: z.number().positive(),
    notes: z.string().optional(),
});
export const recurringTransactionSchema = z.object({
    name: z.string().min(1),
    amount: z.number().positive(),
    category: z.string().min(1),
    subcategory: z.string().optional(),
    description: z.string().optional(),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom']),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    payment_method: z.enum(['cash', 'upi', 'credit_card', 'debit_card', 'bank_transfer', 'other']),
    account: z.string().min(1),
    day_of_month: z.number().int().min(1).max(31).optional().nullable(),
    day_of_week: z.number().int().min(0).max(6).optional().nullable(),
    is_active: z.boolean().default(true),
});
export const userSettingsSchema = z.object({
    currency: z.string().default('INR'),
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    financial_year_start_month: z.number().int().min(1).max(12).default(4),
    default_categories: z.array(z.string()).default([]),
    default_payment_methods: z.array(z.string()).default([]),
    default_accounts: z.array(z.string()).default([]),
});
export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
});
export const signupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    full_name: z.string().optional(),
});
export const refreshSchema = z.object({
    refresh_token: z.string().min(1),
});
export const forgotPasswordSchema = z.object({
    email: z.string().email(),
});
export const resetPasswordSchema = z.object({
    token: z.string().min(1),
    password: z.string().min(8),
    confirm_password: z.string().min(8),
}).refine(data => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
});
export const verifyEmailSchema = z.object({
    token: z.string().min(1),
});
//# sourceMappingURL=schemas.js.map