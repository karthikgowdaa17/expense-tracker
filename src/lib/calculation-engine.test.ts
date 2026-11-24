import { describe, it, expect } from 'vitest';
import { CalculationEngine } from './calculation-engine';
import type { Transaction, Category, Budget, Account } from '@/types';

const makeTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  user_id: 'user-1',
  date: '2026-01-15',
  type: 'expense',
  amount: 100,
  category: 'Food',
  description: 'Lunch',
  payment_method: 'upi',
  account: 'Bank Account',
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-15T10:00:00Z',
  ...overrides,
});

const makeCategory = (overrides: Partial<Category> = {}): Category => ({
  id: 'cat-1',
  user_id: 'user-1',
  name: 'Food',
  type: 'expense',
  icon: 'utensils',
  color: '#F97316',
  is_default: true,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeBudget = (overrides: Partial<Budget> = {}): Budget => ({
  id: 'bud-1',
  user_id: 'user-1',
  category_id: 'cat-1',
  month: '2026-01',
  amount: 500,
  notes: '',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 'acc-1',
  user_id: 'user-1',
  name: 'Bank Account',
  type: 'bank_account',
  opening_balance: 1000,
  currency: 'INR',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('CalculationEngine', () => {
  describe('calculateTotalIncome / calculateTotalExpenses', () => {
    it('sums income and expenses correctly', () => {
      const engine = new CalculationEngine({
        transactions: [
          makeTransaction({ type: 'income', amount: 2000, date: '2026-01-10' }),
          makeTransaction({ type: 'income', amount: 500, date: '2026-01-20' }),
          makeTransaction({ type: 'expense', amount: 300, date: '2026-01-05' }),
          makeTransaction({ type: 'expense', amount: 200, date: '2026-01-15' }),
        ],
      });

      expect(engine.calculateTotalIncome()).toBe(2500);
      expect(engine.calculateTotalExpenses()).toBe(500);
    });

    it('filters by date range', () => {
      const engine = new CalculationEngine({
        transactions: [
          makeTransaction({ type: 'expense', amount: 100, date: '2026-01-05' }),
          makeTransaction({ type: 'expense', amount: 200, date: '2026-02-10' }),
        ],
      });

      const jan = new Date(2026, 0, 1);
      const feb = new Date(2026, 1, 1);
      expect(engine.calculateTotalExpenses(jan, feb)).toBe(100);
    });

    it('returns 0 for empty transactions', () => {
      const engine = new CalculationEngine();
      expect(engine.calculateTotalIncome()).toBe(0);
      expect(engine.calculateTotalExpenses()).toBe(0);
    });
  });

  describe('calculateSavings / calculateSavingsRate', () => {
    it('calculates savings and rate', () => {
      const engine = new CalculationEngine({
        transactions: [
          makeTransaction({ type: 'income', amount: 5000, date: '2026-01-10' }),
          makeTransaction({ type: 'expense', amount: 3000, date: '2026-01-15' }),
        ],
      });

      expect(engine.calculateSavings(5000, 3000)).toBe(2000);
      expect(engine.calculateSavingsRate(5000, 3000)).toBe(40);
      expect(engine.calculateSavingsRate(0, 100)).toBe(0);
    });
  });

  describe('calculateCategorySpending', () => {
    it('groups expenses by category', () => {
      const engine = new CalculationEngine({
        transactions: [
          makeTransaction({ type: 'expense', amount: 100, category: 'Food', date: '2026-01-05' }),
          makeTransaction({ type: 'expense', amount: 50, category: 'Food', date: '2026-01-10' }),
          makeTransaction({ type: 'expense', amount: 200, category: 'Transport', date: '2026-01-12' }),
          makeTransaction({ type: 'income', amount: 1000, category: 'Salary', date: '2026-01-20' }),
        ],
      });

      const spending = engine.calculateCategorySpending();
      expect(spending.Food).toBe(150);
      expect(spending.Transport).toBe(200);
      expect(spending.Salary).toBeUndefined();
    });
  });

  describe('calculateAccountBalances', () => {
    it('computes balances from opening balance + transactions', () => {
      const engine = new CalculationEngine({
        accounts: [makeAccount()],
        transactions: [
          makeTransaction({ type: 'income', amount: 500, account_id: 'acc-1', date: '2026-01-05' }),
          makeTransaction({ type: 'expense', amount: 200, account_id: 'acc-1', date: '2026-01-10' }),
          makeTransaction({
            type: 'transfer',
            amount: 100,
            account_id: 'acc-1',
            transfer_direction: 'out',
            date: '2026-01-15',
          }),
        ],
      });

      const balances = engine.calculateAccountBalances();
      // 1000 opening + 500 income - 200 expense - 100 transfer out = 1200
      expect(balances['acc-1']).toBe(1200);
    });

    it('handles transfer direction in', () => {
      const engine = new CalculationEngine({
        accounts: [makeAccount()],
        transactions: [
          makeTransaction({
            type: 'transfer',
            amount: 300,
            account_id: 'acc-1',
            transfer_direction: 'in',
            date: '2026-01-05',
          }),
        ],
      });

      expect(engine.calculateAccountBalances()['acc-1']).toBe(1300);
    });
  });

  describe('calculateBudgetUsage', () => {
    it('computes budget usage with over-budget flag', () => {
      const engine = new CalculationEngine({
        categories: [makeCategory()],
        budgets: [makeBudget()],
        transactions: [
          makeTransaction({ type: 'expense', amount: 600, category: 'Food', date: '2026-01-10' }),
        ],
      });

      const usage = engine.calculateBudgetUsage('2026-01');
      expect(usage['Food'].used).toBe(600);
      expect(usage['Food'].budget).toBe(500);
      expect(usage['Food'].isOverBudget).toBe(true);
      expect(usage['Food'].remaining).toBe(-100);
    });

    it('returns 0 budget when none set', () => {
      const engine = new CalculationEngine({
        categories: [makeCategory()],
        transactions: [
          makeTransaction({ type: 'expense', amount: 100, category: 'Food', date: '2026-01-10' }),
        ],
      });

      const usage = engine.calculateBudgetUsage('2026-01');
      expect(usage['Food'].budget).toBe(0);
      expect(usage['Food'].isOverBudget).toBe(false);
    });
  });

  describe('calculateMonthlySummary', () => {
    it('produces a full monthly summary', () => {
      const engine = new CalculationEngine({
        categories: [makeCategory()],
        budgets: [makeBudget()],
        transactions: [
          makeTransaction({ type: 'income', amount: 3000, date: '2026-01-10' }),
          makeTransaction({ type: 'expense', amount: 600, category: 'Food', date: '2026-01-15' }),
        ],
      });

      const summary = engine.calculateMonthlySummary('2026-01');
      expect(summary.month).toBe('2026-01');
      expect(summary.year).toBe(2026);
      expect(summary.income).toBe(3000);
      expect(summary.expenses).toBe(600);
      expect(summary.savings).toBe(2400);
      expect(summary.category_breakdown.length).toBe(1);
      expect(summary.category_breakdown[0].category).toBe('Food');
      expect(summary.category_breakdown[0].is_over_budget).toBe(true);
    });
  });

  describe('calculateYearlySummary', () => {
    it('aggregates monthly data into yearly summary', () => {
      const engine = new CalculationEngine({
        transactions: [
          makeTransaction({ type: 'income', amount: 12000, date: '2026-03-10' }),
          makeTransaction({ type: 'expense', amount: 7200, date: '2026-06-15' }),
        ],
      });

      const summary = engine.calculateYearlySummary(2026);
      expect(summary.year).toBe(2026);
      expect(summary.income).toBe(12000);
      expect(summary.expenses).toBe(7200);
      expect(summary.savings).toBe(4800);
      expect(summary.monthly_data.length).toBe(12);
    });
  });

  describe('getDashboardMetrics', () => {
    it('returns dashboard metrics', () => {
      const engine = new CalculationEngine({
        accounts: [makeAccount()],
        categories: [makeCategory()],
        budgets: [makeBudget()],
        transactions: [
          makeTransaction({ type: 'income', amount: 5000, account_id: 'acc-1', date: '2026-01-10' }),
          makeTransaction({ type: 'expense', amount: 2000, category: 'Food', account_id: 'acc-1', date: '2026-01-15' }),
        ],
      });

      const metrics = engine.getDashboardMetrics('2026-01');
      expect(metrics.monthly_income).toBe(5000);
      expect(metrics.monthly_expenses).toBe(2000);
      expect(metrics.monthly_savings).toBe(3000);
      expect(metrics.current_balance).toBe(4000); // 1000 + 5000 - 2000
      expect(metrics.account_balances['acc-1']).toBe(4000);
    });
  });

  describe('reconcileAccounts', () => {
    it('detects discrepancies between calculated and expected balances', () => {
      const engine = new CalculationEngine({
        accounts: [makeAccount({ current_balance: 9999 })],
        transactions: [
          makeTransaction({ type: 'income', amount: 100, account_id: 'acc-1', date: '2026-01-05' }),
        ],
      });

      const result = engine.reconcileAccounts();
      expect(result.balanced).toBe(false);
      expect(result.discrepancies.length).toBe(1);
      expect(result.discrepancies[0].account).toBe('Bank Account');
    });

    it('reports balanced when no discrepancies', () => {
      const engine = new CalculationEngine({
        accounts: [makeAccount({ current_balance: 1100 })],
        transactions: [
          makeTransaction({ type: 'income', amount: 100, account_id: 'acc-1', date: '2026-01-05' }),
        ],
      });

      const result = engine.reconcileAccounts();
      expect(result.balanced).toBe(true);
      expect(result.discrepancies.length).toBe(0);
    });
  });

  describe('validateSplitTransaction', () => {
    it('validates when splits match total', () => {
      const engine = new CalculationEngine();
      const result = engine.validateSplitTransaction(100, [
        { category: 'Food', amount: 60 },
        { category: 'Transport', amount: 40 },
      ]);
      expect(result.valid).toBe(true);
    });

    it('rejects when splits do not match total', () => {
      const engine = new CalculationEngine();
      const result = engine.validateSplitTransaction(100, [
        { category: 'Food', amount: 60 },
        { category: 'Transport', amount: 50 },
      ]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must equal total amount');
    });
  });

  describe('calculateMonthlyProjection', () => {
    it('projects month-end spending from daily average', () => {
      const engine = new CalculationEngine({
        transactions: [
          makeTransaction({ type: 'expense', amount: 300, date: '2026-01-10' }),
        ],
      });

      const proj = engine.calculateMonthlyProjection('2026-01');
      expect(proj.spent).toBe(300);
      expect(proj.daysInMonth).toBe(31);
      expect(proj.elapsedDays).toBeGreaterThan(0);
      expect(proj.projected).toBeGreaterThanOrEqual(proj.spent);
    });
  });
});
