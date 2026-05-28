
CREATE OR REPLACE FUNCTION public.ensure_payment_tranche2_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.mode = 'installments_2' AND (NEW.tranche2_token IS NULL OR NEW.tranche2_token = '') THEN
    NEW.tranche2_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_ensure_tranche2_token ON public.payments;
CREATE TRIGGER payments_ensure_tranche2_token
BEFORE INSERT OR UPDATE OF mode ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.ensure_payment_tranche2_token();
