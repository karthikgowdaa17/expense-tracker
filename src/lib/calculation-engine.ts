import { Transaction, Category, Budget, Account, MonthlySummary, CategoryBreakdown, FinancialMetrics, YearlySummary, ChartDataPoint } from '@/types';
import { 
  formatCurrency, 
  calculatePercentage, 
  safeDivide, 
  roundToTwoDecimals,
  toPaise,
  fromPaise 
} from '@/utils/currency';
import { 
  getMonthKey, 
  parseMonthKey, 
  getMonthRange, 
  getYearRange,
  getFinancialYearRange,
  getElapsedDaysInMonth,
  getDaysInMonthForDate,
  isSameMonth,
  isSameYear,
  differenceInMonths,
  formatMonthYear
} from '@/utils/date';

export class CalculationEngine {
  private transactions: Transaction[] = [];
  private categories: Category[] = [];
  private budgets: Budget[] = [];
  private accounts: Account[] = [];

  constructor(data: { 
    transactions?: Transaction[]; 
    categories?: Category[]; 
    budgets?: Budget[]; 
    accounts?: Account[] 
  } = {}) {
    this.transactions = data.transactions || [];
    this.categories = data.categories || [];
    this.budgets = data.budgets || [];
    this.accounts = data.accounts || [];
  }

  updateData(data: { 
    transactions?: Transaction[]; 
    categories?: Category[]; 
    budgets?: Budget[]; 
    accounts?: Account[] 
  }) {
    if (data.transactions) this.transactions = data.transactions;
    if (data.categories) this.categories = data.categories;
    if (data.budgets) this.budgets = data.budgets;
    if (data.accounts) this.accounts = data.accounts;
  }

  private getTransactionsForPeriod(start: Date, end: Date): Transaction[] {
    const startStr = start.toISOString().split('T')[0];
    // end is exclusive: first day of next month
    const endStr = end.toISOString().split('T')[0];
    return this.transactions.filter(t => t.date >= startStr && t.date < endStr);
  }

  private getTransactionsByType(type: Transaction['type'], start?: Date, end?: Date): Transaction[] {
    let filtered = this.transactions.filter(t => t.type === type);
    if (start && end) {
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
      filtered = filtered.filter(t => t.date >= startStr && t.date < endStr);
    }
    return filtered;
  }

  calculateTotalIncome(start?: Date, end?: Date): number {
    const transactions = this.getTransactionsByType('income', start, end);
    return transactions.reduce((sum, t) => sum + t.amount, 0);
  }

  calculateTotalExpenses(start?: Date, end?: Date): number {
    const transactions = this.getTransactionsByType('expense', start, end);
    return transactions.reduce((sum, t) => sum + t.amount, 0);
  }

  calculateTotalTransfers(start?: Date, end?: Date): number {
    const transactions = this.getTransactionsByType('transfer', start, end);
    return transactions.reduce((sum, t) => sum + t.amount, 0);
  }

  calculateTotalRefunds(start?: Date, end?: Date): number {
    const transactions = this.getTransactionsByType('refund', start, end);
    return transactions.reduce((sum, t) => sum + t.amount, 0);
  }

  calculateSavings(income: number, expenses: number): number {
    return income - expenses;
  }

  calculateSavingsRate(income: number, expenses: number): number {
    if (income === 0) return 0;
    return calculatePercentage(this.calculateSavings(income, expenses), income);
  }

  calculateCategorySpending(start?: Date, end?: Date): Record<string, number> {
    const expenses = this.getTransactionsByType('expense', start, end);
    const breakdown: Record<string, number> = {};
    
    expenses.forEach(t => {
      breakdown[t.category] = (breakdown[t.category] || 0) + t.amount;
    });
    
    return breakdown;
  }

  calculateCategoryIncome(start?: Date, end?: Date): Record<string, number> {
    const income = this.getTransactionsByType('income', start, end);
    const breakdown: Record<string, number> = {};
    
    income.forEach(t => {
      breakdown[t.category] = (breakdown[t.category] || 0) + t.amount;
    });
    
    return breakdown;
  }

