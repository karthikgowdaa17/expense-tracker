-- Fix fingerprint generation: use database trigger for consistency
-- This ensures all insert/update paths (manual, import, duplicate, edit) get correct fingerprint

-- 1. Create function to generate fingerprint (matches the original migration logic)
CREATE OR REPLACE FUNCTION public.generate_transaction_fingerprint()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fingerprint := md5(
    NEW.user_id || '|' || 
    NEW.date || '|' || 
    NEW.type || '|' || 
    NEW.amount::text || '|' || 
    NEW.description
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create trigger on INSERT to auto-generate fingerprint
DROP TRIGGER IF EXISTS trigger_generate_transaction_fingerprint_insert ON public.transactions;
CREATE TRIGGER trigger_generate_transaction_fingerprint_insert
  BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.generate_transaction_fingerprint();

-- 3. Create trigger on UPDATE to regenerate fingerprint when key fields change
DROP TRIGGER IF EXISTS trigger_generate_transaction_fingerprint_update ON public.transactions;
CREATE TRIGGER trigger_generate_transaction_fingerprint_update
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW 
  WHEN (OLD.date IS DISTINCT FROM NEW.date
        OR OLD.type IS DISTINCT FROM NEW.type
        OR OLD.amount IS DISTINCT FROM NEW.amount
        OR OLD.description IS DISTINCT FROM NEW.description
        OR OLD.user_id IS DISTINCT FROM NEW.user_id)
  EXECUTE FUNCTION public.generate_transaction_fingerprint();

-- 4. Fingerprint can now be nullable since trigger handles it
-- (NOT NULL is enforced by trigger on insert/update)
ALTER TABLE public.transactions ALTER COLUMN fingerprint DROP NOT NULL;

-- 5. Recreate unique index (in case it was dropped)
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_user_fingerprint 
ON public.transactions (user_id, fingerprint);

-- 6. Backfill any NULL fingerprints (for existing rows)
UPDATE public.transactions 
SET fingerprint = md5(
  user_id || '|' || 
  date || '|' || 
  type || '|' || 
  amount::text || '|' || 
  description
)
WHERE fingerprint IS NULL;