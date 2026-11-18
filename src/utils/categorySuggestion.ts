import type { Category, TransactionType } from '@/types';

interface KeywordRule {
  keywords: string[];
  categoryName: string;
  type: TransactionType;
}

const EXPENSE_RULES: KeywordRule[] = [
  { keywords: ['swiggy', 'zomato', 'restaurant', 'food', 'dinner', 'lunch', 'breakfast', 'cafe', 'biryani', 'pizza', 'burger', 'dosa', 'idli', 'mess', 'canteen', 'tiffin'], categoryName: 'Food & Dining', type: 'expense' },
  { keywords: ['grocery', 'groceries', 'bigbasket', 'zepto', 'blinkit', 'instamart', 'dmart', 'reliance fresh', 'more', 'spencer', 'vegetable', 'fruit', 'milk', 'bread', 'egg', 'rice', 'dal', 'atta'], categoryName: 'Groceries', type: 'expense' },
  { keywords: ['uber', 'ola', 'rapido', 'namma yatri', 'metro', 'bus', 'auto', 'rickshaw', 'cab', 'taxi', 'fuel', 'petrol', 'diesel', 'cng', 'parking', 'toll', 'fastag'], categoryName: 'Transportation', type: 'expense' },
  { keywords: ['amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'meesho', 'shopping', 'shop', 'clothes', 'shoes', 'electronics', 'mobile', 'laptop', 'headphone', 'watch'], categoryName: 'Shopping', type: 'expense' },
  { keywords: ['electricity', 'bescom', 'bills', 'water bill', 'gas bill', 'broadband', 'internet', 'wifi', 'airtel', 'jio', 'vi', 'bsnl', 'recharge', 'bbps', 'phone bill', 'mobile bill'], categoryName: 'Bills & Utilities', type: 'expense' },
  { keywords: ['apollo', '1mg', 'pharmeasy', 'netmeds', 'hospital', 'pharmacy', 'medical', 'clinic', 'diagnostic', 'doctor', 'medicine', 'health', 'dental', 'eye'], categoryName: 'Healthcare', type: 'expense' },
  { keywords: ['netflix', 'spotify', 'prime', 'hotstar', 'sony liv', 'zee5', 'youtube premium', 'apple music', 'gaana', 'wynk', 'subscription', 'prime video', 'disney'], categoryName: 'Subscriptions', type: 'expense' },
  { keywords: ['movie', 'cinema', 'pvr', 'inox', 'concert', 'event', 'bookmyshow', 'game', 'steam', 'playstation', 'xbox', 'entertainment'], categoryName: 'Entertainment', type: 'expense' },
  { keywords: ['rent', 'landlord', 'housing', 'house rent', 'flat rent', 'pg', 'hostel', 'accommodation'], categoryName: 'Rent / Housing', type: 'expense' },
  { keywords: ['salary', 'payroll', 'stipend', 'wages', 'income', 'credited', 'deposit', 'transfer from'], categoryName: 'Salary', type: 'income' },
  { keywords: ['freelance', 'upwork', 'fiverr', 'freelancer', 'contract', 'project payment', 'client payment'], categoryName: 'Freelance', type: 'income' },
  { keywords: ['business', 'revenue', 'sales', 'turnover', 'profit', 'merchant', 'shop income'], categoryName: 'Business', type: 'income' },
  { keywords: ['interest', 'fd interest', 'savings interest', 'bank interest', 'rd interest'], categoryName: 'Interest', type: 'income' },
  { keywords: ['investment', 'mutual fund', 'stock', 'equity', 'dividend', 'capital gain', 'sip', 'redemption'], categoryName: 'Investment', type: 'income' },
  { keywords: ['gift', 'cashback', 'refund', 'reward', 'bonus', 'prize'], categoryName: 'Gift', type: 'income' },
];

function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9\s]/g, ' ');
}

function calculateMatchScore(description: string, rule: KeywordRule): number {
  const normalized = normalizeText(description);
  let score = 0;
  
  for (const keyword of rule.keywords) {
    if (normalized.includes(keyword.toLowerCase())) {
      score += keyword.length;
    }
  }
  
  return score;
}

export function suggestCategory(
  description: string,
  categories: Category[],
  transactionType: TransactionType = 'expense'
): Category | null {
  if (!description || !categories.length) return null;
  
  const userCategories = categories.filter(c => c.type === transactionType);
  if (!userCategories.length) return null;
  
  let bestMatch: { category: Category; score: number } | null = null;
  
  for (const rule of EXPENSE_RULES) {
    if (rule.type !== transactionType) continue;
    
    const matchingCategory = userCategories.find(c => 
      c.name.toLowerCase() === rule.categoryName.toLowerCase()
    );
    
    if (!matchingCategory) continue;
    
    const score = calculateMatchScore(description, rule);
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { category: matchingCategory, score };
    }
  }
  
  if (bestMatch && bestMatch.score >= 3) {
    return bestMatch.category;
  }
  
  return null;
}

export function getSuggestedCategoryName(
  description: string,
  categories: Category[],
  transactionType: TransactionType = 'expense'
): string | null {
  const suggested = suggestCategory(description, categories, transactionType);
  return suggested?.name ?? null;
}