  calculatePaymentMethodBreakdown(start?: Date, end?: Date): Record<string, number> {
    const expenses = this.getTransactionsByType('expense', start, end);
    const breakdown: Record<string, number> = {};
    
    expenses.forEach(t => {
      breakdown[t.payment_method] = (breakdown[t.payment_method] || 0) + t.amount;
    });
    
    return breakdown;
  }

  calculateAccountBalances(): Record<string, number> {
    const balances: Record<string, number> = {};
    
    this.accounts.forEach(acc => {
      balances[acc.id] = acc.opening_balance;
    });
    
    this.transactions.forEach(t => {
      if (!balances[t.account]) balances[t.account] = 0;
      
      if (t.type === 'income' || t.type === 'refund') {
        balances[t.account] += t.amount;
      } else if (t.type === 'expense') {
        balances[t.account] -= t.amount;
      } else if (t.type === 'transfer') {
        balances[t.account] -= t.amount;
      }
    });
    
    return balances;
  }

  calculateNetWorth(): number {
    const balances = this.calculateAccountBalances();
    return Object.values(balances).reduce((sum, bal) => sum + bal, 0);
  }

  getBudgetForCategory(categoryId: string, monthKey: string): number {
    const budget = this.budgets.find(b => b.category_id === categoryId && b.month === monthKey);
    return budget?.amount || 0;
  }

  calculateBudgetUsage(monthKey: string): Record<string, { used: number; budget: number; percentage: number; remaining: number; isOverBudget: boolean }> {
    const { start, end } = getMonthRange(parseMonthKey(monthKey));
    const categorySpending = this.calculateCategorySpending(start, end);
    const usage: Record<string, { used: number; budget: number; percentage: number; remaining: number; isOverBudget: boolean }> = {};
    
    this.categories.filter(c => c.type === 'expense').forEach(cat => {
      const budget = this.getBudgetForCategory(cat.id, monthKey);
      const used = categorySpending[cat.name] || 0;
      const percentage = budget > 0 ? calculatePercentage(used, budget) : 0;
      const remaining = budget - used;
      
      usage[cat.name] = {
        used,
        budget,
        percentage,
        remaining,
        isOverBudget: used > budget && budget > 0,
      };
    });
    
    return usage;
  }

  calculateMonthlySummary(monthKey: string): MonthlySummary {
    const date = parseMonthKey(monthKey);
    const { start, end } = getMonthRange(date);
    
    const income = this.calculateTotalIncome(start, end);
    const expenses = this.calculateTotalExpenses(start, end);
    const savings = this.calculateSavings(income, expenses);
    const savingsRate = this.calculateSavingsRate(income, expenses);
    
    const categorySpending = this.calculateCategorySpending(start, end);
    const budgetUsage = this.calculateBudgetUsage(monthKey);
    
    const categoryBreakdown: CategoryBreakdown[] = Object.entries(categorySpending).map(([category, actual]) => {
      const budgetInfo = budgetUsage[category] || { budget: 0, used: 0, percentage: 0, remaining: 0, isOverBudget: false };
      return {
        category,
        budget: budgetInfo.budget,
        actual,
        remaining: budgetInfo.remaining,
        percentage: budgetInfo.percentage,
        is_over_budget: budgetInfo.isOverBudget,
      };
    });
    
    return {
      month: getMonthKey(date),
      year: date.getFullYear(),
      income,
      expenses,
      savings,
      savings_rate: savingsRate,
      category_breakdown: categoryBreakdown,
    };
  }

