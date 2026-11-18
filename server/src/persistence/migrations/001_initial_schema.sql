-- SQLite schema for expense-tracker, translated from Supabase PostgreSQL schema
-- Conventions:
--   * UUIDs stored as TEXT
--   * Timestamps stored as TEXT (ISO8601, e.g. 2024-01-15T12:34:56.789Z)
--   * Booleans stored as INTEGER 0/1
--   * Monetary amounts stored as INTEGER cents (e.g. 12345 = 123.45)
--   * Enums become TEXT with CHECK constraints

-- Migration tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Profiles (extends auth user)
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    full_name TEXT,
    avatar_url TEXT,
    currency TEXT NOT NULL DEFAULT 'INR',
    theme TEXT NOT NULL DEFAULT 'system',
    financial_year_start_month INTEGER NOT NULL DEFAULT 4,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income','expense','transfer','refund')),
    icon TEXT,
    color TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, name, type)
);

-- Recurring transactions
CREATE TABLE IF NOT EXISTS recurring_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK (amount > 0),
    category TEXT NOT NULL,
    subcategory TEXT,
    description TEXT,
    frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly','quarterly','yearly','custom')),
    start_date TEXT NOT NULL, -- DATE as ISO TEXT
    end_date TEXT,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','upi','credit_card','debit_card','bank_transfer','other')),
    account TEXT NOT NULL,
    day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
    is_active INTEGER NOT NULL DEFAULT 1,
    last_generated TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL, -- DATE as ISO TEXT
    type TEXT NOT NULL CHECK (type IN ('income','expense','transfer','refund')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    category TEXT NOT NULL,
    subcategory TEXT,
    description TEXT NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','upi','credit_card','debit_card','bank_transfer','other')),
    account TEXT NOT NULL,
    notes TEXT,
    is_recurring INTEGER NOT NULL DEFAULT 0,
    recurring_id TEXT,
    split_from TEXT,
    fingerprint TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (recurring_id) REFERENCES recurring_transactions(id) ON DELETE SET NULL,
    FOREIGN KEY (split_from) REFERENCES transactions(id) ON DELETE SET NULL
);

-- Budgets
CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    month TEXT NOT NULL, -- format YYYY-MM
    amount INTEGER NOT NULL CHECK (amount > 0),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, category_id, month),
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Accounts
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('cash','bank_account','credit_card','savings','investment','other')),
    opening_balance INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'INR',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, name)
);

-- User settings
CREATE TABLE IF NOT EXISTS user_settings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    currency TEXT NOT NULL DEFAULT 'INR',
    theme TEXT NOT NULL DEFAULT 'system',
    financial_year_start_month INTEGER NOT NULL DEFAULT 4,
    default_categories TEXT NOT NULL DEFAULT '[]', -- JSON array
    default_payment_methods TEXT NOT NULL DEFAULT '[]',
    default_accounts TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON transactions(user_id, category);
CREATE INDEX IF NOT EXISTS idx_transactions_user_fingerprint ON transactions(user_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_id, month);
CREATE INDEX IF NOT EXISTS idx_recurring_user_active ON recurring_transactions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);