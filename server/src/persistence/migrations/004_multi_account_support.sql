-- Multi-account support: bank-aware accounts and transaction -> account links
-- Conventions: UUIDs as TEXT, timestamps as ISO8601 TEXT, booleans as INTEGER 0/1
-- Safe to run on existing data: only adds columns, creates/links accounts, never deletes.

-- 1. Extend accounts with bank metadata
ALTER TABLE accounts ADD COLUMN bank_name TEXT;
ALTER TABLE accounts ADD COLUMN account_number_last4 TEXT;

-- 2. Link transactions to accounts (nullable for backward compatibility)
ALTER TABLE transactions ADD COLUMN account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL;

-- 3. Transfer direction: 'out' (money left this account) / 'in' (money arrived).
--    Existing rows default to 'out', which preserves previous balance behaviour.
ALTER TABLE transactions ADD COLUMN transfer_direction TEXT NOT NULL DEFAULT 'out'
    CHECK (transfer_direction IN ('in', 'out'));

-- 4a. Create an account for every distinct legacy transactions.account value.
--     Legacy values are often generic type strings ('cash', 'bank_account', ...),
--     map those to friendly names; keep any custom name as-is.
INSERT OR IGNORE INTO accounts (id, user_id, name, type, opening_balance, currency, is_active, created_at, updated_at)
SELECT
    lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6))),
    user_id,
    CASE account
        WHEN 'cash' THEN 'Cash'
        WHEN 'bank_account' THEN 'Bank Account'
        WHEN 'credit_card' THEN 'Credit Card'
        WHEN 'savings' THEN 'Savings'
        WHEN 'investment' THEN 'Investment'
        WHEN 'other' THEN 'Other'
        ELSE account
    END,
    CASE WHEN account IN ('cash','bank_account','credit_card','savings','investment','other') THEN account ELSE 'bank_account' END,
    0,
    'INR',
    1,
    datetime('now'),
    datetime('now')
FROM (SELECT DISTINCT user_id, account FROM transactions WHERE account IS NOT NULL AND account <> '');

-- 4b. PhonePe imports store "Source account: XXXXXX<last4>" inside notes.
--     Create one account per detected source account (idempotent via UNIQUE(user_id, name)).
INSERT OR IGNORE INTO accounts (id, user_id, name, bank_name, account_number_last4, type, opening_balance, currency, is_active, created_at, updated_at)
SELECT
    lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6))),
    user_id,
    'PhonePe ••••' || substr(notes, instr(notes, 'Source account:') + 22, 4),
    NULL,
    substr(notes, instr(notes, 'Source account:') + 22, 4),
    'bank_account',
    0,
    'INR',
    1,
    datetime('now'),
    datetime('now')
FROM (
    SELECT DISTINCT user_id, notes FROM transactions
    WHERE notes LIKE '%Source account: X%'
      AND substr(notes, instr(notes, 'Source account:') + 22, 4) GLOB '[0-9][0-9][0-9][0-9]'
);

-- 4c. Link PhonePe transactions to their detected source account first (more specific).
UPDATE transactions
SET account_id = (
    SELECT a.id FROM accounts a
    WHERE a.user_id = transactions.user_id
      AND a.account_number_last4 = substr(transactions.notes, instr(transactions.notes, 'Source account:') + 22, 4)
      AND a.name LIKE 'PhonePe ••••%'
    LIMIT 1
)
WHERE account_id IS NULL
  AND notes LIKE '%Source account: X%'
  AND substr(notes, instr(notes, 'Source account:') + 22, 4) GLOB '[0-9][0-9][0-9][0-9]';

-- 4d. Link remaining transactions via their legacy account string.
UPDATE transactions
SET account_id = (
    SELECT a.id FROM accounts a
    WHERE a.user_id = transactions.user_id
      AND a.name = CASE transactions.account
          WHEN 'cash' THEN 'Cash'
          WHEN 'bank_account' THEN 'Bank Account'
          WHEN 'credit_card' THEN 'Credit Card'
          WHEN 'savings' THEN 'Savings'
          WHEN 'investment' THEN 'Investment'
          WHEN 'other' THEN 'Other'
          ELSE transactions.account
      END
    ORDER BY a.created_at
    LIMIT 1
)
WHERE account_id IS NULL
  AND account IS NOT NULL AND account <> '';

-- 5. Indexes for account-filtered queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_account ON transactions(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON transactions(account_id, date DESC);
-- Prevent duplicate bank accounts (same user + bank + last4); rows without bank info unaffected
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_user_bank_last4
    ON accounts(user_id, bank_name, account_number_last4)
    WHERE bank_name IS NOT NULL AND account_number_last4 IS NOT NULL;