  calculateYearlySummary(year: number): YearlySummary {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    
    const monthlyData: MonthlySummary[] = [];
    let totalIncome = 0;
    let totalExpenses = 0;
    const categoryTotals: Record<string, number> = {};
    let highestSpendingMonth = '';
    let lowestSpendingMonth = '';
    let maxExpenses = 0;
    let minExpenses = Infinity;
    
    for (let month = 0; month < 12; month++) {
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      const summary = this.calculateMonthlySummary(monthKey);
      monthlyData.push(summary);
      
      totalIncome += summary.income;
      totalExpenses += summary.expenses;
      
      if (summary.expenses > maxExpenses) {
        maxExpenses = summary.expenses;
        highestSpendingMonth = summary.month;
      }
      
      if (summary.expenses < minExpenses && summary.expenses > 0) {
        minExpenses = summary.expenses;
        lowestSpendingMonth = summary.month;
      }
      
      summary.category_breakdown.forEach(cat => {
        categoryTotals[cat.category] = (categoryTotals[cat.category] || 0) + cat.actual;
      });
    }
    
    const highestSpendingCategory = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    
    return {
      year,
      income: totalIncome,
      expenses: totalExpenses,
      savings: totalIncome - totalExpenses,
      savings_rate: this.calculateSavingsRate(totalIncome, totalExpenses),
      monthly_data: monthlyData,
      highest_spending_month: highestSpendingMonth,
      lowest_spending_month: lowestSpendingMonth,
      highest_spending_category: highestSpendingCategory,
      average_monthly_income: safeDivide(totalIncome, 12),
      average_monthly_expenses: safeDivide(totalExpenses, 12),
      average_monthly_savings: safeDivide(totalIncome - totalExpenses, 12),
    };
  }

  calculateFinancialYearSummary(startDate: Date): YearlySummary {
    const { start, end } = getFinancialYearRange(startDate);
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    
    let totalIncome = 0;
    let totalExpenses = 0;
    const monthlyData: MonthlySummary[] = [];
    const categoryTotals: Record<string, number> = {};
    let highestSpendingMonth = '';
    let lowestSpendingMonth = '';
    let maxExpenses = 0;
    let minExpenses = Infinity;
    
    let current = new Date(start);
    while (current <= end) {
      const monthKey = getMonthKey(current);
      const summary = this.calculateMonthlySummary(monthKey);
      monthlyData.push(summary);
      
      totalIncome += summary.income;
      totalExpenses += summary.expenses;
      
      if (summary.expenses > maxExpenses) {
        maxExpenses = summary.expenses;
        highestSpendingMonth = summary.month;
      }
      
      if (summary.expenses < minExpenses && summary.expenses > 0) {
        minExpenses = summary.expenses;
        lowestSpendingMonth = summary.month;
      }
      
      summary.category_breakdown.forEach(cat => {
        categoryTotals[cat.category] = (categoryTotals[cat.category] || 0) + cat.actual;
      });
      
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }
    
    const highestSpendingCategory = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    
    const monthCount = monthlyData.length;
    
    return {
      year: startYear,
      income: totalIncome,
      expenses: totalExpenses,
      savings: totalIncome - totalExpenses,
      savings_rate: this.calculateSavingsRate(totalIncome, totalExpenses),
      monthly_data: monthlyData,
      highest_spending_month: highestSpendingMonth,
      lowest_spending_month: lowestSpendingMonth,
      highest_spending_category: highestSpendingCategory,
      average_monthly_income: safeDivide(totalIncome, monthCount),
      average_monthly_expenses: safeDivide(totalExpenses, monthCount),
      average_monthly_savings: safeDivide(totalIncome - totalExpenses, monthCount),
    };
  }

