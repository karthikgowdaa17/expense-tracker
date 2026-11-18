import { z } from 'zod';
export declare const profileSchema: z.ZodObject<{
    full_name: z.ZodOptional<z.ZodString>;
    avatar_url: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    currency: z.ZodDefault<z.ZodString>;
    theme: z.ZodDefault<z.ZodEnum<["light", "dark", "system"]>>;
    financial_year_start_month: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    currency: string;
    theme: "light" | "dark" | "system";
    financial_year_start_month: number;
    full_name?: string | undefined;
    avatar_url?: string | undefined;
}, {
    full_name?: string | undefined;
    avatar_url?: string | undefined;
    currency?: string | undefined;
    theme?: "light" | "dark" | "system" | undefined;
    financial_year_start_month?: number | undefined;
}>;
export declare const categorySchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodEnum<["income", "expense", "transfer", "refund"]>;
    icon: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    is_default: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type: "income" | "expense" | "transfer" | "refund";
    name: string;
    icon?: string | undefined;
    color?: string | undefined;
    is_default?: boolean | undefined;
}, {
    type: "income" | "expense" | "transfer" | "refund";
    name: string;
    icon?: string | undefined;
    color?: string | undefined;
    is_default?: boolean | undefined;
}>;
export declare const accountSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodEnum<["cash", "bank_account", "credit_card", "savings", "investment", "other"]>;
    opening_balance: z.ZodDefault<z.ZodNumber>;
    currency: z.ZodDefault<z.ZodString>;
    is_active: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type: "cash" | "bank_account" | "credit_card" | "savings" | "investment" | "other";
    currency: string;
    name: string;
    opening_balance: number;
    is_active: boolean;
}, {
    type: "cash" | "bank_account" | "credit_card" | "savings" | "investment" | "other";
    name: string;
    currency?: string | undefined;
    opening_balance?: number | undefined;
    is_active?: boolean | undefined;
}>;
export declare const transactionSchema: z.ZodObject<{
    date: z.ZodString;
    type: z.ZodEnum<["income", "expense", "transfer", "refund"]>;
    amount: z.ZodNumber;
    category: z.ZodOptional<z.ZodString>;
    subcategory: z.ZodOptional<z.ZodString>;
    description: z.ZodString;
    payment_method: z.ZodEnum<["cash", "upi", "credit_card", "debit_card", "bank_transfer", "other"]>;
    account: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
    is_recurring: z.ZodOptional<z.ZodBoolean>;
    recurring_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    split_from: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type: "income" | "expense" | "transfer" | "refund";
    date: string;
    amount: number;
    description: string;
    payment_method: "cash" | "credit_card" | "other" | "upi" | "debit_card" | "bank_transfer";
    account: string;
    category?: string | undefined;
    subcategory?: string | undefined;
    notes?: string | undefined;
    is_recurring?: boolean | undefined;
    recurring_id?: string | null | undefined;
    split_from?: string | null | undefined;
}, {
    type: "income" | "expense" | "transfer" | "refund";
    date: string;
    amount: number;
    description: string;
    payment_method: "cash" | "credit_card" | "other" | "upi" | "debit_card" | "bank_transfer";
    account: string;
    category?: string | undefined;
    subcategory?: string | undefined;
    notes?: string | undefined;
    is_recurring?: boolean | undefined;
    recurring_id?: string | null | undefined;
    split_from?: string | null | undefined;
}>;
export declare const budgetSchema: z.ZodObject<{
    category_id: z.ZodString;
    month: z.ZodString;
    amount: z.ZodNumber;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    category_id: string;
    month: string;
    notes?: string | undefined;
}, {
    amount: number;
    category_id: string;
    month: string;
    notes?: string | undefined;
}>;
export declare const recurringTransactionSchema: z.ZodObject<{
    name: z.ZodString;
    amount: z.ZodNumber;
    category: z.ZodString;
    subcategory: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    frequency: z.ZodEnum<["daily", "weekly", "monthly", "quarterly", "yearly", "custom"]>;
    start_date: z.ZodString;
    end_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    payment_method: z.ZodEnum<["cash", "upi", "credit_card", "debit_card", "bank_transfer", "other"]>;
    account: z.ZodString;
    day_of_month: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    day_of_week: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    is_active: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    is_active: boolean;
    amount: number;
    category: string;
    payment_method: "cash" | "credit_card" | "other" | "upi" | "debit_card" | "bank_transfer";
    account: string;
    frequency: "custom" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
    start_date: string;
    subcategory?: string | undefined;
    description?: string | undefined;
    end_date?: string | null | undefined;
    day_of_month?: number | null | undefined;
    day_of_week?: number | null | undefined;
}, {
    name: string;
    amount: number;
    category: string;
    payment_method: "cash" | "credit_card" | "other" | "upi" | "debit_card" | "bank_transfer";
    account: string;
    frequency: "custom" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
    start_date: string;
    is_active?: boolean | undefined;
    subcategory?: string | undefined;
    description?: string | undefined;
    end_date?: string | null | undefined;
    day_of_month?: number | null | undefined;
    day_of_week?: number | null | undefined;
}>;
export declare const userSettingsSchema: z.ZodObject<{
    currency: z.ZodDefault<z.ZodString>;
    theme: z.ZodDefault<z.ZodEnum<["light", "dark", "system"]>>;
    financial_year_start_month: z.ZodDefault<z.ZodNumber>;
    default_categories: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    default_payment_methods: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    default_accounts: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    currency: string;
    theme: "light" | "dark" | "system";
    financial_year_start_month: number;
    default_categories: string[];
    default_payment_methods: string[];
    default_accounts: string[];
}, {
    currency?: string | undefined;
    theme?: "light" | "dark" | "system" | undefined;
    financial_year_start_month?: number | undefined;
    default_categories?: string[] | undefined;
    default_payment_methods?: string[] | undefined;
    default_accounts?: string[] | undefined;
}>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const signupSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    full_name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    full_name?: string | undefined;
}, {
    email: string;
    password: string;
    full_name?: string | undefined;
}>;
export declare const refreshSchema: z.ZodObject<{
    refresh_token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refresh_token: string;
}, {
    refresh_token: string;
}>;
export declare const forgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const resetPasswordSchema: z.ZodEffects<z.ZodObject<{
    token: z.ZodString;
    password: z.ZodString;
    confirm_password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    token: string;
    confirm_password: string;
}, {
    password: string;
    token: string;
    confirm_password: string;
}>, {
    password: string;
    token: string;
    confirm_password: string;
}, {
    password: string;
    token: string;
    confirm_password: string;
}>;
export declare const verifyEmailSchema: z.ZodObject<{
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
}, {
    token: string;
}>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type AccountInput = z.infer<typeof accountSchema>;
export type TransactionInput = z.infer<typeof transactionSchema>;
export type BudgetInput = z.infer<typeof budgetSchema>;
export type RecurringTransactionInput = z.infer<typeof recurringTransactionSchema>;
export type UserSettingsInput = z.infer<typeof userSettingsSchema>;
//# sourceMappingURL=schemas.d.ts.map