export type TransactionType = 'income' | 'expense' | 'transfer' | 'refund';

export type PaymentMethod = 
  | 'cash' 
  | 'upi' 
  | 'credit_card' 
  | 'debit_card' 
  | 'bank_transfer' 
  | 'other';

export type AccountType = 
  | 'cash' 
  | 'bank_account' 
  | 'credit_card' 
  | 'savings' 
  | 'investment' 
  | 'other';

export type Frequency = 
  | 'daily' 
  | 'weekly' 
  | 'monthly' 
  | 'quarterly' 
  | 'yearly' 
  | 'custom';

export interface Transaction {
  id: string;
  user_id: string;
  date: string;
  type: TransactionType;
  amount: number;
  category: string;
  subcategory?: string;
  description: string;
  payment_method: PaymentMethod;
  account: string;
  notes?: string;
  is_recurring?: boolean;
  recurring_id?: string;
  split_from?: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: TransactionType;
  icon?: string;
  color?: string;
  is_default?: boolean;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  month: string;
  amount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface RecurringTransaction {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  category: string;
  subcategory?: string;
  description?: string;
  frequency: Frequency;
  start_date: string;
  end_date?: string;
  payment_method: PaymentMethod;
  account: string;
  day_of_month?: number;
  day_of_week?: number;
  is_active: boolean;
  last_generated?: string;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  opening_balance: number;
  current_balance?: number;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  currency: string;
  theme: 'light' | 'dark' | 'system';
  financial_year_start_month: number;
  default_categories: string[];
  default_payment_methods: PaymentMethod[];
  default_accounts: string[];
  created_at: string;
  updated_at: string;
}

export interface MonthlySummary {
  month: string;
  year: number;
  income: number;
  expenses: number;
  savings: number;
  savings_rate: number;
  category_breakdown: CategoryBreakdown[];
}

export interface CategoryBreakdown {
  category: string;
  budget: number;
  actual: number;
  remaining: number;
  percentage: number;
  is_over_budget: boolean;
}

export interface YearlySummary {
  year: number;
  income: number;
  expenses: number;
  savings: number;
  savings_rate: number;
  monthly_data: MonthlySummary[];
  highest_spending_month: string;
  lowest_spending_month: string;
  highest_spending_category: string;
  average_monthly_income: number;
  average_monthly_expenses: number;
  average_monthly_savings: number;
}

export interface FinancialMetrics {
  total_income: number;
  total_expenses: number;
  total_savings: number;
  savings_rate: number;
  current_balance: number;
  monthly_income: number;
  monthly_expenses: number;
  monthly_savings: number;
  monthly_savings_rate: number;
  previous_month_expenses: number;
  spending_change: number;
  category_spending: Record<string, number>;
  budget_usage: Record<string, { used: number; budget: number; percentage: number }>;
  account_balances: Record<string, number>;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export type ViewMode = 'monthly' | 'quarterly' | 'yearly' | 'financial_year' | 'custom';

export const DEFAULT_CATEGORIES = {
  income: [
    { name: 'Salary', icon: 'briefcase', color: '#10B981' },
    { name: 'Bonus', icon: 'gift', color: '#059669' },
    { name: 'Freelance', icon: 'laptop', color: '#0D9488' },
    { name: 'Business', icon: 'building', color: '#0891B2' },
    { name: 'Investment', icon: 'trending-up', color: '#7C3AED' },
    { name: 'Other Income', icon: 'plus-circle', color: '#6B7280' },
  ],
  expense: [
    { name: 'Housing', icon: 'home', color: '#EF4444' },
    { name: 'Food', icon: 'utensils', color: '#F97316' },
    { name: 'Transportation', icon: 'car', color: '#EAB308' },
    { name: 'Shopping', icon: 'shopping-bag', color: '#EC4899' },
    { name: 'Entertainment', icon: 'film', color: '#8B5CF6' },
    { name: 'Bills & Utilities', icon: 'file-text', color: '#06B6D4' },
    { name: 'Health', icon: 'heart-pulse', color: '#F43F5E' },
    { name: 'Education', icon: 'graduation-cap', color: '#6366F1' },
    { name: 'Travel', icon: 'plane', color: '#14B8A6' },
    { name: 'Other', icon: 'more-horizontal', color: '#9CA3AF' },
  ],
};

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'cash', label: 'Cash', icon: 'banknote' },
  { value: 'upi', label: 'UPI', icon: 'smartphone' },
  { value: 'credit_card', label: 'Credit Card', icon: 'credit-card' },
  { value: 'debit_card', label: 'Debit Card', icon: 'credit-card' },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: 'building-2' },
  { value: 'other', label: 'Other', icon: 'more-horizontal' },
];

export const ACCOUNT_TYPES: { value: AccountType; label: string; icon: string }[] = [
  { value: 'cash', label: 'Cash', icon: 'banknote' },
  { value: 'bank_account', label: 'Bank Account', icon: 'building-2' },
  { value: 'credit_card', label: 'Credit Card', icon: 'credit-card' },
  { value: 'savings', label: 'Savings', icon: 'piggy-bank' },
  { value: 'investment', label: 'Investment', icon: 'trending-up' },
  { value: 'other', label: 'Other', icon: 'more-horizontal' },
];

export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom' },
];

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  currency: string;
  theme: 'light' | 'dark' | 'system';
  financial_year_start_month: number;
  created_at: string;
  updated_at: string;
}