  calculateMonthOverMonthChange(currentMonthKey: string): {
    incomeChange: number;
    incomeChangePercent: number;
    expenseChange: number;
    expenseChangePercent: number;
    savingsChange: number;
    savingsChangePercent: number;
    categoryChanges: Record<string, { current: number; previous: number; change: number; changePercent: number }>;
  } {
    const currentDate = parseMonthKey(currentMonthKey);
    const previousDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const previousMonthKey = getMonthKey(previousDate);
    
    const currentSummary = this.calculateMonthlySummary(currentMonthKey);
    const previousSummary = this.calculateMonthlySummary(previousMonthKey);
    
    const incomeChange = currentSummary.income - previousSummary.income;
    const expenseChange = currentSummary.expenses - previousSummary.expenses;
    const savingsChange = currentSummary.savings - previousSummary.savings;
    
    const categoryChanges: Record<string, { current: number; previous: number; change: number; changePercent: number }> = {};
    
    const allCategories = new Set([
      ...Object.keys(currentSummary.category_breakdown.reduce((acc, c) => ({ ...acc, [c.category]: true }), {})),
      ...Object.keys(previousSummary.category_breakdown.reduce((acc, c) => ({ ...acc, [c.category]: true }), {})),
    ]);
    
    allCategories.forEach(cat => {
      const current = currentSummary.category_breakdown.find(c => c.category === cat)?.actual || 0;
      const previous = previousSummary.category_breakdown.find(c => c.category === cat)?.actual || 0;
      const change = current - previous;
      const changePercent = previous > 0 ? calculatePercentage(change, previous) : (current > 0 ? 100 : 0);
      
      categoryChanges[cat] = { current, previous, change, changePercent };
    });
    
    return {
      incomeChange,
      incomeChangePercent: previousSummary.income > 0 ? calculatePercentage(incomeChange, previousSummary.income) : (incomeChange > 0 ? 100 : 0),
      expenseChange,
      expenseChangePercent: previousSummary.expenses > 0 ? calculatePercentage(expenseChange, previousSummary.expenses) : (expenseChange > 0 ? 100 : 0),
      savingsChange,
      savingsChangePercent: previousSummary.savings !== 0 ? calculatePercentage(savingsChange, Math.abs(previousSummary.savings)) : (savingsChange > 0 ? 100 : 0),
      categoryChanges,
    };
  }

  calculateDailyAverage(monthKey: string): number {
    const date = parseMonthKey(monthKey);
    const { start, end } = getMonthRange(date);
    const expenses = this.calculateTotalExpenses(start, end);
    const elapsedDays = getElapsedDaysInMonth(date);
    return safeDivide(expenses, elapsedDays);
  }

  calculateMonthlyProjection(monthKey: string): { spent: number; projected: number; dailyAverage: number; daysInMonth: number; elapsedDays: number } {
    const date = parseMonthKey(monthKey);
    const { start, end } = getMonthRange(date);
    const spent = this.calculateTotalExpenses(start, end);
    const elapsedDays = getElapsedDaysInMonth(date);
    const daysInMonth = getDaysInMonthForDate(date);
    const dailyAverage = safeDivide(spent, elapsedDays);
    const projected = roundToTwoDecimals(dailyAverage * daysInMonth);
    
    return { spent, projected, dailyAverage, daysInMonth, elapsedDays };
  }

  getDashboardMetrics(currentMonthKey?: string): FinancialMetrics {
    const now = new Date();
    const currentMonth = currentMonthKey || getMonthKey(now);
    const currentDate = parseMonthKey(currentMonth);
    const previousDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const previousMonthKey = getMonthKey(previousDate);
    
    const currentSummary = this.calculateMonthlySummary(currentMonth);
    const previousSummary = this.calculateMonthlySummary(previousMonthKey);
    const { start, end } = getMonthRange(currentDate);
    const categorySpending = this.calculateCategorySpending(start, end);
    const budgetUsage = this.calculateBudgetUsage(currentMonth);
    const accountBalances = this.calculateAccountBalances();
    const netWorth = this.calculateNetWorth();
    
    return {
      total_income: this.calculateTotalIncome(),
      total_expenses: this.calculateTotalExpenses(),
      total_savings: this.calculateSavings(
        this.calculateTotalIncome(),
        this.calculateTotalExpenses()
      ),
      savings_rate: this.calculateSavingsRate(
        this.calculateTotalIncome(),
        this.calculateTotalExpenses()
      ),
      current_balance: netWorth,
      monthly_income: currentSummary.income,
      monthly_expenses: currentSummary.expenses,
      monthly_savings: currentSummary.savings,
      monthly_savings_rate: currentSummary.savings_rate,
      previous_month_expenses: previousSummary.expenses,
      spending_change: previousSummary.expenses > 0 
        ? calculatePercentage(currentSummary.expenses - previousSummary.expenses, previousSummary.expenses)
        : (currentSummary.expenses > 0 ? 100 : 0),
      category_spending: categorySpending,
      budget_usage: Object.fromEntries(
        Object.entries(budgetUsage).map(([k, v]) => [k, { used: v.used, budget: v.budget, percentage: v.percentage }])
      ),
      account_balances: accountBalances,
    };
  }

