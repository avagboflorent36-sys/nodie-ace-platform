
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS tranche2_token text;

CREATE UNIQUE INDEX IF NOT EXISTS payments_tranche2_token_key
  ON public.payments(tranche2_token)
  WHERE tranche2_token IS NOT NULL;

UPDATE public.payments
SET tranche2_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
WHERE mode = 'installments_2' AND tranche2_token IS NULL;
