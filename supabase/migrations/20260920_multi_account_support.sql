-- Multi-account / multi-bank support
-- Safe for existing production data: only adds columns, backfills account links,
-- adds indexes and tightens RLS. Nothing is deleted.

-- 1. Accounts carry bank identity (never the full account number)
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS account_number_last4 TEXT;

-- 2. Transactions link to an account; transfer rows know their direction
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transfer_direction TEXT NOT NULL DEFAULT 'out'
    CHECK (transfer_direction IN ('in', 'out'));

-- 3. Backfill: one account per distinct legacy transactions.account value
--    (legacy values are often generic type strings -> map to friendly names/types)
WITH mapped AS (
  SELECT DISTINCT
    t.user_id,
    CASE t.account
      WHEN 'cash' THEN 'Cash'
      WHEN 'bank_account' THEN 'Bank Account'
      WHEN 'credit_card' THEN 'Credit Card'
      WHEN 'savings' THEN 'Savings'
      WHEN 'investment' THEN 'Investment'
      WHEN 'other' THEN 'Other'
      ELSE t.account
    END AS mapped_name,
    CASE WHEN t.account IN ('cash','bank_account','credit_card','savings','investment','other')
      THEN t.account ELSE 'bank_account' END AS mapped_type
  FROM public.transactions t
  WHERE t.account IS NOT NULL AND t.account <> ''
)
INSERT INTO public.accounts (user_id, name, type)
SELECT m.user_id, m.mapped_name, m.mapped_type
FROM mapped m
ON CONFLICT (user_id, name) DO NOTHING;

-- 4. Backfill: PhonePe imports embed "Source account: XXXXXX8750" in notes
INSERT INTO public.accounts (user_id, name, account_number_last4, type)
SELECT DISTINCT
  t.user_id,
  'PhonePe ••••' || substring(t.notes from 'Source account:\s*[Xx\*]+(\d{4})'),
  substring(t.notes from 'Source account:\s*[Xx\*]+(\d{4})'),
  'bank_account'
FROM public.transactions t
WHERE t.notes ~ 'Source account:\s*[Xx\*]+[0-9]{4}'
ON CONFLICT (user_id, name) DO NOTHING;

-- 5. Link PhonePe transactions to their detected source account first
UPDATE public.transactions t
SET account_id = (
  SELECT a.id FROM public.accounts a
  WHERE a.user_id = t.user_id
    AND a.account_number_last4 = substring(t.notes from 'Source account:\s*[Xx\*]+(\d{4})')
    AND a.name LIKE 'PhonePe ••••%'
  ORDER BY a.created_at
  LIMIT 1
)
WHERE t.account_id IS NULL
  AND t.notes ~ 'Source account:\s*[Xx\*]+[0-9]{4}';

-- 6. Link remaining transactions via their legacy account label
UPDATE public.transactions t
SET account_id = (
  SELECT a.id FROM public.accounts a
  WHERE a.user_id = t.user_id
    AND a.name = CASE t.account
      WHEN 'cash' THEN 'Cash'
      WHEN 'bank_account' THEN 'Bank Account'
      WHEN 'credit_card' THEN 'Credit Card'
      WHEN 'savings' THEN 'Savings'
      WHEN 'investment' THEN 'Investment'
      WHEN 'other' THEN 'Other'
      ELSE t.account
    END
  ORDER BY a.created_at
  LIMIT 1
)
WHERE t.account_id IS NULL
  AND t.account IS NOT NULL AND t.account <> '';

-- 7. Fingerprint includes account identity so the same-looking transaction in
--    two different accounts is NOT a duplicate
CREATE OR REPLACE FUNCTION public.generate_transaction_fingerprint()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fingerprint := md5(
    NEW.user_id || '|' ||
    NEW.date || '|' ||
    NEW.type || '|' ||
    round(NEW.amount, 2)::text || '|' ||
    lower(btrim(NEW.description)) || '|' ||
    lower(coalesce(NEW.payment_method::text, '')) || '|' ||
    lower(coalesce(NEW.account_id::text, NEW.account, ''))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Keep UPDATE trigger in sync when account linkage changes too
DROP TRIGGER IF EXISTS trigger_generate_transaction_fingerprint_update ON public.transactions;
CREATE TRIGGER trigger_generate_transaction_fingerprint_update
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  WHEN (OLD.date IS DISTINCT FROM NEW.date
        OR OLD.type IS DISTINCT FROM NEW.type
        OR OLD.amount IS DISTINCT FROM NEW.amount
        OR OLD.description IS DISTINCT FROM NEW.description
        OR OLD.user_id IS DISTINCT FROM NEW.user_id
        OR OLD.account_id IS DISTINCT FROM NEW.account_id
        OR OLD.account IS DISTINCT FROM NEW.account)
  EXECUTE FUNCTION public.generate_transaction_fingerprint();

-- 8. Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_account ON public.transactions(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON public.transactions(account_id, date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_user_bank_last4
  ON public.accounts (user_id, bank_name, account_number_last4)
  WHERE bank_name IS NOT NULL AND account_number_last4 IS NOT NULL;

-- 9. RLS: a transaction may only reference an account owned by the same user.
--    RESTRICTIVE policies AND with the existing permissive user_id policies.
DROP POLICY IF EXISTS transactions_account_owner_guard_ins ON public.transactions;
CREATE POLICY transactions_account_owner_guard_ins ON public.transactions
  AS RESTRICTIVE FOR INSERT
  WITH CHECK (
    account_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS transactions_account_owner_guard_upd ON public.transactions;
CREATE POLICY transactions_account_owner_guard_upd ON public.transactions
  AS RESTRICTIVE FOR UPDATE
  USING (
    account_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    account_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id AND a.user_id = auth.uid()
    )
  );