  getChartDataForCategorySpending(monthKey: string): (ChartDataPoint & { percentage: number; color: string })[] {
    const date = parseMonthKey(monthKey);
    const { start, end } = getMonthRange(date);
    const categorySpending = this.calculateCategorySpending(start, end);
    const total = Object.values(categorySpending).reduce((a, b) => a + b, 0);
    
    return Object.entries(categorySpending)
      .map(([name, value]) => {
        const category = this.categories.find(c => c.name === name);
        return {
          name,
          value,
          percentage: total > 0 ? calculatePercentage(value, total) : 0,
          color: category?.color || '#9CA3AF',
        };
      })
      .sort((a, b) => b.value - a.value);
  }

  getChartDataForMonthlyTrend(months: number = 12): { month: string; income: number; expenses: number; savings: number }[] {
    const now = new Date();
    const data: { month: string; income: number; expenses: number; savings: number }[] = [];
    
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = getMonthKey(date);
      const summary = this.calculateMonthlySummary(monthKey);
      
      data.push({
        month: formatMonthYear(date),
        income: summary.income,
        expenses: summary.expenses,
        savings: summary.savings,
      });
    }
    
    return data;
  }

  getChartDataForIncomeVsExpense(months: number = 12): { month: string; income: number; expenses: number }[] {
    return this.getChartDataForMonthlyTrend(months).map(d => ({
      month: d.month,
      income: d.income,
      expenses: d.expenses,
    }));
  }

  getChartDataForSavingsTrend(months: number = 12): { month: string; savings: number; savingsRate: number }[] {
    const now = new Date();
    const data: { month: string; savings: number; savingsRate: number }[] = [];
    
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = getMonthKey(date);
      const summary = this.calculateMonthlySummary(monthKey);
      
      data.push({
        month: formatMonthYear(date),
        savings: summary.savings,
        savingsRate: summary.savings_rate,
      });
    }
    
    return data;
  }

  validateSplitTransaction(totalAmount: number, splits: { category: string; amount: number }[]): { valid: boolean; error?: string } {
    const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0);
    const diff = Math.abs(splitTotal - totalAmount);
    
    if (diff > 0.01) {
      return {
        valid: false,
        error: `Split amounts (${formatCurrency(splitTotal)}) must equal total amount (${formatCurrency(totalAmount)})`,
      };
    }
    
    return { valid: true };
  }

  reconcileAccounts(): { balanced: boolean; discrepancies: { account: string; expected: number; actual: number; difference: number }[] } {
    const calculatedBalances = this.calculateAccountBalances();
    const discrepancies: { account: string; expected: number; actual: number; difference: number }[] = [];
    
    this.accounts.forEach(acc => {
      const calculated = calculatedBalances[acc.id] || 0;
      const expected = acc.current_balance ?? acc.opening_balance;
      const difference = calculated - expected;
      
      if (Math.abs(difference) > 0.01) {
        discrepancies.push({
          account: acc.name,
          expected,
          actual: calculated,
          difference,
        });
      }
    });
    
    return {
      balanced: discrepancies.length === 0,
      discrepancies,
    };
  }
}

export function createCalculationEngine(data: { 
  transactions?: Transaction[]; 
  categories?: Category[]; 
  budgets?: Budget[]; 
  accounts?: Account[] 
}) {
  return new CalculationEngine(data);
}