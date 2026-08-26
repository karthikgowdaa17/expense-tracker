-- Add fingerprint column for idempotent transaction imports
-- Fingerprint is a deterministic hash of core transaction fields
-- that uniquely identifies a transaction regardless of user-modified fields

ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS fingerprint TEXT;

-- Create unique index on (user_id, fingerprint) to enforce idempotency at database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_user_fingerprint 
ON public.transactions (user_id, fingerprint);

-- Backfill fingerprint for existing transactions
-- Using core fields that don't change: date, type, amount, description
UPDATE public.transactions 
SET fingerprint = md5(
  user_id || '|' || 
  date || '|' || 
  type || '|' || 
  amount::text || '|' || 
  description
)
WHERE fingerprint IS NULL;

-- Make fingerprint NOT NULL after backfill
ALTER TABLE public.transactions 
ALTER COLUMN fingerprint SET NOT NULL;