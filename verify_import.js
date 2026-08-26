const fs = require('fs');
const path = require('path');

// Load PhonePe JSON
const jsonPath = path.join(__dirname, 'phonepe_aug2026.json');
const raw = fs.readFileSync(jsonPath, 'utf8');
const rows = JSON.parse(raw);

console.log('Total transactions in file:', rows.length);

// Default categories from schema (handle_new_user)
const defaultCategories = {
  income: [
    { name: 'Salary', icon: '💼', color: '#10B981' },
    { name: 'Bonus', icon: '🎁', color: '#059669' },
    { name: 'Freelance', icon: '💻', color: '#0D9488' },
    { name: 'Business', icon: '🏢', color: '#0891B2' },
    { name: 'Investment', icon: '📈', color: '#7C3AED' },
    { name: 'Other Income', icon: '➕', color: '#6B7280' },
  ],
  expense: [
    { name: 'Housing', icon: '🏠', color: '#EF4444' },
    { name: 'Food', icon: '🍽️', color: '#F97316' },
    { name: 'Transportation', icon: '🚗', color: '#EAB308' },
    { name: 'Shopping', icon: '🛍️', color: '#EC4899' },
    { name: 'Entertainment', icon: '🎬', color: '#8B5CF6' },
    { name: 'Bills & Utilities', icon: '📄', color: '#06B6D4' },
    { name: 'Health', icon: '❤️', color: '#F43F5E' },
    { name: 'Education', icon: '🎓', color: '#6366F1' },
    { name: 'Travel', icon: '✈️', color: '#14B8A6' },
    { name: 'Other', icon: '⋯', color: '#9CA3AF' },
  ],
};

function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]+/g, '');
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function isSelfTransfer(desc) {
  const d = desc.toLowerCase();
  return (
    /transfer\s+(to|from).*\(self\)/.test(d) ||
    /self\s*transfer/.test(d) ||
    /transfer\s+to\s+.*self/.test(d) ||
    /transfer\s+from\s+.*self/.test(d)
  );
}

function normalizeDesc(s) {
  return s.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.,;:]+/g, '');
}

function stripCorporateSuffixes(s) {
  return s
    .replace(/\b(limited|ltd|pvt|private|inc|corp|corporation|company|co|llp|india|foods|services|solutions|technologies|systems|enterprises|ventures|group|holdings)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMerchantKey(desc) {
  let cleaned = desc.toLowerCase().trim().replace(/[^a-z0-9\s]/g, ' ');
  cleaned = stripCorporateSuffixes(cleaned);
  cleaned = cleaned.replace(/\s+/g, ' ');
  const words = cleaned.split(' ').filter(w => w.length > 2);
  return words.slice(0, 2).join(' ');
}

// Merchant map from settings/page.tsx
const merchantMap = {
  // Food
  'swiggy': 'Food',
  'zomato': 'Food',
  'blinkit': 'Food',
  'zepto': 'Food',
  'instamart': 'Food',
  'bigbasket': 'Food',
  'dominos': 'Food',
  'domino': 'Food',
  'pizza hut': 'Food',
  'pizza': 'Food',
  'biryani': 'Food',
  'juice': 'Food',
  'sugar cane': 'Food',
  'bakery': 'Food',
  'cafe': 'Food',
  'restaurant': 'Food',
  'hotel': 'Food',
  // Transport
  'uber': 'Transportation',
  'ola': 'Transportation',
  'rapido': 'Transportation',
  'namma yatri': 'Transportation',
  'metro': 'Transportation',
  'bmtc': 'Transportation',
  'cab': 'Transportation',
  'taxi': 'Transportation',
  'parking': 'Transportation',
  'fastag': 'Transportation',
  // Shopping
  'amazon': 'Shopping',
  'flipkart': 'Shopping',
  'myntra': 'Shopping',
  'meesho': 'Shopping',
  'ajio': 'Shopping',
  'nykaa': 'Shopping',
  'croma': 'Shopping',
  'reliance digital': 'Shopping',
  // Entertainment
  'netflix': 'Entertainment',
  'spotify': 'Entertainment',
  'youtube premium': 'Entertainment',
  'prime video': 'Entertainment',
  'disney': 'Entertainment',
  'sony liv': 'Entertainment',
  'hotstar': 'Entertainment',
  'steam': 'Entertainment',
  'playstation': 'Entertainment',
  'xbox': 'Entertainment',
  // Bills
  'bescom': 'Bills & Utilities',
  'electricity': 'Bills & Utilities',
  'water bill': 'Bills & Utilities',
  'gas bill': 'Bills & Utilities',
  'broadband': 'Bills & Utilities',
  'airtel': 'Bills & Utilities',
  'jio': 'Bills & Utilities',
  'vi': 'Bills & Utilities',
  'bsnl': 'Bills & Utilities',
  'recharge': 'Bills & Utilities',
  'bbps': 'Bills & Utilities',
  // Health
  'apollo': 'Health',
  '1mg': 'Health',
  'pharmeasy': 'Health',
  'netmeds': 'Health',
  'hospital': 'Health',
  'pharmacy': 'Health',
  'medical': 'Health',
  'clinic': 'Health',
  'diagnostic': 'Health',
  // Rent
  'rent': 'Rent',
  'landlord': 'Rent',
  // Income
  'salary': 'Income',
  'payroll': 'Income',
  'employer': 'Income',
  'stipend': 'Income',
  'refund': 'Income',
  // Cash
  'atm': 'Cash',
  'cash withdrawal': 'Cash',
};

const catKeywords = {
  Food: ['food', 'restaurant', 'cafe', 'bakery', 'juice', 'sweets', 'biryani', 'pizza', 'hotel'],
  Transportation: ['uber', 'ola', 'rapido', 'namma yatri', 'metro', 'bmtc', 'bus', 'cab', 'taxi', 'parking', 'fastag'],
  Shopping: ['amazon', 'flipkart', 'myntra', 'meesho', 'ajio', 'nykaa', 'croma', 'reliance digital', 'shopping'],
  'Bills & Utilities': ['electricity', 'bescom', 'water', 'gas', 'broadband', 'airtel', 'jio', 'vi', 'bsnl', 'recharge', 'bbps', 'bill'],
  Entertainment: ['netflix', 'spotify', 'youtube', 'prime', 'disney', 'sony', 'hotstar', 'steam', 'playstation', 'xbox', 'gaming'],
  Health: ['apollo', '1mg', 'pharmeasy', 'netmeds', 'hospital', 'pharmacy', 'medical', 'clinic', 'diagnostic'],
  Rent: ['rent', 'landlord'],
  Income: ['salary', 'payroll', 'employer', 'stipend', 'refund', 'cashback'],
  Cash: ['atm', 'cash withdrawal', 'withdrawal'],
};

function getCategoryForTransaction(description, type, categories) {
  const merchantKey = extractMerchantKey(description);
  // learnedMap empty

  const normDesc = stripCorporateSuffixes(description.toLowerCase());

  // merchantMap
  for (const [merchant, cat] of Object.entries(merchantMap)) {
    if (normDesc.includes(merchant)) {
      if (cat === 'Income' && type !== 'income') continue;
      if (cat === 'Transfer' && type !== 'transfer') continue;
      const catExists = categories.find(c => c.name === cat && c.type === (type === 'transfer' ? 'expense' : type));
      if (catExists) return cat;
    }
  }

  // catKeywords
  for (const [cat, keywords] of Object.entries(catKeywords)) {
    if (keywords.some(k => normDesc.includes(k))) {
      if (cat === 'Income' && type !== 'income') continue;
      const catExists = categories.find(c => c.name === cat && c.type === (type === 'transfer' ? 'expense' : type));
      if (catExists) return cat;
    }
  }

  // fallback Other
  const existingCat = categories.find(c => c.name.toLowerCase() === 'other' && c.type === (type === 'transfer' ? 'expense' : type));
  if (existingCat) return existingCat.name;

  const def = categories.find(c => c.is_default && c.type === (type === 'transfer' ? 'expense' : type));
  return def?.name || 'Other';
}

function normalizePhonePeRow(row, categories) {
  const date = row.date || row.transaction_date || row.txn_date || '';
  const description = row.description || row.narration || row.merchant || row.details || '';
  const amountRaw = row.amount ?? row.txn_amount ?? row.debit ?? row.credit ?? 0;
  const typeRaw = (row.type || row.txn_type || row.cr_dr || '').toLowerCase();

  const amount = parseAmount(amountRaw);
  let type = 'expense';

  if (isSelfTransfer(description)) {
    type = 'transfer';
  } else if (typeRaw.includes('credit') || typeRaw.includes('cr') || typeRaw.includes('received')) {
    type = 'income';
  } else if (typeRaw.includes('debit') || typeRaw.includes('dr') || typeRaw.includes('paid')) {
    type = 'expense';
  } else {
    if (amount > 0 && /salary|credit|received|refund|cashback/i.test(description)) type = 'income';
  }

  const category = getCategoryForTransaction(description, type, categories);

  const rawNotes = row.notes || row.note || '';
  const lowerNotes = rawNotes.toLowerCase();
  let accountType = 'bank_account';
  if (lowerNotes.includes('credit card') || lowerNotes.includes('slice') || lowerNotes.includes('credit_card')) {
    accountType = 'credit_card';
  } else if (lowerNotes.includes('cash')) {
    accountType = 'cash';
  }

  return {
    date: date.split('T')[0],
    type,
    amount: Math.abs(amount),
    category,
    description: description.slice(0, 200),
    payment_method: 'upi',
    account: accountType,
    notes: rawNotes,
  };
}

// Build categories list for lookup
const categories = [
  ...defaultCategories.income.map(c => ({...c, type: 'income', is_default: true})),
  ...defaultCategories.expense.map(c => ({...c, type: 'expense', is_default: true}))
];

// Transform all rows
const transformed = rows.map(r => normalizePhonePeRow(r, categories));

// Summaries
const totals = { expense:0, income:0, transfer:0 };
const paymentMethods = {};
const accountTypes = {};
const categoriesCount = {};

const otherTransactions = [];
const cashAccountTransactions = [];

const merchantsToShow = [
  'Swiggy',
  'BLINKIT',
  'FLIPKART',
  'Middle East Shawarma',
  'SOWBHAGYA',
  'FRESH N BAKE',
  'Maria Bakery',
  'Raichu',
];

transformed.forEach(t => {
  totals[t.type]++;
  paymentMethods[t.payment_method] = (paymentMethods[t.payment_method]||0)+1;
  accountTypes[t.account] = (accountTypes[t.account]||0)+1;
  categoriesCount[t.category] = (categoriesCount[t.category]||0)+1;

  if (t.category === 'Other') otherTransactions.push(t);
  if (t.account === 'cash') cashAccountTransactions.push(t);

  const descLower = t.description.toLowerCase();
  if (merchantsToShow.some(m => descLower.includes(m.toLowerCase())) ||
      (t.type === 'income' && (descLower.includes('salary') || descLower.includes('bonus') || descLower.includes('received') || descLower.includes('credit')))) {
    console.log(`${t.description} | ${t.type} | ${t.category} | ${t.payment_method} | ${t.account}`);
  }
});

console.log('\n--- SUMMARY ---');
console.log(`Total transactions: ${transformed.length}`);
console.log(`Expenses: ${totals.expense}`);
console.log(`Income: ${totals.income}`);
console.log(`Transfers: ${totals.transfer}`);
console.log('\nPayment methods:', paymentMethods);
console.log('Account types:', accountTypes);
console.log('\nCategories:', categoriesCount);
console.log(`\nTransactions with category Other (${otherTransactions.length}):`);
otherTransactions.forEach(t => console.log(`  ${t.description} | ${t.type} | ${t.amount}`));
console.log(`\nTransactions with account cash (${cashAccountTransactions.length}):`);
cashAccountTransactions.forEach(t => console.log(`  ${t.description} | ${t.type} | ${t.account}`));